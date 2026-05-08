import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../../store/useAuthStore';
import WizardStepBar from '../../components/ui/WizardStepBar';
import { campaignService } from '../../services/campaignService';
import { DEFAULT_DESIGN } from '../../components/qr/qrDesignModel';
import Step1LinkDetails from './single-link/Step1LinkDetails';
import Step2DesignQr from './single-link/Step2DesignQr';

const STEPS = [
  { number: 1, shortLabel: 'Details', label: 'Enter Details' },
  { number: 2, shortLabel: 'Design',  label: 'Design QR' },
];

/**
 * Build the same redirect URL pattern the server uses, so the QR rendered in
 * the wizard preview is byte-identical to the one printed after submission.
 *
 * Resolution order:
 *   1. VITE_REDIRECT_BASE — explicit override at build time
 *   2. VITE_API_URL stripped of any trailing /api — most deploys
 *   3. window.location.origin — local dev fallback
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

// Stable placeholder slug while in the wizard so the QR's encoded length
// matches the eventual server-issued slug (8 chars).  Length stability matters
// because the QR matrix density changes with payload length.
const PLACEHOLDER_SLUG = 'preview1';

const seedCampaignName = (user) => {
  const firstName = user?.name?.split(' ')[0] || 'My';
  const suffix = String(Date.now()).slice(-4);
  return `${firstName}'s Single Link QR Campaign-${suffix}`;
};

const SingleLinkQrWizard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [design, setDesign] = useState(DEFAULT_DESIGN);
  const [preciseGeoAnalytics, setPreciseGeoAnalytics] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Auto-seed name on first mount (does NOT regenerate when the user navigates
  // back to step 1 — only on a fresh wizard load).
  useEffect(() => {
    setCampaignName(seedCampaignName(user));
  }, [user]);

  const redirectBase = useMemo(resolveRedirectBase, []);
  const clientAppBase = useMemo(resolveClientAppBase, []);
  const encodedData = useMemo(
    () =>
      preciseGeoAnalytics
        ? `${clientAppBase}/open/${PLACEHOLDER_SLUG}`
        : `${redirectBase}/r/${PLACEHOLDER_SLUG}`,
    [redirectBase, clientAppBase, preciseGeoAnalytics]
  );

  const handleStep1Continue = ({ campaignName: name, destinationUrl: url, preciseGeoAnalytics: pg }) => {
    setCampaignName(name);
    setDestinationUrl(url);
    setPreciseGeoAnalytics(!!pg);
    setStep(2);
  };

  const handleSubmit = async (qrDesignPayload) => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const campaign = await campaignService.createSingleLinkCampaign({
        campaignName,
        destinationUrl,
        qrDesign: qrDesignPayload,
        preciseGeoAnalytics,
      });
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
    <div className="mx-auto max-w-5xl min-w-0 overflow-x-hidden">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Single Link QR</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Create a dynamic QR code that points to a single link. Update the destination anytime
          without reprinting the QR.
        </p>
      </div>

      <WizardStepBar steps={STEPS} currentStep={step} className="mb-8" />

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
