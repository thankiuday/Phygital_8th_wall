import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../../store/useAuthStore';
import WizardStepBar from '../../components/ui/WizardStepBar';
import { campaignService } from '../../services/campaignService';
import { DEFAULT_DESIGN } from '../../components/qr/qrDesignModel';
import Step2DesignQr from './single-link/Step2DesignQr';
import Step1LinksVideo from './links-video/Step1LinksVideo';

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
  return `${firstName}'s Links + Video QR Campaign-${suffix}`;
};

const LinksVideoQrWizard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [videoSource, setVideoSource] = useState('upload');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoPublicId, setVideoPublicId] = useState('');
  const [externalVideoUrl, setExternalVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [linkItems, setLinkItems] = useState([]);
  const [linkRows, setLinkRows] = useState([]);
  const [design, setDesign] = useState(DEFAULT_DESIGN);
  const [redirectSlug] = useState(() => generatePreviewSlug());
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
        ? `${clientAppBase}/open/${redirectSlug}`
        : `${redirectBase}/r/${redirectSlug}`,
    [redirectBase, clientAppBase, preciseGeoAnalytics, redirectSlug]
  );

  const handleStep1Continue = ({
    campaignName: name,
    videoSource: src,
    videoUrl: uploadedUrl,
    videoPublicId: uploadedPublicId,
    externalVideoUrl: externalUrl,
    thumbnailUrl: thumb,
    linkItems: items,
    preciseGeoAnalytics: pg,
  }) => {
    setCampaignName(name);
    setVideoSource(src);
    setVideoUrl(uploadedUrl || '');
    setVideoPublicId(uploadedPublicId || '');
    setExternalVideoUrl(externalUrl || '');
    setThumbnailUrl(thumb || '');
    setLinkItems(items || []);
    setPreciseGeoAnalytics(!!pg);
    setStep(2);
  };

  const handleSubmit = async (qrDesignPayload) => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const campaign = await campaignService.createLinksVideoCampaign({
        campaignName,
        videoSource,
        videoUrl,
        videoPublicId,
        externalVideoUrl,
        thumbnailUrl,
        linkItems,
        qrDesign: qrDesignPayload,
        preciseGeoAnalytics,
        redirectSlug,
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
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Links + Video QR</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          One QR opens your branded hub with a hero video and all important links.
          Track scans, clicks, and video engagement in one campaign.
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
              <Step1LinksVideo
                campaignName={campaignName}
                onCampaignNameChange={setCampaignName}
                onRegenerateName={() => setCampaignName(seedCampaignName(user))}
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

export default LinksVideoQrWizard;

