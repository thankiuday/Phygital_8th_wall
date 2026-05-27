import { create } from 'zustand';
import { campaignService } from '../services/campaignService';
import { arServiceRequestService } from '../services/arServiceRequestService';
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

const useArServiceRequestStore = create((set, get) => ({
  requestKind: 'ar-card',
  wizardStep: 1,
  wizardData: {
    targetImageFile: null,
    targetImageUrl: null,
    targetImagePublicId: null,
    targetImagePreview: null,
    greenscreenVideoFile: null,
    greenscreenVideoUrl: null,
    greenscreenVideoPublicId: null,
    greenscreenVideoPreview: null,
    qrDesign: defaultQrDesign(),
    qrPlacement: defaultQrPlacement(),
    linkRows: [],
    compositedPreviewUrl: null,
    userNotes: '',
  },
  uploadProgress: { image: 0, video: 0 },
  isUploading: false,
  isSubmitting: false,
  wizardError: null,
  submittedRequest: null,

  setRequestKind: (requestKind) => set({ requestKind: requestKind || 'ar-card' }),

  setWizardStep: (step) => set({ wizardStep: step }),

  updateWizardData: (patch) =>
    set((s) => ({ wizardData: { ...s.wizardData, ...patch } })),

  resetWizard: () => {
    const prev = get().wizardData;
    if (prev.compositedPreviewUrl?.startsWith?.('blob:')) {
      URL.revokeObjectURL(prev.compositedPreviewUrl);
    }
    if (prev.greenscreenVideoPreview?.startsWith?.('blob:')) {
      URL.revokeObjectURL(prev.greenscreenVideoPreview);
    }
    if (prev.targetImagePreview?.startsWith?.('blob:')) {
      URL.revokeObjectURL(prev.targetImagePreview);
    }
    set({
      wizardStep: 1,
      wizardData: {
        targetImageFile: null,
        targetImageUrl: null,
        targetImagePublicId: null,
        targetImagePreview: null,
        greenscreenVideoFile: null,
        greenscreenVideoUrl: null,
        greenscreenVideoPublicId: null,
        greenscreenVideoPreview: null,
        qrDesign: defaultQrDesign(),
        qrPlacement: defaultQrPlacement(),
        linkRows: [],
        compositedPreviewUrl: null,
        userNotes: '',
      },
      uploadProgress: { image: 0, video: 0 },
      isUploading: false,
      isSubmitting: false,
      wizardError: null,
      submittedRequest: null,
    });
  },

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

  uploadGreenscreenVideo: async (file) => {
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
          greenscreenVideoUrl: result.url,
          greenscreenVideoPublicId: result.publicId,
        },
        isUploading: false,
      }));
      return { success: true };
    } catch {
      set({ isUploading: false, wizardError: 'Video upload failed. Please try again.' });
      return { success: false };
    }
  },

  submitRequest: async () => {
    const { wizardData } = get();
    set({ isSubmitting: true, wizardError: null });
    try {
      const linkItems = wizardData.linkRows?.length
        ? rowsToApiLinkItems(wizardData.linkRows)
        : undefined;

      const { requestKind } = get();

      const result = await arServiceRequestService.createRequest({
        requestKind,
        targetImageUrl: wizardData.targetImageUrl,
        targetImagePublicId: wizardData.targetImagePublicId,
        qrPlacement: wizardData.qrPlacement,
        greenscreenVideoUrl: wizardData.greenscreenVideoUrl,
        greenscreenVideoPublicId: wizardData.greenscreenVideoPublicId,
        linkItems,
        userNotes: wizardData.userNotes?.trim() || undefined,
      });

      set({ isSubmitting: false, submittedRequest: result.request });
      return { success: true, ...result };
    } catch (err) {
      const message =
        err?.response?.data?.message || err?.message || 'Failed to submit request';
      set({ isSubmitting: false, wizardError: message });
      return { success: false, message };
    }
  },
}));

export default useArServiceRequestStore;
