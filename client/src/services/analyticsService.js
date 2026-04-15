import api from './api';

/**
 * Fetches the user's overall analytics overview.
 * @param {string} period  '7d' | '30d' | '90d'
 */
export const getOverview = async (period = '30d') => {
  const { data } = await api.get('/analytics/overview', { params: { period } });
  return data.data;
};

/**
 * Fetches analytics for a single campaign.
 * @param {string} campaignId
 * @param {string} period
 */
export const getCampaignAnalytics = async (campaignId, period = '30d') => {
  const { data } = await api.get(`/analytics/campaigns/${campaignId}`, { params: { period } });
  return data.data;
};

/**
 * Fetches just the scan trend time-series.
 * @param {string} period
 */
export const getTrends = async (period = '30d') => {
  const { data } = await api.get('/analytics/trends', { params: { period } });
  return data.data;
};
