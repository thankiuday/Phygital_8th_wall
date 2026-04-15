import { create } from 'zustand';
import { campaignService } from '../services/campaignService';

/**
 * useCampaignStore — manages the campaign creation wizard state
 * AND the campaign list (for the campaigns management page).
 */
const useCampaignStore = create((set, get) => ({
  /* ── Wizard state ─────────────────────────────────────────── */
  wizardStep: 1,        // 1 – 4
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
    thumbnailUrl: null,
  },
  uploadProgress: { image: 0, video: 0 },
  isUploading: false,
  isSubmitting: false,
  wizardError: null,

  /* ── Campaign list state ──────────────────────────────────── */
  campaigns: [],
  pagination: null,
  listLoading: false,
  listError: null,

  /* ── Wizard actions ───────────────────────────────────────── */
  setWizardStep: (step) => set({ wizardStep: step }),

  updateWizardData: (patch) =>
    set((s) => ({ wizardData: { ...s.wizardData, ...patch } })),

  resetWizard: () =>
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
        thumbnailUrl: null,
      },
      uploadProgress: { image: 0, video: 0 },
      isUploading: false,
      isSubmitting: false,
      wizardError: null,
    }),

  /**
   * uploadImage — uploads the target card image to Cloudinary.
   * Called when the user confirms their selection in Step 2.
   */
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
    } catch (err) {
      set({ isUploading: false, wizardError: 'Image upload failed. Please try again.' });
      return { success: false };
    }
  },

  /**
   * uploadVideo — uploads the intro video to Cloudinary.
   * Called when the user confirms their selection in Step 3.
   */
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
    } catch (err) {
      set({ isUploading: false, wizardError: 'Video upload failed. Please try again.' });
      return { success: false };
    }
  },

  /**
   * submitCampaign — sends the finalised wizard data to the API.
   */
  submitCampaign: async () => {
    const { wizardData } = get();
    set({ isSubmitting: true, wizardError: null });
    try {
      const campaign = await campaignService.createCampaign({
        campaignName: wizardData.campaignName,
        targetImageUrl: wizardData.targetImageUrl,
        targetImagePublicId: wizardData.targetImagePublicId,
        videoUrl: wizardData.videoUrl,
        videoPublicId: wizardData.videoPublicId,
        thumbnailUrl: wizardData.thumbnailUrl,
      });
      set({ isSubmitting: false });
      return { success: true, campaign };
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to create campaign';
      set({ isSubmitting: false, wizardError: message });
      return { success: false, message };
    }
  },

  /* ── Campaign list actions ────────────────────────────────── */
  fetchCampaigns: async (params) => {
    set({ listLoading: true, listError: null });
    try {
      const data = await campaignService.getCampaigns(params);
      set({ campaigns: data.campaigns, pagination: data.pagination, listLoading: false });
    } catch (err) {
      set({ listLoading: false, listError: err.response?.data?.message || 'Failed to load campaigns' });
    }
  },

  /** Optimistically update a campaign in the list, then sync with the API. */
  updateCampaignInList: async (id, updates) => {
    // Optimistic update
    set((s) => ({
      campaigns: s.campaigns.map((c) =>
        c._id === id ? { ...c, ...updates } : c
      ),
    }));
    try {
      const updated = await campaignService.updateCampaign(id, updates);
      set((s) => ({
        campaigns: s.campaigns.map((c) => (c._id === id ? updated : c)),
      }));
      return { success: true, campaign: updated };
    } catch (err) {
      // Revert on failure — refetch the list
      get().fetchCampaigns();
      return { success: false, message: err.response?.data?.message || 'Update failed' };
    }
  },

  /** Removes a campaign from the list after successful delete. */
  removeCampaignFromList: async (id) => {
    try {
      await campaignService.deleteCampaign(id);
      set((s) => ({ campaigns: s.campaigns.filter((c) => c._id !== id) }));
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Delete failed' };
    }
  },

  /** Duplicates a campaign and prepends the copy to the list. */
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
