import { create } from 'zustand';
import * as analyticsService from '../services/analyticsService';

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
    set({ isLoadingCamp: true, error: null });
    try {
      const data = await analyticsService.getCampaignAnalytics(campaignId, p);
      set({ campaignData: data, isLoadingCamp: false });
    } catch (err) {
      set({
        error: err.response?.data?.message || 'Failed to load campaign analytics',
        isLoadingCamp: false,
      });
    }
  },

  clearCampaignData: () => set({ campaignData: null }),
}));

export default useAnalyticsStore;
