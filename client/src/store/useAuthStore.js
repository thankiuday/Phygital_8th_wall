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
    authService.logout().catch(() => {});
    set({ user: null, accessToken: null, isAuthenticated: false });
  });

  return {
    user:            null,
    accessToken:     null,
    isAuthenticated: false,
    isLoading:       false, // form-submission loading — starts false
    isHydrating:     true,  // page-load session restore — starts true
    error:           null,

    /* ── register ───────────────────────────────────────────── */
    register: async (name, email, password) => {
      set({ isLoading: true, error: null });
      try {
        const data = await authService.register({ name, email, password });
        set({
          user:            data.user,
          accessToken:     data.accessToken,
          isAuthenticated: true,
          isLoading:       false,
          isHydrating:     false,
        });
        return { success: true };
      } catch (err) {
        const message = extractError(err, 'Registration failed');
        set({ isLoading: false, error: message });
        return { success: false, message, errors: err.response?.data?.errors };
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
        return { success: false, message };
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
  };
});

/* Helper — extract a readable message from an Axios error */
const extractError = (err, fallback) =>
  err.response?.data?.message || err.message || fallback;

export default useAuthStore;
