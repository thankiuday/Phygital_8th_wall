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
import { getArExperienceCopy } from '../constants/arExperienceCopy';

const STEP_ICONS = [ScanLine, Camera, Zap];

const getDeviceType = () => {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) return 'mobile';
  return 'desktop';
};

const stepVariants = {
  hidden: { opacity: 0, y: 8 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.1 + i * 0.06, duration: 0.3, ease: 'easeOut' },
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

  const experienceCopy = getArExperienceCopy(campaign?.campaignType);
  const howToSteps = experienceCopy.steps.map((text, i) => ({
    icon: STEP_ICONS[i] || Zap,
    text,
  }));

  const launchButton = isMobile ? (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={handleLaunchAR}
      disabled={launching}
      className="flex w-full min-h-[52px] items-center justify-center gap-2.5 rounded-2xl bg-gradient-brand py-3.5 text-base font-bold text-white shadow-glow-lg transition-all hover:shadow-glow disabled:opacity-60"
    >
      {launching ? (
        <><Loader2 size={18} className="animate-spin" /> Opening camera…</>
      ) : (
        <><Camera size={18} /> Launch AR Experience</>
      )}
    </motion.button>
  ) : (
    <div className="flex w-full flex-col items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
      <Smartphone size={22} className="text-brand-400" />
      <p className="text-sm font-semibold text-white">Open on your phone</p>
      <p className="text-center text-xs text-white/50">
        AR works on mobile. Scan the QR on your phone or open this link there.
      </p>
      {campaign?.qrCodeUrl && (
        <img
          src={campaign.qrCodeUrl}
          alt="QR code"
          className="h-28 w-28 rounded-xl border border-white/10 bg-white p-1"
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
  );

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#020617]">
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
      <div
        className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-[#020617] px-[max(1rem,env(safe-area-inset-left))] text-center"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/15">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <div className="max-w-md px-4">
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
      className="flex min-h-[100dvh] flex-col bg-[#020617] text-white"
      style={{
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <SEOHead
        title={campaign?.campaignName ? `${campaign.campaignName} — AR Experience` : 'AR Experience'}
        description={experienceCopy.seoDescription}
        noIndex={true}
      />

      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute left-1/2 top-[22%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-700/18 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[240px] w-[240px] rounded-full bg-violet-900/20 blur-[90px]" />
      </div>

      {/* Navbar — flush to top, no extra margin */}
      <header
        className="mx-auto flex w-full max-w-md shrink-0 items-center justify-between"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <BrandLockup variant="header" className="min-h-10 py-0 [&_.brand-word]:brightness-110" />
        <PublicQuickLinksMenu theme="dark" />
      </header>

      {/* Above-the-fold: preview + title + primary CTA */}
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 pt-3 text-center sm:gap-5 sm:pt-4"
      >
        <div className="relative w-full">
          <div className="relative mx-auto w-fit max-w-[min(100%,13rem)]">
            <div className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-white/[0.03] p-1 shadow-[0_0_32px_rgba(124,58,237,0.12)]">
              <CampaignThumbnail
                campaign={campaign}
                alt={campaign?.campaignName || experienceCopy.target}
                className="mx-auto max-h-[11rem] w-auto max-w-full rounded-xl object-contain sm:max-h-[12rem]"
                placeholderClassName="flex h-36 w-28 items-center justify-center rounded-xl bg-brand-900/50 sm:h-40 sm:w-32"
              />
            </div>
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-brand-500/45 bg-brand-500/15 px-3 py-0.5 text-[10px] font-semibold tracking-wide text-brand-200 backdrop-blur-md sm:text-[11px]"
            >
              AR Hologram Ready
            </motion.div>
          </div>

          {Array.isArray(campaign?.links) && campaign.links.length > 0 && (
            <div className="mt-3 px-1">
              <ArExperienceLinkDock
                links={campaign.links}
                redirectSlug={campaign.redirectSlug}
              />
            </div>
          )}
        </div>

        <div className="w-full px-1">
          <h1 className="break-words text-balance text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            {campaign?.campaignName}
          </h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-snug text-white/55">
            {experienceCopy.subtitle}
          </p>
        </div>

        {/* Primary CTA — visible without scrolling on typical phones */}
        <div className="w-full px-1">
          {launchButton}
        </div>

        {hubHref && (
          hubHref.startsWith('http') ? (
            <a
              href={hubHref}
              className="flex w-full min-h-[40px] items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/8 px-3 py-2.5 text-sm font-medium text-violet-200 transition hover:border-violet-400/45 hover:bg-violet-500/14 active:scale-[0.98]"
            >
              <ExternalLink size={15} />
              View profile hub
            </a>
          ) : (
            <Link
              to={hubHref}
              className="flex w-full min-h-[40px] items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/8 px-3 py-2.5 text-sm font-medium text-violet-200 transition hover:border-violet-400/45 hover:bg-violet-500/14 active:scale-[0.98]"
            >
              <ExternalLink size={15} />
              View profile hub
            </Link>
          )
        )}

        {/* How-to steps — compact, below CTA */}
        <div className="flex w-full flex-col gap-1.5 px-1 pb-2">
          {howToSteps.map(({ icon: Icon, text }, i) => (
            <motion.div
              key={text}
              custom={i}
              variants={stepVariants}
              initial="hidden"
              animate="show"
              className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-left"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-500/20 ring-1 ring-brand-500/20">
                <Icon size={15} className="text-brand-300" />
              </div>
              <p className="text-xs leading-snug text-white/70 sm:text-sm">{text}</p>
            </motion.div>
          ))}
        </div>
      </motion.main>

      <footer
        className="mx-auto w-full max-w-md shrink-0 pb-2 pt-1"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <PoweredByPhygitalFooter theme="dark" />
        <span className="mt-1 block text-center text-[10px] text-white/20">Immersive WebAR</span>
      </footer>
    </div>
  );
};

export default ARExperiencePage;
