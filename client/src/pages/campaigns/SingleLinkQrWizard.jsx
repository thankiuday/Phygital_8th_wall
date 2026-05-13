import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../../store/useAuthStore';
import useGuestCampaignDraftStore, { GUEST_DRAFT_TYPES } from '../../store/useGuestCampaignDraftStore';
import WizardStepBar from '../../components/ui/WizardStepBar';
import { campaignService } from '../../services/campaignService';
import { DEFAULT_DESIGN, hydrateWizardDesignFromDraft } from '../../components/qr/qrDesignModel';
import Step1LinkDetails from './single-link/Step1LinkDetails';
import Step2DesignQr from './single-link/Step2DesignQr';
import { slugifyCampaignNamePreview } from '../../utils/hubVanityPreview';

const STEPS = [
  { number: 1, shortLabel: 'Details', label: 'Enter Details' },
  { number: 2, shortLabel: 'Design',  label: 'Design QR' },
];

/**
 * QR preview data URL: guest / no-handle uses a random `/open/:previewSlug`;
 * logged-in precise-geo uses a non-binding `/open/:handle/:slugPreview` (final
 * hub segment comes from the server after create). Non–precise-geo uses `/r/:previewSlug`.
 */
const resolveRedirectBase = () => {
  if (import.meta.env.VITE_REDIRECT_BASE) {
    return String(import.meta.env.VITE_REDIRECT_BASE).replace(/\/$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).replace(/\/api\/?$/, '').replace(/\/$/, '');
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
};

/** SPA origin for `/open/:slug` QR payloads when precise geo is enabled */
const resolveClientAppBase = () => {
  const fromEnv = import.meta.env.VITE_APP_URL && String(import.meta.env.VITE_APP_URL).replace(/\/$/, '');
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
  return `${firstName}'s Single Link QR Campaign-${suffix}`;
};

const SingleLinkQrWizard = () => {
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
  const [destinationUrl, setDestinationUrl] = useState('');
  const [design, setDesign] = useState(DEFAULT_DESIGN);
  const [redirectSlug] = useState(() => generatePreviewSlug());
  const [preciseGeoAnalytics, setPreciseGeoAnalytics] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [draftNotice, setDraftNotice] = useState('');
  const isPublicRoute = !location.pathname.startsWith('/dashboard');

  useEffect(() => {
    const saved = getDraft(GUEST_DRAFT_TYPES.singleLink);
    if (saved) {
      setStep(saved.step || 1);
      setCampaignName(saved.campaignName || '');
      setDestinationUrl(saved.destinationUrl || '');
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
    setDraft(GUEST_DRAFT_TYPES.singleLink, {
      type: GUEST_DRAFT_TYPES.singleLink,
      sourceRoute: location.pathname,
      requiresAuthToPublish: true,
      step,
      campaignName,
      seededCampaignName: seedCampaignName(user),
      destinationUrl,
      design,
      preciseGeoAnalytics,
    });
  }, [
    campaignName,
    design,
    destinationUrl,
    isAuthenticated,
    location.pathname,
    preciseGeoAnalytics,
    setDraft,
    step,
    user,
  ]);

  const redirectBase = useMemo(resolveRedirectBase, []);
  const clientAppBase = useMemo(resolveClientAppBase, []);
  const encodedData = useMemo(() => {
    if (!preciseGeoAnalytics) {
      return `${redirectBase}/r/${redirectSlug}`;
    }
    if (isAuthenticated && user?.handle && campaignName.trim()) {
      return `${clientAppBase}/open/${user.handle}/${slugifyCampaignNamePreview(campaignName)}`;
    }
    return `${clientAppBase}/open/${redirectSlug}`;
  }, [
    redirectBase,
    clientAppBase,
    preciseGeoAnalytics,
    redirectSlug,
    isAuthenticated,
    user?.handle,
    campaignName,
  ]);

  const handleStep1Continue = ({ campaignName: name, destinationUrl: url, preciseGeoAnalytics: pg }) => {
    setCampaignName(name);
    setDestinationUrl(url);
    setPreciseGeoAnalytics(!!pg);
    setStep(2);
  };

  const handleSubmit = async (qrDesignPayload) => {
    if (!isAuthenticated) {
      setDraft(GUEST_DRAFT_TYPES.singleLink, {
        type: GUEST_DRAFT_TYPES.singleLink,
        sourceRoute: location.pathname,
        requiresAuthToPublish: true,
        step: 2,
        campaignName,
        seededCampaignName: seedCampaignName(user),
        destinationUrl,
        design: qrDesignPayload,
        preciseGeoAnalytics,
      });
      const authMessage = 'Your work is saved. Login/Register and come back to continue.';
      setContinuation({
        continueTo: location.pathname,
        draftType: GUEST_DRAFT_TYPES.singleLink,
        message: authMessage,
      });
      navigate('/login', {
        replace: true,
        state: {
          continueTo: location.pathname,
          draftType: GUEST_DRAFT_TYPES.singleLink,
          authMessage,
        },
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const campaign = await campaignService.createSingleLinkCampaign({
        campaignName,
        destinationUrl,
        qrDesign: qrDesignPayload,
        preciseGeoAnalytics,
        redirectSlug,
      });
      clearDraft(GUEST_DRAFT_TYPES.singleLink);
      navigate(`/dashboard/campaigns/${campaign._id}`);
    } catch (err) {
      const message =
        err?.response?.data?.errors?.[0]?.message
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
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Single Link QR</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Create a dynamic QR code that points to a single link. Update the destination anytime
          without reprinting the QR.
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
              <Step1LinkDetails
                campaignName={campaignName}
                onCampaignNameChange={setCampaignName}
                onRegenerateName={() => setCampaignName(seedCampaignName(user))}
                destinationUrl={destinationUrl}
                onDestinationUrlChange={setDestinationUrl}
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

export default SingleLinkQrWizard;
