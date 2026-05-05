import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../../store/useAuthStore';
import WizardStepBar from '../../components/ui/WizardStepBar';
import { campaignService } from '../../services/campaignService';
import { DEFAULT_DESIGN } from '../../components/qr/qrDesignModel';
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

const PLACEHOLDER_SLUG = 'preview1';

const seedCampaignName = (user) => {
  const firstName = user?.name?.split(' ')[0] || 'My';
  const suffix = String(Date.now()).slice(-4);
  return `${firstName}'s Links + Doc + Video QR-${suffix}`;
};

const LinksDocVideoQrWizard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [videoSource, setVideoSource] = useState('upload');
  // Keep slot state at the wizard level so step navigation preserves uploads.
  const [videoSlots, setVideoSlots] = useState([createVideoSlot()]);
  const [docSlots, setDocSlots] = useState([createDocSlot()]);
  const [linkRows, setLinkRows] = useState([]);
  const [stagedPayload, setStagedPayload] = useState(null);
  const [design, setDesign] = useState(DEFAULT_DESIGN);
  const [preciseGeoAnalytics, setPreciseGeoAnalytics] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

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

  const handleStep1Continue = (payload) => {
    setStagedPayload(payload);
    setStep(2);
  };

  const handleSubmit = async (qrDesignPayload) => {
    if (!stagedPayload) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const campaign = await campaignService.createLinksDocVideoCampaign({
        ...stagedPayload,
        qrDesign: qrDesignPayload,
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
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Links + Doc + Video QR</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          One QR opens your branded hub with multiple videos, documents, and the links visitors
          tap most. Track scans, doc opens, plays, and clicks separately.
        </p>
      </div>

      <WizardStepBar steps={STEPS} currentStep={step} className="mb-8" />

      <div className="glass-card p-4 md:p-6">
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
