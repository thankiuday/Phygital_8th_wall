import api from './api';
import axios from 'axios';

export const campaignService = {
  /* ── Get S3 presigned upload URL ─────────────────────────── */
  getUploadSignature: async (resourceType = 'image', options = {}) => {
    const { draft = false, contentType, filename } = options;
    const params = new URLSearchParams({
      resourceType,
      contentType: contentType || 'application/octet-stream',
      filename: filename || 'file',
    });
    if (draft) params.set('draft', '1');
    const query = params.toString();

    if (!draft) {
      const res = await api.get(`/campaigns/upload-signature?${query}`);
      return res.data.data;
    }
    try {
      const res = await api.get(`/campaigns/upload-signature?${query}`);
      return res.data.data;
    } catch (err) {
      if (err?.response?.status !== 401) throw err;
      const res = await api.get(`/public/upload-signature?${query}`);
      return res.data.data;
    }
  },

  /**
   * uploadAsset — PUT file to S3 via presigned URL.
   * @returns {{ url, publicId, thumbnailUrl, bytes }}
   */
  uploadAsset: async (file, resourceType, onProgress, options = {}) => {
    const { draft = false } = options;
    const contentType = file?.type || 'application/octet-stream';
    const sig = await campaignService.getUploadSignature(resourceType, {
      draft,
      contentType,
      filename: file?.name || 'file',
    });

    await axios.put(sig.uploadUrl, file, {
      headers: {
        'Content-Type': contentType,
        ...(sig.headers || {}),
      },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    });

    return {
      url: sig.publicUrl,
      publicId: sig.publicId || sig.key,
      thumbnailUrl: sig.publicUrl,
      bytes: typeof file?.size === 'number' ? file.size : 0,
    };
  },

  uploadToCloudinary: (file, resourceType, onProgress, options) =>
    campaignService.uploadAsset(file, resourceType, onProgress, options),

  uploadDocumentToCloudinary: async (file, onProgress, options = {}) => {
    const isImage = file?.type?.startsWith('image/');
    const resourceType = isImage ? 'image' : 'raw';
    const result = await campaignService.uploadAsset(file, resourceType, onProgress, options);
    return {
      ...result,
      resourceType,
      mimeType: file?.type || null,
      bytes: result.bytes || file?.size || 0,
    };
  },

  createCampaign: async (payload) => {
    const res = await api.post('/campaigns', payload);
    return res.data.data.campaign;
  },

  createSingleLinkCampaign: async ({
    campaignName,
    destinationUrl,
    qrDesign,
    preciseGeoAnalytics,
    redirectSlug,
  }) => {
    const res = await api.post('/campaigns/single-link', {
      campaignName,
      destinationUrl,
      qrDesign: qrDesign ?? null,
      preciseGeoAnalytics: !!preciseGeoAnalytics,
      redirectSlug: redirectSlug || undefined,
    });
    return res.data.data.campaign;
  },

  createMultipleLinksCampaign: async ({
    campaignName,
    linkItems,
    qrDesign,
    preciseGeoAnalytics,
    redirectSlug,
  }) => {
    const res = await api.post('/campaigns/multiple-links', {
      campaignName,
      linkItems,
      qrDesign: qrDesign ?? null,
      preciseGeoAnalytics: !!preciseGeoAnalytics,
      redirectSlug: redirectSlug || undefined,
    });
    return res.data.data.campaign;
  },

  createLinksVideoCampaign: async ({
    campaignName,
    videoSource,
    videoUrl,
    videoPublicId,
    externalVideoUrl,
    thumbnailUrl,
    linkItems,
    qrDesign,
    preciseGeoAnalytics,
    redirectSlug,
  }) => {
    const payload = {
      campaignName,
      videoSource,
      linkItems,
      qrDesign: qrDesign ?? null,
      preciseGeoAnalytics: !!preciseGeoAnalytics,
      redirectSlug: redirectSlug || undefined,
    };

    if (videoSource === 'upload') {
      payload.videoUrl = videoUrl || undefined;
      payload.videoPublicId = videoPublicId || undefined;
      payload.thumbnailUrl = thumbnailUrl || undefined;
    } else if (videoSource === 'link') {
      payload.externalVideoUrl = externalVideoUrl || undefined;
      payload.thumbnailUrl = thumbnailUrl || undefined;
    }

    const res = await api.post('/campaigns/links-video', payload);
    return res.data.data.campaign;
  },

  createLinksDocVideoCampaign: async ({
    campaignName,
    videoSource,
    videoItems = [],
    docItems = [],
    linkItems,
    qrDesign,
    preciseGeoAnalytics,
    redirectSlug,
  }) => {
    const cleanVideoItems = videoItems
      .filter((vi) => vi && vi.label)
      .map((vi) => {
        const isUpload = (vi.source || videoSource) === 'upload';
        const row = {
          label: String(vi.label).trim(),
          source: isUpload ? 'upload' : 'link',
        };
        if (isUpload) {
          if (vi.url) row.url = vi.url;
          if (vi.publicId) row.publicId = vi.publicId;
        } else if (vi.externalVideoUrl) {
          row.externalVideoUrl = String(vi.externalVideoUrl).trim();
        }
        if (vi.thumbnailUrl) row.thumbnailUrl = vi.thumbnailUrl;
        return row;
      });

    const cleanDocItems = docItems
      .filter((di) => di && di.label && di.url)
      .map((di) => {
        const row = {
          label: String(di.label).trim(),
          url: di.url,
        };
        if (di.publicId) row.publicId = di.publicId;
        if (di.mimeType) row.mimeType = di.mimeType;
        if (typeof di.bytes === 'number') row.bytes = di.bytes;
        if (di.resourceType === 'image' || di.resourceType === 'raw') row.resourceType = di.resourceType;
        return row;
      });

    const payload = {
      campaignName,
      videoSource,
      linkItems,
      qrDesign: qrDesign ?? null,
      preciseGeoAnalytics: !!preciseGeoAnalytics,
      redirectSlug: redirectSlug || undefined,
    };
    if (cleanVideoItems.length) payload.videoItems = cleanVideoItems;
    if (cleanDocItems.length) payload.docItems = cleanDocItems;

    const res = await api.post('/campaigns/links-doc-video', payload);
    return res.data.data.campaign;
  },

  createDigitalBusinessCardCampaign: async ({
    campaignName,
    cardSlug,
    visibility,
    cardContent,
    cardDesign,
    cardPrintSettings,
    qrDesign,
    preciseGeoAnalytics,
  }) => {
    const payload = {
      campaignName,
      cardSlug: cardSlug || undefined,
      visibility: visibility || 'public',
      cardContent,
      cardDesign,
      cardPrintSettings,
      qrDesign: qrDesign ?? null,
      preciseGeoAnalytics: !!preciseGeoAnalytics,
    };
    const res = await api.post('/campaigns/digital-business-card', payload);
    return res.data.data.campaign;
  },

  checkCardSlugAvailability: async (slug, excludeId) => {
    const params = { slug };
    if (excludeId) params.excludeId = excludeId;
    const res = await api.get('/campaigns/check-card-slug', { params });
    return res.data.data;
  },

  renderCardImage: async (id, { size } = {}) => {
    const res = await api.post(`/campaigns/${id}/card-image`, {}, {
      params: size ? { size } : {},
    });
    return res.data.data;
  },

  getCardRenderStatus: async (jobId) => {
    const res = await api.get(`/public/card-render/status/${jobId}`);
    return res.data.data;
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
