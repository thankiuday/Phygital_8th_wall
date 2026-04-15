import api from './api';

export const publicService = {
  getCampaign: async (campaignId) => {
    const res = await api.get(`/public/campaigns/${campaignId}`);
    return res.data.data.campaign;
  },

  recordScan: async (campaignId, payload) => {
    await api.post(`/public/campaigns/${campaignId}/scan`, payload);
  },
};
