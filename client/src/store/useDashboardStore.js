import { create } from 'zustand';
import { dashboardService } from '../services/dashboardService';

const useDashboardStore = create((set) => ({
  stats: null,
  recentCampaigns: [],
  scanTrend: [],
  isLoading: false,
  error: null,

  fetchStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await dashboardService.getStats();
      set({
        stats: data.stats,
        recentCampaigns: data.recentCampaigns,
        scanTrend: data.scanTrend,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, error: err.response?.data?.message || 'Failed to load dashboard' });
    }
  },
}));

export default useDashboardStore;
