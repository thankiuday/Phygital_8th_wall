import { create } from 'zustand';
import * as analyticsService from '../services/analyticsService';

/** In-flight dedupe: same campaignId + period shares one request. */
const campaignAnalyticsInflight = new Map();

const useAnalyticsStore = create((set, get) => ({
  // ── State ─────────────────────────────────────────────────────────────────
  overview:       null,
  campaignData:   null, // per-campaign analytics
  period:         '30d',
  isLoading:      false,
  isLoadingCamp:  false,
  error:          null,

  // ── Actions ───────────────────────────────────────────────────────────────

  setPeriod: (period) => {
    set({ period });
    get().fetchOverview(period);
  },

  /** Update period only (e.g. campaign analytics page — avoids redundant overview fetch). */
  setPeriodOnly: (period) => {
    set({ period });
  },

  fetchOverview: async (period) => {
    const p = period || get().period;
    set({ isLoading: true, error: null });
    try {
      const data = await analyticsService.getOverview(p);
      set({ overview: data, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to load analytics', isLoading: false });
    }
  },

  fetchCampaignAnalytics: async (campaignId, period) => {
    const p = period || get().period;
    const key = `${campaignId}:${p}`;
    const existing = campaignAnalyticsInflight.get(key);
    if (existing) return existing;

    const promise = (async () => {
      set({ isLoadingCamp: true, error: null });
      try {
        const data = await analyticsService.getCampaignAnalytics(campaignId, p);
        set({ campaignData: data, isLoadingCamp: false });
        return data;
      } catch (err) {
        set({
          error: err.response?.data?.message || 'Failed to load campaign analytics',
          isLoadingCamp: false,
        });
        throw err;
      } finally {
        campaignAnalyticsInflight.delete(key);
      }
    })();

    campaignAnalyticsInflight.set(key, promise);
    return promise;
  },

  clearCampaignData: () => set({ campaignData: null }),
}));

export default useAnalyticsStore;
