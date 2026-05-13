import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const GUEST_DRAFT_TYPES = Object.freeze({
  singleLink: 'single-link',
  multipleLinks: 'multiple-links',
  linksVideo: 'links-video',
  linksDocVideo: 'links-doc-video',
});

const STORAGE_KEY = 'guest-campaign-drafts-v1';

const useGuestCampaignDraftStore = create(
  persist(
    (set, get) => ({
      drafts: {},
      continuation: null,

      setDraft: (type, payload) => set((state) => ({
        drafts: {
          ...state.drafts,
          [type]: {
            ...payload,
            updatedAt: Date.now(),
          },
        },
      })),

      getDraft: (type) => get().drafts?.[type] || null,

      getDrafts: () => get().drafts || {},

      clearDraft: (type) => set((state) => {
        const next = { ...state.drafts };
        delete next[type];
        return { drafts: next };
      }),

      setContinuation: (continuation) => set({ continuation }),

      getContinuation: () => get().continuation,

      consumeContinuation: () => {
        const current = get().continuation;
        set({ continuation: null });
        return current;
      },

      clearContinuation: () => set({ continuation: null }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useGuestCampaignDraftStore;
