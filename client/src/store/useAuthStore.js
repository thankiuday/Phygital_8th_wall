import { create } from 'zustand';
import { authService } from '../services/authService';
import {
  setTokenGetter,
  setLogoutFn,
  setTokenSetter,
} from '../services/tokenBridge';

/**
 * useAuthStore — global authentication state.
 *
 * TWO separate loading flags:
 *   isHydrating — true ONLY during the silent session restore on page load.
 *                 Used by ProtectedRoute to show a full-screen spinner instead
 *                 of a flash-redirect to /login.
 *   isLoading   — true ONLY while a user-triggered action (login / register)
 *                 is in flight. Used by form submit buttons.
 *
 * This prevents the button from showing "Signing in…" before the user even
 * clicks — which happened when isLoading was used for both purposes.
 */
const useAuthStore = create((set, get) => {
  setTokenGetter(() => get().accessToken);
  setTokenSetter((token) => set({ accessToken: token }));
  setLogoutFn(() => {
    // Forced logout from the interceptor should be local-only. Calling the
    // protected logout endpoint when token/refresh already failed creates 401 noise loops.
    set({ user: null, accessToken: null, isAuthenticated: false });
  });

  return {
    user:            null,
    accessToken:     null,
    isAuthenticated: false,
    isLoading:       false, // form-submission loading — starts false
    isHydrating:     true,  // page-load session restore — starts true
    error:           null,
    pendingWelcomeNotification: false,

    /* ── register ───────────────────────────────────────────── */
    register: async (email, password, agreedToCertification) => {
      set({ isLoading: true, error: null });
      try {
        const data = await authService.register({ email, password, agreedToCertification });
        set({
          user:            data.user,
          accessToken:     data.accessToken,
          isAuthenticated: true,
          isLoading:       false,
          isHydrating:     false,
          pendingWelcomeNotification: !!data.showWelcomeNotification,
        });
        return { success: true };
      } catch (err) {
        const message = extractError(err, 'Registration failed');
        set({ isLoading: false, error: message });
        return { success: false, message, errors: err.response?.data?.errors };
      }
    },

    completeGoogleAuth: async (code) => {
      set({ isLoading: true, error: null });
      try {
        const data = await authService.exchangeGoogleAuthCode(code);
        set({
          user: data.user,
          accessToken: data.accessToken,
          isAuthenticated: true,
          isLoading: false,
          isHydrating: false,
          pendingWelcomeNotification: !!data.showWelcomeNotification,
        });
        return { success: true };
      } catch (err) {
        const message = extractError(err, 'Google authentication failed');
        set({ isLoading: false, error: message });
        return { success: false, message };
      }
    },

    /* ── login ──────────────────────────────────────────────── */
    login: async (email, password) => {
      set({ isLoading: true, error: null });
      try {
        const data = await authService.login({ email, password });
        set({
          user:            data.user,
          accessToken:     data.accessToken,
          isAuthenticated: true,
          isLoading:       false,
          isHydrating:     false,
        });
        return { success: true };
      } catch (err) {
        const message = extractError(err, 'Login failed');
        set({ isLoading: false, error: message });
        return { success: false, message, errors: err.response?.data?.errors };
      }
    },

    /* ── logout ─────────────────────────────────────────────── */
    logout: async () => {
      try { await authService.logout(); } catch { /* ignore */ }
      set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
    },

    /** Revoke refresh sessions on every device; clears local auth state. */
    logoutAll: async () => {
      try { await authService.logoutAll(); } catch { /* ignore */ }
      set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
    },

    /**
     * hydrate — called ONCE in App.jsx on mount.
     * Silently restores a session from the httpOnly refresh cookie.
     * Sets isHydrating (not isLoading) so auth page buttons are unaffected.
     */
    hydrate: async () => {
      set({ isHydrating: true });
      try {
        const { accessToken } = await authService.refresh();
        const { user }        = await authService.getMe(accessToken);
        set({ user, accessToken, isAuthenticated: true, isHydrating: false });
      } catch {
        // Only clear auth state if the user didn't log in while hydrate was in-flight
        if (!get().isAuthenticated) {
          set({ user: null, accessToken: null, isAuthenticated: false, isHydrating: false });
        } else {
          set({ isHydrating: false });
        }
      }
    },

    setAccessToken: (token) => set({ accessToken: token }),
    updateUser:     (patch) => set((s) => ({ user: { ...s.user, ...patch } })),

    /** Refetch `/auth/me` and replace `user` (e.g. after profile save). */
    refreshUser: async (options = {}) => {
      const token = get().accessToken;
      const data = await authService.getMe(
        token ? { token, stats: !!options.stats } : { stats: !!options.stats }
      );
      set({ user: data.user });
      return data;
    },

    clearError:     ()      => set({ error: null }),
    markWelcomeNotificationSeen: () => set({ pendingWelcomeNotification: false }),
  };
});

/**
 * Readable message for auth forms — prefers API `message`, then validation
 * `errors[]`, then network / status-specific hints.
 */
const extractError = (err, fallback) => {
  const status = err.response?.status;
  const data = err.response?.data;

  if (data != null && typeof data === 'object') {
    const { message, errors } = data;
    if (typeof message === 'string' && message.trim()) {
      if (Array.isArray(errors) && errors.length > 1) {
        const rest = errors
          .slice(1)
          .map((e) => (e && typeof e.message === 'string' ? e.message : ''))
          .filter(Boolean);
        if (rest.length) return [message.trim(), ...rest].join(' ');
      }
      return message.trim();
    }
    if (Array.isArray(errors) && errors.length) {
      const parts = errors
        .map((e) => (e && typeof e.message === 'string' ? e.message : ''))
        .filter(Boolean);
      if (parts.length) return parts.join(' ');
    }
  }

  if (status === 429) {
    return (
      (data && typeof data === 'object' && typeof data.message === 'string' && data.message)
      || 'Too many attempts. Please wait a few minutes and try again.'
    );
  }

  if (!err.response) {
    if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')) {
      return 'Request timed out. Check your connection and try again.';
    }
    return 'Unable to reach the server. Check your connection and try again.';
  }

  return err.message || fallback;
};

export default useAuthStore;
