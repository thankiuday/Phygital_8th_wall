/**
 * Human-readable copy for auth / OAuth flows (avoid exposing env vars, stack traces, or Google jargon).
 */

/** Map server `error` query param from `/auth/google/callback` redirects. */
export const oauthCallbackErrorMessage = (code) => {
  const c = String(code || '').trim();
  const map = {
    // Rare: user lands on the SPA with Google’s raw query param
    access_denied: 'Sign-in was cancelled. You can try again anytime.',
    google_access_denied: 'Sign-in was cancelled. You can try again anytime.',
    invalid_state: 'For your security, that sign-in could not be verified. Please try signing in with Google again.',
    missing_code: 'We could not finish connecting to Google. Please try again.',
    token_exchange_failed: 'We could not verify your account with Google. Please try again in a moment.',
    google_redirect_uri_mismatch:
      'Sign in with Google is not fully set up for this site yet. Please use your email and password, or try again later.',
    google_auth_failed: 'Something went wrong while signing in with Google. Please try again or use your email and password.',
    profile_fetch_failed: 'We could not load your Google profile. Please try again.',
    missing_email: 'Your Google account did not share an email address we can use. Try another Google account or use email and password.',
    email_not_verified: 'That Google email is not verified. Verify it in your Google account, or use email and password.',
  };
  return map[c] || map.google_auth_failed;
};
