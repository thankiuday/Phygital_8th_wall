import { useQuery } from '@tanstack/react-query';
import * as analyticsService from '../services/analyticsService';

export const analyticsQueryKeys = {
  overview: (period) => ['analytics', 'overview', period],
  campaign: (campaignId, period) => ['analytics', 'campaign', campaignId, period],
};

const STALE_MS = 2 * 60 * 1000;
/** Slow background refresh while tab is visible (not Socket.io; keeps charts fresh). */
const REFETCH_MS = 90 * 1000;

function refetchIntervalWhenVisible(query) {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'visible' ? REFETCH_MS : false;
}

/**
 * Dashboard overview aggregates. Cached per period; optional slow refetch when tab visible.
 *
 * Note: In React StrictMode (dev), effects run twice so you may see duplicate
 * requests in the Network tab — production builds do not double-mount.
 */
export function useAnalyticsOverview(period) {
  return useQuery({
    queryKey: analyticsQueryKeys.overview(period),
    queryFn: () => analyticsService.getOverview(period),
    staleTime: STALE_MS,
    refetchInterval: refetchIntervalWhenVisible,
  });
}

/**
 * Per-campaign analytics. Keeps previous chart data while the period changes.
 */
export function useCampaignAnalytics(campaignId, period) {
  return useQuery({
    queryKey: analyticsQueryKeys.campaign(campaignId, period),
    queryFn: () => analyticsService.getCampaignAnalytics(campaignId, period),
    enabled: Boolean(campaignId),
    staleTime: STALE_MS,
    refetchInterval: refetchIntervalWhenVisible,
    placeholderData: (previousData) => previousData,
  });
}
