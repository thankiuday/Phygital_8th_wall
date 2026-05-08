'use strict';

const User = require('../models/User');
const Session = require('../models/Session');
const Campaign = require('../models/Campaign');
const { AppError } = require('../middleware/errorHandler');
const { success, created } = require('../utils/apiResponse');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  hashToken,
} = require('../utils/jwt');
const { sendPasswordResetEmail } = require('../services/emailService');

/* ─────────────────────────────────────────
   Helper — build safe user payload for response
   ───────────────────────────────────────── */
const userPayload = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  isEmailVerified: user.isEmailVerified,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt,
});

/* ─────────────────────────────────────────
   POST /api/auth/register
   ───────────────────────────────────────── */
const register = async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  const user = await User.create({ name, email, password });

  const accessToken = signAccessToken(user._id, user.role);
  const refreshToken = signRefreshToken(user._id);

  user.lastLoginAt = new Date();
  await user.save({ validateModifiedOnly: true });

  await Session.create({ user: user._id, refreshTokenHash: hashToken(refreshToken) });

  setRefreshCookie(res, refreshToken);

  return created(res, { user: userPayload(user), accessToken }, 'Account created successfully');
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

  const accessToken = signAccessToken(user._id, user.role);
  const refreshToken = signRefreshToken(user._id);

  user.lastLoginAt = new Date();
  await user.save({ validateModifiedOnly: true });

  await Session.create({ user: user._id, refreshTokenHash: hashToken(refreshToken) });

  setRefreshCookie(res, refreshToken);

  return success(res, { user: userPayload(user), accessToken }, 'Logged in successfully');
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
  const { name, avatar } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (avatar !== undefined) {
    updates.avatar = avatar === '' || avatar === null ? null : avatar;
  }

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
};
