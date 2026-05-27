import { create } from 'zustand';
import { campaignService } from '../services/campaignService';
import { adminService } from '../services/adminService';
import {
  buildArExperienceUrl,
  compositeQrOnCardImage,
  downloadImageBlob,
} from '../utils/compositeQrOnCardImage';
import { rowsToApiLinkItems } from '../pages/campaigns/multiple-links/multiLinkFormUtils';

const defaultQrDesign = () => ({
  frame: 'bottom-bar',
  frameCaption: 'Scan me!',
});

const defaultQrPlacement = () => ({
  x: 0.82,
  y: 0.82,
  scale: 0.26,
  preset: 'bottom-right',
});

/**
 * useCampaignStore — manages the campaign creation wizard state
 * AND the campaign list (for the campaigns management page).
 */
const useCampaignStore = create((set, get) => ({
  /* ── Wizard state ─────────────────────────────────────────── */
  wizardStep: 1,
  wizardData: {
    campaignName: '',
    targetImageFile: null,
    targetImageUrl: null,
    targetImagePublicId: null,
    targetImagePreview: null,
    videoFile: null,
    videoUrl: null,
    videoPublicId: null,
    videoPreview: null,
    // iOS-only side-by-side .mov (alpha on the right half). Optional but
    // recommended — without it, iPhone visitors see the WebM-fallback path
    // which renders a solid black background over the AR camera feed.
    videoFileIos: null,
    videoUrlIos: null,
    videoIosPublicId: null,
    videoPreviewIos: null,
    thumbnailUrl: null,
    qrDesign: defaultQrDesign(),
    qrPlacement: defaultQrPlacement(),
    linkRows: [],
    compositedPreviewUrl: null,
  },
  uploadProgress: { image: 0, video: 0, videoIos: 0, composited: 0 },
  isUploading: false,
  isSubmitting: false,
  wizardError: null,
  fulfillRequestId: null,
  fulfillRequestKind: 'ar-card',

  /* ── Campaign list state ──────────────────────────────────── */
  campaigns: [],
  pagination: null,
  listLoading: false,
  listError: null,

  /* ── Wizard actions ───────────────────────────────────────── */
  setWizardStep: (step) => set({ wizardStep: step }),

  updateWizardData: (patch) =>
    set((s) => ({ wizardData: { ...s.wizardData, ...patch } })),

  resetWizard: () => {
    const prev = get().wizardData;
    if (prev.compositedPreviewUrl?.startsWith?.('blob:')) {
      URL.revokeObjectURL(prev.compositedPreviewUrl);
    }
    if (prev.videoPreview?.startsWith?.('blob:')) {
      URL.revokeObjectURL(prev.videoPreview);
    }
    if (prev.videoPreviewIos?.startsWith?.('blob:')) {
      URL.revokeObjectURL(prev.videoPreviewIos);
    }
    set({
      wizardStep: 1,
      wizardData: {
        campaignName: '',
        targetImageFile: null,
        targetImageUrl: null,
        targetImagePublicId: null,
        targetImagePreview: null,
        videoFile: null,
        videoUrl: null,
        videoPublicId: null,
        videoPreview: null,
        videoFileIos: null,
        videoUrlIos: null,
        videoIosPublicId: null,
        videoPreviewIos: null,
        thumbnailUrl: null,
        qrDesign: defaultQrDesign(),
        qrPlacement: defaultQrPlacement(),
        linkRows: [],
        compositedPreviewUrl: null,
      },
      uploadProgress: { image: 0, video: 0, videoIos: 0, composited: 0 },
      isUploading: false,
      isSubmitting: false,
      wizardError: null,
      fulfillRequestId: null,
      fulfillRequestKind: 'ar-card',
    });
  },

  setFulfillRequestId: (id, requestKind = 'ar-card') =>
    set({ fulfillRequestId: id, fulfillRequestKind: requestKind }),

  uploadImage: async (file) => {
    set({ isUploading: true, wizardError: null });
    try {
      const result = await campaignService.uploadToCloudinary(
        file,
        'image',
        (pct) => set((s) => ({ uploadProgress: { ...s.uploadProgress, image: pct } }))
      );
      set((s) => ({
        wizardData: {
          ...s.wizardData,
          targetImageUrl: result.url,
          targetImagePublicId: result.publicId,
        },
        isUploading: false,
      }));
      return { success: true };
    } catch {
      set({ isUploading: false, wizardError: 'Image upload failed. Please try again.' });
      return { success: false };
    }
  },

  uploadVideo: async (file) => {
    set({ isUploading: true, wizardError: null });
    try {
      const result = await campaignService.uploadToCloudinary(
        file,
        'video',
        (pct) => set((s) => ({ uploadProgress: { ...s.uploadProgress, video: pct } }))
      );
      set((s) => ({
        wizardData: {
          ...s.wizardData,
          videoUrl: result.url,
          videoPublicId: result.publicId,
          thumbnailUrl: result.thumbnailUrl,
        },
        isUploading: false,
      }));
      return { success: true };
    } catch {
      set({ isUploading: false, wizardError: 'Video upload failed. Please try again.' });
      return { success: false };
    }
  },

  /**
   * uploadVideoIos — upload the iOS side-by-side .mov source.
   *
   * Kept separate from `uploadVideo` so progress / error states don't bleed
   * across the two drop zones and so a failed iOS upload never throws away
   * the already-uploaded WebM. Does not overwrite `thumbnailUrl` — the WebM
   * upload is the canonical thumbnail source.
   */
  uploadVideoIos: async (file) => {
    set({ isUploading: true, wizardError: null });
    try {
      const result = await campaignService.uploadToCloudinary(
        file,
        'video',
        (pct) => set((s) => ({ uploadProgress: { ...s.uploadProgress, videoIos: pct } }))
      );
      set((s) => ({
        wizardData: {
          ...s.wizardData,
          videoUrlIos: result.url,
          videoIosPublicId: result.publicId,
        },
        isUploading: false,
      }));
      return { success: true };
    } catch {
      set({
        isUploading: false,
        wizardError: 'iOS video upload failed. Please try again.',
      });
      return { success: false };
    }
  },

  /**
   * submitCampaign — create ar-card, composite QR with real AR URL, upload, PATCH marker.
   */
  submitCampaign: async () => {
    const { wizardData } = get();
    set({ isSubmitting: true, wizardError: null });
    try {
      const linkItems = wizardData.linkRows?.length
        ? rowsToApiLinkItems(wizardData.linkRows)
        : [];

      const campaign = await campaignService.createCampaign({
        campaignType: 'ar-card',
        campaignName: wizardData.campaignName,
        targetImageUrl: wizardData.targetImageUrl,
        targetImagePublicId: wizardData.targetImagePublicId,
        targetImageOriginalUrl: wizardData.targetImageUrl,
        targetImageOriginalPublicId: wizardData.targetImagePublicId,
        videoUrl: wizardData.videoUrl,
        videoPublicId: wizardData.videoPublicId,
        videoUrlIos: wizardData.videoUrlIos || undefined,
        videoIosPublicId: wizardData.videoIosPublicId || undefined,
        thumbnailUrl: wizardData.thumbnailUrl,
        linkItems: linkItems.length ? linkItems : undefined,
        qrDesign: wizardData.qrDesign,
        qrPlacement: wizardData.qrPlacement,
      });

      const arUrl = buildArExperienceUrl(campaign._id);
      const imageSrc = wizardData.targetImagePreview || wizardData.targetImageUrl;
      const blob = await compositeQrOnCardImage({
        imageSrc,
        qrDataString: arUrl,
        placement: wizardData.qrPlacement,
        qrDesign: wizardData.qrDesign,
      });

      const file = new File([blob], 'card-with-qr.png', { type: 'image/png' });
      const upload = await campaignService.uploadToCloudinary(
        file,
        'image',
        (pct) => set((s) => ({ uploadProgress: { ...s.uploadProgress, composited: pct } }))
      );

      const updated = await campaignService.updateCampaign(campaign._id, {
        targetImageUrl: upload.url,
        targetImagePublicId: upload.publicId,
      });

      const safeName = String(wizardData.campaignName || 'ar-card')
        .replace(/[/\\?%*:|"<>]/g, '-')
        .slice(0, 60);
      downloadImageBlob(blob, `${safeName}-print.png`);

      set({ isSubmitting: false });
      return { success: true, campaign: updated };
    } catch (err) {
      const d = err?.response?.data;
      const validationErrors = d?.errors;
      const validationMessage = Array.isArray(validationErrors) && validationErrors.length
        ? validationErrors.map((e) => e?.message).filter(Boolean).join(' ')
        : '';
      let message =
        validationMessage
        || d?.message
        || err?.message
        || 'Failed to create campaign';
      if (err?.code === 'ECONNABORTED' || err?.message?.includes?.('timeout')) {
        message = 'Request timed out. Check your connection and try again on Wi‑Fi if possible.';
      }
      if (err?.isBadApiResponse) {
        message =
          'The app could not reach the API (received HTML instead of JSON). If you are on mobile, set VITE_API_URL to your backend URL in production.';
      }
      set({ isSubmitting: false, wizardError: message });
      return { success: false, message };
    }
  },

  /**
   * submitFulfillRequest — admin fulfills an AR service request for the owning user.
   */
  submitFulfillRequest: async (requestId) => {
    const { wizardData } = get();
    set({ isSubmitting: true, wizardError: null });
    try {
      const { fulfillRequestKind } = get();
      const campaignType = fulfillRequestKind || 'ar-card';
      const assetNoun = campaignType === 'ar-poster' ? 'poster' : 'card';

      if (!wizardData.targetImageUrl) {
        throw new Error(`User ${assetNoun} image is missing on this request.`);
      }
      if (
        !wizardData.qrPlacement
        || typeof wizardData.qrPlacement.x !== 'number'
        || typeof wizardData.qrPlacement.y !== 'number'
      ) {
        throw new Error('User QR placement is missing on this request.');
      }
      if (!wizardData.videoUrl || !wizardData.videoUrlIos) {
        throw new Error('Upload both WebM and iOS .mov videos before publishing.');
      }

      const linkItems = wizardData.linkRows?.length
        ? rowsToApiLinkItems(wizardData.linkRows, { omitLinkIds: true })
        : [];

      const payload = {
        campaignType,
        campaignName: wizardData.campaignName,
        targetImageUrl: wizardData.targetImageUrl,
        targetImagePublicId: wizardData.targetImagePublicId,
        targetImageOriginalUrl: wizardData.targetImageUrl,
        targetImageOriginalPublicId: wizardData.targetImagePublicId,
        videoUrl: wizardData.videoUrl,
        videoPublicId: wizardData.videoPublicId || undefined,
        videoUrlIos: wizardData.videoUrlIos || undefined,
        videoIosPublicId: wizardData.videoIosPublicId || undefined,
        thumbnailUrl: wizardData.thumbnailUrl || undefined,
        linkItems: linkItems.length ? linkItems : undefined,
        qrDesign: wizardData.qrDesign,
        qrPlacement: wizardData.qrPlacement,
      };

      const result = await adminService.fulfillArServiceRequest(requestId, payload);
      const campaign = result.campaign;
      const campaignId = campaign?._id;

      const arUrl = buildArExperienceUrl(campaignId);
      const imageSrc = wizardData.targetImagePreview || wizardData.targetImageUrl;
      const blob = await compositeQrOnCardImage({
        imageSrc,
        qrDataString: arUrl,
        placement: wizardData.qrPlacement,
        qrDesign: wizardData.qrDesign,
      });

      const file = new File([blob], 'card-with-qr.png', { type: 'image/png' });
      const upload = await campaignService.uploadToCloudinary(
        file,
        'image',
        (pct) => set((s) => ({ uploadProgress: { ...s.uploadProgress, composited: pct } }))
      );

      await adminService.patchArCampaignAssets(campaignId, {
        targetImageUrl: upload.url,
        targetImagePublicId: upload.publicId,
      });

      set({ isSubmitting: false });
      return { success: true, campaign };
    } catch (err) {
      const d = err?.response?.data;
      const validationErrors = d?.errors;
      const validationMessage = Array.isArray(validationErrors) && validationErrors.length
        ? validationErrors.map((e) => e?.message).filter(Boolean).join(' ')
        : '';
      const message =
        validationMessage
        || d?.message
        || err?.message
        || 'Failed to fulfill request';
      set({ isSubmitting: false, wizardError: message });
      return { success: false, message };
    }
  },

  /* ── Campaign list actions ────────────────────────────────── */
  fetchCampaigns: async (params) => {
    set({ listLoading: true, listError: null });
    try {
      const data = await campaignService.getCampaigns(params);
      const page = Number(params?.page || 1);
      set((s) => {
        if (page <= 1) {
          return {
            campaigns: data.campaigns,
            pagination: data.pagination,
            listLoading: false,
          };
        }

        const seen = new Set(s.campaigns.map((c) => String(c._id)));
        const appended = [...s.campaigns];
        for (const row of data.campaigns || []) {
          const id = String(row?._id || '');
          if (!id || seen.has(id)) continue;
          seen.add(id);
          appended.push(row);
        }

        return {
          campaigns: appended,
          pagination: data.pagination,
          listLoading: false,
        };
      });
    } catch (err) {
      set({ listLoading: false, listError: err.response?.data?.message || 'Failed to load campaigns' });
    }
  },

  updateCampaignInList: async (id, updates) => {
    set((s) => ({
      campaigns: s.campaigns.map((c) =>
        (c._id === id ? { ...c, ...updates } : c)
      ),
    }));
    try {
      const updated = await campaignService.updateCampaign(id, updates);
      set((s) => ({
        campaigns: s.campaigns.map((c) => (c._id === id ? updated : c)),
      }));
      return { success: true, campaign: updated };
    } catch {
      get().fetchCampaigns();
      return { success: false, message: 'Update failed' };
    }
  },

  removeCampaignFromList: async (id) => {
    try {
      await campaignService.deleteCampaign(id);
      set((s) => ({
        campaigns: s.campaigns.filter((c) => c._id !== id),
        pagination: s.pagination
          ? {
            ...s.pagination,
            total: Math.max(0, s.pagination.total - 1),
            pages: Math.max(1, Math.ceil(Math.max(0, s.pagination.total - 1) / s.pagination.limit)),
          }
          : s.pagination,
      }));
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Delete failed' };
    }
  },

  duplicateCampaignInList: async (id) => {
    try {
      const copy = await campaignService.duplicateCampaign(id);
      set((s) => ({ campaigns: [copy, ...s.campaigns] }));
      return { success: true, campaign: copy };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Duplicate failed' };
    }
  },
}));

export default useCampaignStore;
