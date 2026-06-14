import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import SEOHead from '../components/ui/SEOHead';
import {
  Zap,
  Camera,
  ScanLine,
  Smartphone,
  AlertTriangle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { publicService } from '../services/publicService';
import { getVisitorHashForCampaign } from '../utils/visitorHash';
import useThemeStore, { applyThemeClass } from '../store/useThemeStore';
import BrandWord from '../components/ui/BrandWord';
import BrandLockup from '../components/ui/BrandLockup';
import CampaignThumbnail from '../components/ui/CampaignThumbnail';
import PublicQuickLinksMenu from '../components/hub/PublicQuickLinksMenu';
import PoweredByPhygitalFooter from '../components/hub/PoweredByPhygitalFooter';
import ArExperienceLinkDock from '../components/ar/ArExperienceLinkDock';
import { getArMediaProduct } from '../constants/arMediaProducts';

const getDeviceType = () => {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) return 'mobile';
  return 'desktop';
};

const buildHowToSteps = (assetNoun) => [
  { icon: ScanLine, text: `Keep your ${assetNoun} flat on a surface` },
  { icon: Camera, text: `Point your phone camera directly at the ${assetNoun}` },
  { icon: Zap, text: 'Hold still — the hologram will appear in seconds' },
];

const stepVariants = {
  hidden: { opacity: 0, y: 10 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.15 + i * 0.08, duration: 0.35, ease: 'easeOut' },
  }),
};

const ARExperiencePage = () => {
  const { campaignId } = useParams();
  const { theme } = useThemeStore();

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [launching, setLaunching] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    applyThemeClass('dark');
    return () => applyThemeClass(theme);
  }, [theme]);

  useEffect(() => {
    setIsMobile(getDeviceType() !== 'desktop');

    const load = async () => {
      try {
        const data = await publicService.getCampaign(campaignId);
        setCampaign(data);

        publicService.recordScan(campaignId, {
          deviceType: getDeviceType(),
          browser: navigator.userAgent.slice(0, 100),
          visitorHash: getVisitorHashForCampaign(data?.redirectSlug),
        }).catch(() => {});
      } catch (err) {
        if (err.response?.status === 404) {
          setError(
            'This link is only available for published campaigns. Open your dashboard, open this campaign, and click Activate — then try again.'
          );
        } else {
          setError('Something went wrong loading this experience. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [campaignId]);

  const handleLaunchAR = () => {
    setLaunching(true);
    const arEngineUrl =
      import.meta.env.VITE_AR_ENGINE_URL ||
      (window.location.hostname.includes('onrender.com')
        ? 'https://phygital8thwall-ar.onrender.com'
        : 'http://localhost:5174');
    window.location.href = `${arEngineUrl}/ar/${campaignId}`;
  };

  const hubHref =
    campaign?.hubPageUrl
    || (campaign?.ownerHandle && campaign?.hubSlug
      ? `/open/${campaign.ownerHandle}/${campaign.hubSlug}`
      : null);

  const arProduct = getArMediaProduct(campaign?.campaignType);
  const assetNoun = arProduct.assetNoun;
  const howToSteps = buildHowToSteps(assetNoun);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#020617]">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="flex items-center justify-center"
        >
          <BrandLockup variant="header" className="[&_.brand-word]:brightness-110" />
        </motion.div>
        <p className="text-sm text-white/50">Loading AR experience…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#020617] px-[max(1.5rem,env(safe-area-inset-left))] py-[max(2rem,env(safe-area-inset-top))] text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/15">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <div className="max-w-md">
          <h2 className="text-xl font-bold text-white">Experience unavailable</h2>
          <p className="mt-1.5 break-words text-balance text-sm text-white/50">{error}</p>
        </div>
        <Link to="/" className="inline-flex min-h-[44px] items-center text-sm font-medium text-brand-400 hover:text-brand-300 hover:underline">
          Visit <BrandWord /> →
        </Link>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-between bg-[#020617] py-8 text-white sm:py-10"
      style={{
        paddingLeft: 'max(1.25rem, env(safe-area-inset-left))',
        paddingRight: 'max(1.25rem, env(safe-area-inset-right))',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)',
      }}
    >
      <SEOHead
        title={campaign?.campaignName ? `${campaign.campaignName} — AR Experience` : 'AR Experience'}
        description={`Point your camera at the ${assetNoun} to launch the AR hologram experience.`}
        noIndex={true}
      />

      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute left-1/2 top-[28%] h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-700/18 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[280px] w-[280px] rounded-full bg-violet-900/20 blur-[90px]" />
      </div>

      <div className="flex w-full max-w-md items-center justify-between">
        <BrandLockup variant="header" className="min-h-11 py-1 [&_.brand-word]:brightness-110" />
        <PublicQuickLinksMenu theme="dark" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="flex w-full max-w-md flex-col items-center gap-6 text-center sm:gap-7"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="relative w-full"
        >
          <div className="relative mx-auto w-fit">
            <div className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-white/[0.03] p-1.5 shadow-[0_0_40px_rgba(124,58,237,0.15)]">
              <CampaignThumbnail
                campaign={campaign}
                alt={campaign?.campaignName}
                className="h-44 w-44 rounded-xl object-cover sm:h-48 sm:w-48"
                placeholderClassName="flex h-44 w-44 items-center justify-center rounded-xl bg-brand-900/50 sm:h-48 sm:w-48"
              />
            </div>

            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-brand-500/45 bg-brand-500/15 px-3.5 py-1 text-[11px] font-semibold tracking-wide text-brand-200 backdrop-blur-md"
            >
              AR Hologram Ready
            </motion.div>
          </div>

          {Array.isArray(campaign?.links) && campaign.links.length > 0 && (
            <div className="mt-5 px-1">
              <ArExperienceLinkDock
                links={campaign.links}
                redirectSlug={campaign.redirectSlug}
              />
            </div>
          )}
        </motion.div>

        <div className="w-full px-1">
          <h1 className="break-words text-balance text-2xl font-extrabold tracking-tight text-white sm:text-[1.65rem]">
            {campaign?.campaignName}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/55">
            Point your camera at the {assetNoun} to unlock the hologram and interactive links.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 px-1">
          {howToSteps.map(({ icon: Icon, text }, i) => (
            <motion.div
              key={text}
              custom={i}
              variants={stepVariants}
              initial="hidden"
              animate="show"
              className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 backdrop-blur-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/20 ring-1 ring-brand-500/25">
                <Icon size={17} className="text-brand-300" />
              </div>
              <p className="text-left text-sm text-white/75">{text}</p>
            </motion.div>
          ))}
        </div>

        {hubHref && (
          hubHref.startsWith('http') ? (
            <a
              href={hubHref}
              className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-violet-500/35 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-200 transition hover:border-violet-400/50 hover:bg-violet-500/18 active:scale-[0.98]"
            >
              <ExternalLink size={16} />
              View profile hub
            </a>
          ) : (
            <Link
              to={hubHref}
              className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-violet-500/35 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-200 transition hover:border-violet-400/50 hover:bg-violet-500/18 active:scale-[0.98]"
            >
              <ExternalLink size={16} />
              View profile hub
            </Link>
          )
        )}

        {isMobile ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleLaunchAR}
            disabled={launching}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-brand py-4 text-base font-bold text-white shadow-glow-lg transition-all hover:shadow-glow disabled:opacity-60"
          >
            {launching ? (
              <><Loader2 size={18} className="animate-spin" /> Opening camera…</>
            ) : (
              <><Camera size={18} /> Launch AR Experience</>
            )}
          </motion.button>
        ) : (
          <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
            <Smartphone size={24} className="text-brand-400" />
            <p className="text-sm font-semibold text-white">Open on your phone</p>
            <p className="text-xs text-white/50">
              AR experiences work on mobile. Scan the QR code on your phone, or open this link on a mobile device.
            </p>
            {campaign?.qrCodeUrl && (
              <img
                src={campaign.qrCodeUrl}
                alt="QR code"
                className="mt-2 h-32 w-32 rounded-xl border border-white/10 bg-white p-1"
              />
            )}
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-brand-400 hover:underline"
            >
              <ExternalLink size={12} /> Copy link to open on phone
            </a>
          </div>
        )}
      </motion.div>

      <div className="flex flex-col items-center gap-1 pt-4">
        <PoweredByPhygitalFooter theme="dark" />
        <span className="text-[11px] text-white/20">Immersive WebAR</span>
      </div>
    </div>
  );
};

export default ARExperiencePage;
