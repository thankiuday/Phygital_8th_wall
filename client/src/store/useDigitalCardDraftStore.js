import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TEMPLATE_BY_ID } from '../components/card/cardTemplates';
import { DEFAULT_CARD_SIZE } from '../components/card/cardSizes';

/**
 * useDigitalCardDraftStore — local-only draft for the Digital Business Card
 * wizard. Persists to localStorage so a closed tab / dropped connection /
 * accidental refresh doesn't cost the user their work.
 *
 * Persistence is wizard-scoped: once a card is saved server-side, the
 * dashboard reads from the campaign API and we drop the draft.
 *
 * Caveats:
 * • We never persist `File` blobs (binary). When a user uploads a profile
 *   image we keep an `objectURL` in memory for preview and persist only the
 *   resolved Cloudinary URL/public_id once upload finishes.
 * • Sections are an ordered array; new ids come from `nanoid` so reorders
 *   stay stable across renders.
 */

const STORAGE_KEY = 'card-draft-v1';

const defaultTemplate = TEMPLATE_BY_ID.professional;

const emptyDraft = () => ({
  step: 0, // 0 = Name, 1 = Content, 2 = Design, 3 = Publish, 4 = Print
  campaignName: '',
  cardSlug: '',
  cardSlugAvailability: { state: 'idle', available: null, lastChecked: '' },
  visibility: 'public',
  qrDesign: null,
  // Content
  cardContent: {
    fullName: '',
    jobTitle: '',
    company: '',
    bio: '',
    profileImageUrl: null,
    profileImagePublicId: null,
    profileImagePreview: null,
    bannerImageUrl: null,
    bannerImagePublicId: null,
    bannerImagePreview: null,
    contact: { phone: '', email: '', whatsapp: '', website: '' },
    social: {},
    sections: [],
  },
  // Design
  cardDesign: {
    template: defaultTemplate.id,
    colors: { ...defaultTemplate.colors },
    font: defaultTemplate.font,
    layout: defaultTemplate.layout,
    corners: defaultTemplate.corners,
    spacing: defaultTemplate.spacing,
  },
  // Print
  cardPrintSettings: {
    cardSize: DEFAULT_CARD_SIZE,
    theme: 'white',
    qrPosition: 'bottom-right',
    includeQr: true,
    displayFields: ['name', 'jobTitle', 'company', 'phone', 'email', 'website'],
    profileZoom: 1,
    profileCropX: 50,
    profileCropY: 50,
  },
  // Publish state
  savedCampaignId: null,
  savedCardSlug: null,
  qrUrl: null,
  publicUrl: null,
  // Print state (last known render result)
  lastRender: null, // { url, public_id, status, jobId }
});

const useDigitalCardDraftStore = create(
  persist(
    (set, get) => ({
      ...emptyDraft(),

      setStep: (step) => set({ step }),

      setCampaignName: (name) => set({ campaignName: name }),

      setSlug: (cardSlug) => set({
        cardSlug,
        cardSlugAvailability: { state: 'idle', available: null, lastChecked: '' },
      }),

      setSlugAvailability: (payload) => set({ cardSlugAvailability: payload }),

      setVisibility: (visibility) => set({ visibility }),

      setQrDesign: (qrDesign) => set({ qrDesign }),

      patchContent: (patch) =>
        set((s) => ({ cardContent: { ...s.cardContent, ...patch } })),

      patchContact: (patch) =>
        set((s) => ({
          cardContent: { ...s.cardContent, contact: { ...s.cardContent.contact, ...patch } },
        })),

      patchSocial: (patch) =>
        set((s) => ({
          cardContent: { ...s.cardContent, social: { ...s.cardContent.social, ...patch } },
        })),

      setSections: (sections) =>
        set((s) => ({ cardContent: { ...s.cardContent, sections } })),

      addSection: (section) =>
        set((s) => ({
          cardContent: { ...s.cardContent, sections: [...s.cardContent.sections, section] },
        })),

      updateSection: (id, patch) =>
        set((s) => ({
          cardContent: {
            ...s.cardContent,
            sections: s.cardContent.sections.map((sec) =>
              sec.id === id ? { ...sec, ...patch } : sec
            ),
          },
        })),

      removeSection: (id) =>
        set((s) => ({
          cardContent: {
            ...s.cardContent,
            sections: s.cardContent.sections.filter((sec) => sec.id !== id),
          },
        })),

      reorderSections: (fromIndex, toIndex) =>
        set((s) => {
          const arr = [...s.cardContent.sections];
          const [moved] = arr.splice(fromIndex, 1);
          arr.splice(toIndex, 0, moved);
          return { cardContent: { ...s.cardContent, sections: arr } };
        }),

      patchDesign: (patch) =>
        set((s) => ({ cardDesign: { ...s.cardDesign, ...patch } })),

      patchPrint: (patch) =>
        set((s) => ({ cardPrintSettings: { ...s.cardPrintSettings, ...patch } })),

      applyTemplate: (templateId) => {
        const tpl = TEMPLATE_BY_ID[templateId];
        if (!tpl) return;
        set((s) => ({
          cardDesign: {
            ...s.cardDesign,
            template: tpl.id,
            colors: { ...tpl.colors },
            font: tpl.font,
            layout: tpl.layout,
            corners: tpl.corners,
            spacing: tpl.spacing,
          },
        }));
      },

      setSavedCampaign: ({ campaignId, cardSlug, qrUrl, publicUrl }) =>
        set({
          savedCampaignId: campaignId,
          savedCardSlug: cardSlug,
          qrUrl: qrUrl || null,
          publicUrl: publicUrl || null,
        }),

      setLastRender: (render) => set({ lastRender: render }),

      reset: () => set(emptyDraft()),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist the wizard contents, not transient UI feedback.
      partialize: (state) => ({
        step: state.step,
        campaignName: state.campaignName,
        cardSlug: state.cardSlug,
        visibility: state.visibility,
        qrDesign: state.qrDesign,
        cardContent: {
          ...state.cardContent,
          // strip transient previews so we don't bloat localStorage with blob URLs
          profileImagePreview: null,
          bannerImagePreview: null,
        },
        cardDesign: state.cardDesign,
        cardPrintSettings: state.cardPrintSettings,
        savedCampaignId: state.savedCampaignId,
        savedCardSlug: state.savedCardSlug,
        qrUrl: state.qrUrl,
        publicUrl: state.publicUrl,
      }),
      version: 1,
    }
  )
);

export default useDigitalCardDraftStore;
export { emptyDraft };
