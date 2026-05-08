import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ChevronLeft } from 'lucide-react';
import { createPortal } from 'react-dom';

import useAuthStore from '../../store/useAuthStore';
import useDigitalCardDraftStore from '../../store/useDigitalCardDraftStore';
import WizardStepBar from '../../components/ui/WizardStepBar';
import BusinessCardLivePreview from '../../components/card/BusinessCardLivePreview';
import BusinessCardPrintPreview from '../../components/card/BusinessCardPrintPreview';
import Step0Name from './digital-business-card/Step0Name';
import Step1Content from './digital-business-card/Step1Content';
import Step2Design from './digital-business-card/Step2Design';
import Step3Publish from './digital-business-card/Step3Publish';
import Step4Print from './digital-business-card/Step4Print';

const STEPS = [
  { number: 0, shortLabel: 'Name',     label: 'Name your card' },
  { number: 1, shortLabel: 'Content',  label: 'Profile & info' },
  { number: 2, shortLabel: 'Design',   label: 'Style & theme' },
  { number: 3, shortLabel: 'Publish',  label: 'URL & QR code' },
  { number: 4, shortLabel: 'Print',    label: 'Download card' },
];

const seedCardName = (user) => {
  const first = user?.name?.split(' ')[0] || 'My';
  const suffix = String(Date.now()).slice(-4);
  return `${first}'s Digital Business Card-${suffix}`;
};

/**
 * DigitalBusinessCardWizard — composes the 5 wizard steps with a shared
 * live preview. Persists draft state to localStorage via
 * `useDigitalCardDraftStore`, so a refresh / dropped connection does not
 * cost the user their work.
 *
 * Layout
 *  • lg (≥1024px): two-column with sticky preview on the right.
 *  • <lg          : preview collapses into a togglable bottom drawer.
 */
const DigitalBusinessCardWizard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const draft = useDigitalCardDraftStore();
  const [previewOpen, setPreviewOpen] = useState(false);
  // Print-preview face toggle (front | back). Local state — never persisted,
  // since it's purely a UI affordance for Step 4.
  const [printFace, setPrintFace] = useState('front');
  const canGoBack = draft.step > 0;

  // First-time visitors get an auto-seeded name. Don't clobber whatever the
  // user typed (or what's already saved in localStorage).
  useEffect(() => {
    if (!draft.campaignName) {
      draft.setCampaignName(seedCardName(user));
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (step) => draft.setStep(step);

  const finishWizard = () => {
    draft.reset();
    navigate('/dashboard/campaigns');
  };

  // Step 4 swaps the hub preview for a true printable-card preview (front +
  // back). The same `BusinessCardPrintPreview` drives the Puppeteer print
  // page, so what the user sees here is what the PNG will be.
  const renderPreviewBody = () => {
    if (draft.step === 4) {
      return (
        <div className="space-y-3">
          <div className="inline-flex w-full overflow-hidden rounded-full border border-[var(--border-color)] bg-[var(--surface-2)] text-[11px]">
            {[
              { id: 'front', label: 'Front' },
              { id: 'back', label: 'Back' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setPrintFace(f.id)}
                className={`flex-1 px-3 py-1.5 transition-colors ${
                  printFace === f.id
                    ? 'bg-brand-500 text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-3)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <BusinessCardPrintPreview
            content={draft.cardContent}
            design={draft.cardDesign}
            print={draft.cardPrintSettings}
            face={printFace}
            mode="preview"
            previewWidth={340}
            cardSlug={draft.savedCardSlug || draft.cardSlug}
          />
          <p className="text-[11px] text-[var(--text-muted)]">
            300 DPI, full bleed. Front and back render as two separate PNGs on download.
          </p>
        </div>
      );
    }
    return (
      <BusinessCardLivePreview
        content={draft.cardContent}
        design={draft.cardDesign}
        mode="preview"
      />
    );
  };

  const stepNode = useMemo(() => {
    switch (draft.step) {
      case 0:
        return (
          <Step0Name
            campaignName={draft.campaignName}
            onCampaignNameChange={draft.setCampaignName}
            onRegenerateName={() => draft.setCampaignName(seedCardName(user))}
            onContinue={() => goTo(1)}
          />
        );
      case 1:
        return (
          <Step1Content
            draft={draft}
            store={draft}
            onContinue={() => goTo(2)}
            onBack={() => goTo(0)}
          />
        );
      case 2:
        return (
          <Step2Design
            draft={draft}
            store={draft}
            onContinue={() => goTo(3)}
            onBack={() => goTo(1)}
          />
        );
      case 3:
        return (
          <Step3Publish
            draft={draft}
            store={draft}
            onContinue={() => goTo(4)}
            onBack={() => goTo(2)}
          />
        );
      case 4:
        return (
          <Step4Print
            draft={draft}
            store={draft}
            onBack={() => goTo(3)}
            onFinish={finishWizard}
          />
        );
      default:
        return null;
    }
  }, [draft.step, draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const mobileChrome = typeof window !== 'undefined'
    ? createPortal(
      <>
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-color)] bg-[var(--surface-1)]/95 p-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center gap-2">
            <button
              type="button"
              disabled={!canGoBack}
              onClick={() => canGoBack && goTo(draft.step - 1)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={16} />
              Back
            </button>
            <button
              type="button"
              onClick={() => setPreviewOpen((s) => !s)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-glow hover:bg-brand-400"
            >
              {previewOpen ? <EyeOff size={14} /> : <Eye size={14} />}
              {previewOpen ? 'Hide preview' : 'Live preview'}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {previewOpen && (
            <>
              <motion.button
                type="button"
                aria-label="Close preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setPreviewOpen(false)}
                className="fixed inset-0 z-40 bg-black/60 lg:hidden"
              />
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="fixed inset-x-3 top-[8vh] z-50 max-h-[80vh] overflow-auto rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4 shadow-2xl lg:hidden"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {draft.step === 4 ? 'Print Preview' : 'Live Preview'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(false)}
                    className="rounded-md border border-[var(--border-color)] px-2 py-1 text-xs text-[var(--text-secondary)]"
                  >
                    Close
                  </button>
                </div>
                {renderPreviewBody()}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>,
      document.body
    )
    : null;

  return (
    <div className="mx-auto max-w-7xl min-w-0 overflow-x-hidden pb-24 lg:pb-0">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Personalized Identity Card</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Build a beautiful digital business card. Live preview updates as you type. Auto-saves locally.
        </p>
      </div>

      <WizardStepBar steps={STEPS} currentStep={draft.step} className="mb-6" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left: form */}
        <div className="glass-card min-w-0 p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={draft.step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {stepNode}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right: sticky live preview (lg+) */}
        <div className="hidden min-w-0 lg:block">
          <div className="sticky top-24 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {draft.step === 4 ? 'Print Preview' : 'Live Preview'}
            </div>
            {renderPreviewBody()}
            {draft.step !== 4 && (
              <p className="text-[11px] text-[var(--text-muted)]">
                This page auto-saves to your browser — if you lose connection or close the tab, your work is restored when you come back.
              </p>
            )}
          </div>
        </div>
      </div>

      {mobileChrome}
    </div>
  );
};

export default DigitalBusinessCardWizard;
