import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const THEMES = ['dark', 'light', 'neon'];

/**
 * useThemeStore — global theme state (dark / light / neon).
 *
 * Persists the user's theme preference to localStorage under 'p8w-theme'.
 * App.jsx reads this on mount and applies theme classes to <html>.
 */
const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'dark', // default to dark — premium SaaS feel

      /**
       * Cycle dark -> light -> neon -> dark.
       * Also updates the <html> classList immediately.
       */
      toggleTheme: () => {
        const current = get().theme;
        const currentIdx = THEMES.indexOf(current);
        const next = THEMES[(currentIdx + 1) % THEMES.length];
        set({ theme: next });
        applyThemeClass(next);
      },

      /**
       * Explicitly set a theme.
       */
      setTheme: (theme) => {
        const next = THEMES.includes(theme) ? theme : 'dark';
        set({ theme: next });
        applyThemeClass(next);
      },
    }),
    {
      name: 'p8w-theme',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          try {
            localStorage.removeItem('p8w-theme');
          } catch {
            /* ignore */
          }
        }
      },
    }
  )
);

/**
 * Applies the correct class to <html> element.
 * Called on store change and on app initialization.
 */
export const applyThemeClass = (theme) => {
  const root = document.documentElement;
  root.classList.remove('dark', 'neon');
  root.dataset.theme = theme;
  if (theme === 'dark') root.classList.add('dark');
  if (theme === 'neon') root.classList.add('neon');
};

export default useThemeStore;
