'use strict';

const crypto = require('crypto');
const { LRUCache } = require('lru-cache');
const User = require('../models/User');
const Session = require('../models/Session');
const Campaign = require('../models/Campaign');
const { AppError } = require('../middleware/errorHandler');
const { success, created } = require('../utils/apiResponse');
const { allocateUniqueHandleFromEmail } = require('../utils/userHandle');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  hashToken,
} = require('../utils/jwt');
const { sendPasswordResetEmail } = require('../services/emailService');

const googleAuthExchangeCache = new LRUCache({
  max: 1000,
  ttl: 60 * 1000,
});

const GOOGLE_STATE_COOKIE = 'p8w_google_oauth_state';

/* ─────────────────────────────────────────
   Helper — build safe user payload for response
   ───────────────────────────────────────── */
const userPayload = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  handle: user.handle || null,
  role: user.role,
  avatar: user.avatar,
  isEmailVerified: user.isEmailVerified,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt,
});

const deriveNameFromEmail = (email) => {
  const localPart = String(email || '').split('@')[0] || '';
  const normalized = localPart
    .replace(/[._-]+/g, ' ')
    .replace(/[^a-zA-Z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const fallback = normalized || 'User';
  return fallback.length >= 2 ? fallback.slice(0, 60) : 'User';
};

const randomPasswordForSocialSignup = () =>
  `GoogleAuth#${crypto.randomBytes(18).toString('hex')}A1`;

const clearGoogleStateCookie = (res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(GOOGLE_STATE_COOKIE, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/api/auth/google',
  });
};

const setGoogleStateCookie = (res, state) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/api/auth/google',
  });
};

const stateMatches = (providedState, cookieState) => {
  if (!providedState || !cookieState) return false;
  const a = Buffer.from(String(providedState));
  const b = Buffer.from(String(cookieState));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const requireGoogleOauthConfig = () => {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    CLIENT_URL,
  } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI || !CLIENT_URL) {
    throw new AppError('Google authentication is not configured', 500);
  }
  return {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    CLIENT_URL,
  };
};

const issueAuthSession = async (res, user) => {
  const accessToken = signAccessToken(user._id, user.role);
  const refreshToken = signRefreshToken(user._id);
  user.lastLoginAt = new Date();
  await user.save({ validateModifiedOnly: true });
  await Session.create({ user: user._id, refreshTokenHash: hashToken(refreshToken) });
  setRefreshCookie(res, refreshToken);
  return accessToken;
};

const buildClientGoogleCallbackUrl = (clientBaseUrl, params = {}) => {
  const url = new URL('/auth/google/callback', clientBaseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
};

/* ─────────────────────────────────────────
   POST /api/auth/register
   ───────────────────────────────────────── */
const register = async (req, res) => {
  const { email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  const name = deriveNameFromEmail(email);
  const handle = await allocateUniqueHandleFromEmail(User, email);
  const user = await User.create({ name, email, password, handle });
  const accessToken = await issueAuthSession(res, user);

  return created(
    res,
    { user: userPayload(user), accessToken, showWelcomeNotification: true },
    'Account created successfully'
  );
};

/* ─────────────────────────────────────────
   POST /api/auth/login
   ───────────────────────────────────────── */
const login = async (req, res) => {
  const { email, password } = req.body;

  // Explicitly select password field (it is select: false by default)
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }

  if (!user.isActive) {
    throw new AppError('Your account has been suspended. Contact support.', 403);
  }

  if (!user.handle) {
    const handle = await allocateUniqueHandleFromEmail(User, user.email);
    await User.updateOne({ _id: user._id }, { $set: { handle } });
    user.handle = handle;
  }

  const accessToken = await issueAuthSession(res, user);

  return success(res, { user: userPayload(user), accessToken }, 'Logged in successfully');
};

/* ─────────────────────────────────────────
   GET /api/auth/google
   ───────────────────────────────────────── */
const startGoogleAuth = async (req, res) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = requireGoogleOauthConfig();
  const state = crypto.randomBytes(24).toString('hex');
  setGoogleStateCookie(res, state);

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};

/* ─────────────────────────────────────────
   GET /api/auth/google/callback
   ───────────────────────────────────────── */
const googleAuthCallback = async (req, res) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, CLIENT_URL } = requireGoogleOauthConfig();

  const failRedirect = (reason) => {
    const redirectUrl = buildClientGoogleCallbackUrl(CLIENT_URL, { error: reason });
    return res.redirect(redirectUrl);
  };

  const { code, state, error } = req.query;
  const cookieState = req.cookies?.[GOOGLE_STATE_COOKIE];
  clearGoogleStateCookie(res);

  if (error) return failRedirect('google_access_denied');
  if (!stateMatches(state, cookieState)) return failRedirect('invalid_state');
  if (!code) return failRedirect('missing_code');

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return failRedirect('token_exchange_failed');
    const tokenData = await tokenRes.json();
    if (!tokenData?.access_token) return failRedirect('token_exchange_failed');

    const userInfoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userInfoRes.ok) return failRedirect('profile_fetch_failed');
    const profile = await userInfoRes.json();

    const email = String(profile?.email || '').toLowerCase().trim();
    const googleId = String(profile?.sub || '').trim();
    if (!email) return failRedirect('missing_email');
    if (profile?.email_verified === false) return failRedirect('email_not_verified');

    let user = await User.findOne({ email }).select('+password');
    let isNewUser = false;
    if (user) {
      if (!user.googleId && googleId) user.googleId = googleId;
      if (user.authProvider !== 'google') user.authProvider = 'google';
      await user.save({ validateModifiedOnly: true });
    } else {
      const safeName = String(profile?.name || '').trim().slice(0, 60) || deriveNameFromEmail(email);
      const handle = await allocateUniqueHandleFromEmail(User, email);
      user = await User.create({
        name: safeName,
        email,
        password: randomPasswordForSocialSignup(),
        googleId: googleId || null,
        authProvider: 'google',
        isEmailVerified: true,
        handle,
      });
      isNewUser = true;
    }

    if (!user.handle) {
      const handle = await allocateUniqueHandleFromEmail(User, user.email);
      await User.updateOne({ _id: user._id }, { $set: { handle } });
      user.handle = handle;
    }

    const accessToken = await issueAuthSession(res, user);
    const exchangeCode = crypto.randomBytes(24).toString('hex');
    googleAuthExchangeCache.set(exchangeCode, {
      accessToken,
      user: userPayload(user),
      showWelcomeNotification: isNewUser,
    });
    const redirectUrl = buildClientGoogleCallbackUrl(CLIENT_URL, { code: exchangeCode });
    return res.redirect(redirectUrl);
  } catch {
    return failRedirect('google_auth_failed');
  }
};

/* ─────────────────────────────────────────
   POST /api/auth/google/exchange
   ───────────────────────────────────────── */
const exchangeGoogleAuthCode = async (req, res) => {
  const code = String(req.body?.code || '').trim();
  if (!code) {
    throw new AppError('Exchange code is required', 400);
  }
  const payload = googleAuthExchangeCache.get(code);
  if (!payload) {
    throw new AppError('Exchange code is invalid or expired', 400);
  }
  googleAuthExchangeCache.delete(code);
  return success(res, payload, 'Google authentication successful');
};

/* ─────────────────────────────────────────
   POST /api/auth/refresh
   Uses the httpOnly cookie to issue a new access token.
   ───────────────────────────────────────── */
const refreshAccessToken = async (req, res) => {
  const token = req.cookies?.p8w_refresh;
  if (!token) {
    throw new AppError('No refresh token provided', 401);
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError('Refresh token invalid or expired', 401);
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw new AppError('Refresh token invalid or expired', 401);
  }
  if (!user.isActive) {
    throw new AppError('Your account has been suspended', 403);
  }

  const session = await Session.findOne({ user: user._id, refreshTokenHash: hashToken(token) });
  if (!session) {
    throw new AppError('Refresh token reuse detected — please log in again', 401);
  }

  // Rotate refresh token on every use (refresh token rotation)
  const newRefreshToken = signRefreshToken(user._id);
  session.refreshTokenHash = hashToken(newRefreshToken);
  await session.save({ validateModifiedOnly: true });

  setRefreshCookie(res, newRefreshToken);

  const accessToken = signAccessToken(user._id, user.role);
  return success(res, { accessToken }, 'Token refreshed');
};

/* ─────────────────────────────────────────
   POST /api/auth/logout
   ───────────────────────────────────────── */
const logout = async (req, res) => {
  const token = req.cookies?.p8w_refresh;

  if (token) {
    await Session.deleteOne({ user: req.user._id, refreshTokenHash: hashToken(token) });
  }

  clearRefreshCookie(res);
  return success(res, {}, 'Logged out successfully');
};

/* ─────────────────────────────────────────
   POST /api/auth/logout-all
   Revokes every refresh session for the current user (all devices).
   ───────────────────────────────────────── */
const logoutAll = async (req, res) => {
  await Session.deleteMany({ user: req.user._id });
  clearRefreshCookie(res);
  return success(res, {}, 'Logged out from all devices');
};

/* ─────────────────────────────────────────
   GET /api/auth/me
   Returns the currently authenticated user.
   ───────────────────────────────────────── */
const getMe = async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError('User not found', 404);

  if (!user.handle) {
    const handle = await allocateUniqueHandleFromEmail(User, user.email);
    await User.updateOne({ _id: user._id }, { $set: { handle } });
    user.handle = handle;
  }

  const payload = { user: userPayload(user) };

  if (req.query.stats === '1') {
    const uid = user._id;
    const [campaignCount, activeCampaignCount] = await Promise.all([
      Campaign.countDocuments({ userId: uid, isDeleted: { $ne: true } }),
      Campaign.countDocuments({ userId: uid, status: 'active', isDeleted: { $ne: true } }),
    ]);
    payload.stats = { campaignCount, activeCampaignCount };
  }

  return success(res, payload);
};

const updateMe = async (req, res) => {
  const { name } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });
  if (!user) throw new AppError('User not found', 404);

  return success(res, { user: userPayload(user) }, 'Profile updated');
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw new AppError('User not found', 404);

  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError('Current password is incorrect', 401);
  }

  user.password = newPassword;
  await user.save({ validateModifiedOnly: true });

  return success(res, {}, 'Password updated successfully');
};

/* ─────────────────────────────────────────
   POST /api/auth/forgot-password
   ───────────────────────────────────────── */
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  // Always return 200 even if email not found — prevents user enumeration
  if (!user) {
    return success(
      res,
      {},
      'If an account with that email exists, a reset link has been sent.'
    );
  }

  const rawToken = user.generatePasswordResetToken();
  await user.save({ validateModifiedOnly: true });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

  try {
    await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });
  } catch (err) {
    // Roll back token on mail failure
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateModifiedOnly: true });
    throw new AppError('Failed to send reset email. Please try again later.', 500);
  }

  return success(res, {}, 'If an account with that email exists, a reset link has been sent.');
};

/* ─────────────────────────────────────────
   POST /api/auth/reset-password/:token
   ───────────────────────────────────────── */
const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const user = await User.findByResetToken(token);
  if (!user) {
    throw new AppError('Password reset token is invalid or has expired', 400);
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await Session.deleteMany({ user: user._id });
  await user.save();

  clearRefreshCookie(res);
  return success(res, {}, 'Password reset successful. Please log in with your new password.');
};

module.exports = {
  register,
  login,
  refreshAccessToken,
  logout,
  logoutAll,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword,
  startGoogleAuth,
  googleAuthCallback,
  exchangeGoogleAuthCode,
};
