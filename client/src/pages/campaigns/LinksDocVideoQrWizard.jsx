import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../../store/useAuthStore';
import useGuestCampaignDraftStore, { GUEST_DRAFT_TYPES } from '../../store/useGuestCampaignDraftStore';
import WizardStepBar from '../../components/ui/WizardStepBar';
import { campaignService } from '../../services/campaignService';
import { DEFAULT_DESIGN, hydrateWizardDesignFromDraft } from '../../components/qr/qrDesignModel';
import Step2DesignQr from './single-link/Step2DesignQr';
import Step1LinksDocVideo from './links-doc-video/Step1LinksDocVideo';
import { createDocSlot, createVideoSlot } from './links-doc-video/linksDocVideoFormUtils';

const STEPS = [
  { number: 1, shortLabel: 'Details', label: 'Enter Details' },
  { number: 2, shortLabel: 'Design', label: 'Design QR' },
];

const resolveRedirectBase = () => {
  if (import.meta.env.VITE_REDIRECT_BASE) {
    return String(import.meta.env.VITE_REDIRECT_BASE).replace(/\/$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).replace(/\/api\/?$/, '').replace(/\/$/, '');
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
};

const resolveClientAppBase = () => {
  const fromEnv =
    import.meta.env.VITE_APP_URL && String(import.meta.env.VITE_APP_URL).replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return typeof window !== 'undefined' ? window.location.origin : '';
};

const REDIRECT_SLUG_ALPHABET = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const generatePreviewSlug = () => {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(8);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => REDIRECT_SLUG_ALPHABET[b % REDIRECT_SLUG_ALPHABET.length]).join('');
  }
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += REDIRECT_SLUG_ALPHABET[Math.floor(Math.random() * REDIRECT_SLUG_ALPHABET.length)];
  }
  return out;
};

const seedCampaignName = (user) => {
  const firstName = user?.name?.split(' ')[0] || 'My';
  const suffix = String(Date.now()).slice(-4);
  return `${firstName}'s Links + Doc + Video QR-${suffix}`;
};

const LinksDocVideoQrWizard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();
  const {
    setDraft,
    getDraft,
    clearDraft,
    setContinuation,
  } = useGuestCampaignDraftStore();

  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [videoSource, setVideoSource] = useState('upload');
  // Keep slot state at the wizard level so step navigation preserves uploads.
  const [videoSlots, setVideoSlots] = useState([createVideoSlot()]);
  const [docSlots, setDocSlots] = useState([createDocSlot()]);
  const [linkRows, setLinkRows] = useState([]);
  const [stagedPayload, setStagedPayload] = useState(null);
  const [design, setDesign] = useState(DEFAULT_DESIGN);
  const [redirectSlug] = useState(() => generatePreviewSlug());
  const [preciseGeoAnalytics, setPreciseGeoAnalytics] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [draftNotice, setDraftNotice] = useState('');
  const isPublicRoute = !location.pathname.startsWith('/dashboard');

  useEffect(() => {
    const saved = getDraft(GUEST_DRAFT_TYPES.linksDocVideo);
    if (saved) {
      setStep(saved.step || 1);
      setCampaignName(saved.campaignName || '');
      setVideoSource(saved.videoSource || 'upload');
      setVideoSlots(saved.videoSlots?.length ? saved.videoSlots : [createVideoSlot()]);
      setDocSlots(saved.docSlots?.length ? saved.docSlots : [createDocSlot()]);
      setLinkRows(saved.linkRows || []);
      setStagedPayload(saved.stagedPayload || null);
      setDesign(hydrateWizardDesignFromDraft(saved.design));
      setPreciseGeoAnalytics(!!saved.preciseGeoAnalytics);
      if (saved.campaignName && saved.seededCampaignName && saved.campaignName === saved.seededCampaignName && user) {
        setCampaignName(seedCampaignName(user));
      }
      setDraftNotice('Draft restored.');
      return;
    }
    setCampaignName(seedCampaignName(user));
  }, [getDraft, user]);

  useEffect(() => {
    if (isAuthenticated) return;
    setDraft(GUEST_DRAFT_TYPES.linksDocVideo, {
      type: GUEST_DRAFT_TYPES.linksDocVideo,
      sourceRoute: location.pathname,
      requiresAuthToPublish: true,
      step,
      campaignName,
      seededCampaignName: seedCampaignName(user),
      videoSource,
      videoSlots,
      docSlots,
      linkRows,
      stagedPayload,
      design,
      preciseGeoAnalytics,
    });
  }, [
    campaignName,
    design,
    docSlots,
    isAuthenticated,
    linkRows,
    location.pathname,
    preciseGeoAnalytics,
    setDraft,
    stagedPayload,
    step,
    user,
    videoSlots,
    videoSource,
  ]);

  const redirectBase = useMemo(resolveRedirectBase, []);
  const clientAppBase = useMemo(resolveClientAppBase, []);
  const encodedData = useMemo(
    () =>
      preciseGeoAnalytics
        ? `${clientAppBase}/open/${redirectSlug}`
        : `${redirectBase}/r/${redirectSlug}`,
    [redirectBase, clientAppBase, preciseGeoAnalytics, redirectSlug]
  );

  const handleStep1Continue = (payload) => {
    setStagedPayload(payload);
    setStep(2);
  };

  const handleSubmit = async (qrDesignPayload) => {
    if (!stagedPayload) return;
    if (!isAuthenticated) {
      setDraft(GUEST_DRAFT_TYPES.linksDocVideo, {
        type: GUEST_DRAFT_TYPES.linksDocVideo,
        sourceRoute: location.pathname,
        requiresAuthToPublish: true,
        step: 2,
        campaignName,
        seededCampaignName: seedCampaignName(user),
        videoSource,
        videoSlots,
        docSlots,
        linkRows,
        stagedPayload,
        design: qrDesignPayload,
        preciseGeoAnalytics,
      });
      const authMessage = 'Your work is saved. Login/Register and come back to continue.';
      setContinuation({
        continueTo: location.pathname,
        draftType: GUEST_DRAFT_TYPES.linksDocVideo,
        message: authMessage,
      });
      navigate('/login', {
        replace: true,
        state: {
          continueTo: location.pathname,
          draftType: GUEST_DRAFT_TYPES.linksDocVideo,
          authMessage,
        },
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const campaign = await campaignService.createLinksDocVideoCampaign({
        ...stagedPayload,
        qrDesign: qrDesignPayload,
        redirectSlug,
      });
      clearDraft(GUEST_DRAFT_TYPES.linksDocVideo);
      navigate(`/dashboard/campaigns/${campaign._id}`);
    } catch (err) {
      const validationErrors = err?.response?.data?.errors;
      const validationMessage = Array.isArray(validationErrors) && validationErrors.length
        ? validationErrors.map((e) => e?.message).filter(Boolean).join(' ')
        : '';
      const message =
        validationMessage
        || err?.response?.data?.message
        || 'Failed to create campaign. Please try again.';
      setSubmitError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`mx-auto max-w-5xl min-w-0 overflow-x-hidden px-4 sm:px-6 ${isPublicRoute ? 'pt-[calc(var(--navbar-height)+1rem)] sm:pt-[calc(var(--navbar-height)+1.5rem)] pb-6' : ''}`}
    >
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Links + Doc + Video QR</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          One QR opens your branded hub with multiple videos, documents, and the links visitors
          tap most. Track scans, doc opens, plays, and clicks separately.
        </p>
      </div>

      <WizardStepBar steps={STEPS} currentStep={step} className="mb-8" />
      {draftNotice && (
        <p className="mb-3 text-xs font-medium text-emerald-400">{draftNotice}</p>
      )}

      <div className="glass-card min-w-0 max-w-full overflow-hidden p-4 md:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {step === 1 ? (
              <Step1LinksDocVideo
                isAuthenticated={isAuthenticated}
                campaignName={campaignName}
                onCampaignNameChange={setCampaignName}
                onRegenerateName={() => setCampaignName(seedCampaignName(user))}
                videoSource={videoSource}
                onVideoSourceChange={setVideoSource}
                videoSlots={videoSlots}
                onVideoSlotsChange={setVideoSlots}
                docSlots={docSlots}
                onDocSlotsChange={setDocSlots}
                linkRows={linkRows}
                onLinkRowsChange={setLinkRows}
                preciseGeoAnalytics={preciseGeoAnalytics}
                onPreciseGeoAnalyticsChange={setPreciseGeoAnalytics}
                onContinue={handleStep1Continue}
              />
            ) : (
              <Step2DesignQr
                design={design}
                onDesignChange={setDesign}
                encodedData={encodedData}
                onBack={() => setStep(1)}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                submitError={submitError}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LinksDocVideoQrWizard;
