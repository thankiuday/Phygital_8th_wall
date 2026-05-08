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
   * @param {File}                  file
   * @param {'image'|'video'|'raw'} resourceType
   * @param {Function}              onProgress  — called with 0-100 progress value
   * @returns {{ url, publicId, thumbnailUrl, bytes }}
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
      // For videos Cloudinary auto-generates a thumbnail at the .jpg URL.
      // For raw uploads the URL itself is the canonical asset reference.
      thumbnailUrl:
        resourceType === 'video'
          ? res.data.secure_url.replace(/\.[^.]+$/, '.jpg')
          : res.data.secure_url,
      bytes: typeof res.data.bytes === 'number' ? res.data.bytes : 0,
    };
  },

  /**
   * uploadDocumentToCloudinary — convenience wrapper for `links-doc-video-qr`
   * doc uploads. Always sends the appropriate resource type for the file
   * (raw for PDFs/Office, image for JPG/PNG) so previews keep working.
   */
  uploadDocumentToCloudinary: async (file, onProgress) => {
    const isImage = file?.type?.startsWith('image/');
    const resourceType = isImage ? 'image' : 'raw';
    const result = await campaignService.uploadToCloudinary(file, resourceType, onProgress);
    return {
      ...result,
      resourceType,
      mimeType: file?.type || null,
      bytes: result.bytes || file?.size || 0,
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
  createSingleLinkCampaign: async ({
    campaignName,
    destinationUrl,
    qrDesign,
    preciseGeoAnalytics,
    redirectSlug,
  }) => {
    // Dedicated route — never relies on `campaignType` surviving proxies / caching.
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

  /**
   * createLinksDocVideoCampaign — multi-asset hub variant. We strip empty
   * fields per-row before sending so the server `.strict()` schema never
   * rejects legit payloads on a stray "" the wizard didn't trim.
   */
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

  /**
   * createDigitalBusinessCardCampaign — full payload create. The wizard's
   * draft store is kept client-side; this method translates the draft into
   * the server-strict shape (trimming nullable image fields the user never
   * touched).
   */
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

  /** GET /api/campaigns/check-card-slug?slug=…&excludeId=… */
  checkCardSlugAvailability: async (slug, excludeId) => {
    const params = { slug };
    if (excludeId) params.excludeId = excludeId;
    const res = await api.get('/campaigns/check-card-slug', { params });
    return res.data.data;
  },

  /**
   * Render front + back PNGs in parallel. Server returns a single envelope:
   *   {
   *     status: 'ready' | 'pending',
   *     front:  { status, url?, public_id?, jobId?, filename, face: 'front' },
   *     back:   { status, url?, public_id?, jobId?, filename, face: 'back'  },
   *   }
   * The aggregate `status` is "ready" only when both faces resolved in the
   * same round-trip; otherwise the client polls each face's `jobId` via
   * `getCardRenderStatus` until both come back ready.
   */
  renderCardImage: async (id, { size } = {}) => {
    // Send an object body (not literal `null`) so strict JSON parsers on
    // some deployments don't reject the request before it reaches controller logic.
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
