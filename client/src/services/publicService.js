import api from './api';
import publicApi from './publicApi';

export const publicService = {
  getCampaign: async (campaignId) => {
    const res = await api.get(`/public/campaigns/${campaignId}`);
    return res.data.data.campaign;
  },

  recordScan: async (campaignId, payload) => {
    await api.post(`/public/campaigns/${campaignId}/scan`, payload);
  },

  /* ── Digital Business Card public endpoints ──────────────────── */
  getCardMeta: async (slug) => {
    const res = await publicApi.get(`/public/card/${slug}/meta`);
    return res.data.data;
  },

  recordCardScan: async (slug, payload) => {
    try {
      await publicApi.post(`/public/card/${slug}/scan`, payload);
    } catch {/* telemetry never blocks UX */}
  },

  recordCardAction: async (slug, payload) => {
    try {
      await publicApi.post(`/public/card/${slug}/action`, payload);
    } catch {/* telemetry never blocks UX */}
  },

  recordCardSession: async (slug, payload) => {
    try {
      await publicApi.post(`/public/card/${slug}/session`, payload);
    } catch {/* telemetry never blocks UX */}
  },
};
