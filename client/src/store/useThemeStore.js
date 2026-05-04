import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * useThemeStore — global dark/light mode state
 *
 * Persists the user's theme preference to localStorage under 'p8w-theme'.
 * App.jsx reads this on mount and applies/removes the 'dark' class on <html>.
 */
const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'dark', // default to dark — premium SaaS feel

      /**
       * Toggle between dark and light modes.
       * Also updates the <html> classList immediately.
       */
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: next });
        applyThemeClass(next);
      },

      /**
       * Explicitly set a theme.
       */
      setTheme: (theme) => {
        set({ theme });
        applyThemeClass(theme);
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
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

export default useThemeStore;
