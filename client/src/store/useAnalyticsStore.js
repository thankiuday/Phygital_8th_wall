import { create } from 'zustand';

/**
 * Shared analytics UI state (period only). Data is loaded via TanStack Query
 * in `useAnalyticsQueries.js` to avoid redundant fetches and unstable effect deps.
 *
 * Dev note: React StrictMode double-invokes mount effects in development, which
 * can make the Network tab look "busy." Production builds do not behave the same.
 */
const useAnalyticsStore = create((set) => ({
  period: '30d',

  setPeriod: (period) => {
    set({ period });
  },

  /** Alias — same as setPeriod (kept for CampaignAnalyticsPage). */
  setPeriodOnly: (period) => {
    set({ period });
  },
}));

export default useAnalyticsStore;
