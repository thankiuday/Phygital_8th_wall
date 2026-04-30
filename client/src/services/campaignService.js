import api from './api';
import axios from 'axios';

export const campaignService = {
  /* ── Get Cloudinary signed-upload signature ──────────────── */
  getUploadSignature: async (resourceType = 'image') => {
    const res = await api.get(`/campaigns/upload-signature?resourceType=${resourceType}`);
    return res.data.data;
  },

  /**
   * uploadToCloudinary — uploads a file directly to Cloudinary CDN.
   * Uses a server-generated signature — our API secret never touches the client.
   *
   * @param {File}     file
   * @param {'image'|'video'} resourceType
   * @param {Function} onProgress  — called with 0-100 progress value
   * @returns {{ url, publicId, thumbnailUrl }}
   */
  uploadToCloudinary: async (file, resourceType, onProgress) => {
    const sig = await campaignService.getUploadSignature(resourceType);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', sig.apiKey);
    formData.append('timestamp', sig.timestamp);
    formData.append('signature', sig.signature);
    formData.append('folder', sig.folder);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/${resourceType}/upload`;

    const res = await axios.post(uploadUrl, formData, {
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    });

    return {
      url: res.data.secure_url,
      publicId: res.data.public_id,
      // For videos Cloudinary auto-generates a thumbnail at the .jpg URL
      thumbnailUrl:
        resourceType === 'video'
          ? res.data.secure_url.replace(/\.[^.]+$/, '.jpg')
          : res.data.secure_url,
    };
  },

  /* ── CRUD ────────────────────────────────────────────────── */
  createCampaign: async (payload) => {
    const res = await api.post('/campaigns', payload);
    return res.data.data.campaign;
  },

  /**
   * createSingleLinkCampaign — single-step create for the dynamic-redirect QR
   * flow.  Server returns the persisted campaign including the assigned
   * `redirectSlug` which the client can use to encode the printed QR.
   */
  createSingleLinkCampaign: async ({ campaignName, destinationUrl, qrDesign }) => {
    // Dedicated route — never relies on `campaignType` surviving proxies / caching.
    const res = await api.post('/campaigns/single-link', {
      campaignName,
      destinationUrl,
      qrDesign: qrDesign ?? null,
    });
    return res.data.data.campaign;
  },

  getCampaigns: async (params = {}) => {
    const res = await api.get('/campaigns', { params });
    return res.data.data;
  },

  getCampaign: async (id) => {
    const res = await api.get(`/campaigns/${id}`);
    return res.data.data.campaign;
  },

  updateCampaign: async (id, updates) => {
    const res = await api.patch(`/campaigns/${id}`, updates);
    return res.data.data.campaign;
  },

  deleteCampaign: async (id) => {
    await api.delete(`/campaigns/${id}`);
  },

  duplicateCampaign: async (id) => {
    const res = await api.post(`/campaigns/${id}/duplicate`);
    return res.data.data.campaign;
  },
};
