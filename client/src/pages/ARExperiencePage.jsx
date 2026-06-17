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
  Layers,
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
import SurfaceArHost from '../components/ar/SurfaceArHost';
import { getArExperienceCopy } from '../constants/arExperienceCopy';
import { createSurfaceArShell, removeSurfaceArShell } from '../ar/surfaceArShell.js';
import { requestSurfaceSession, checkWebXrArSupported } from '@ar-engine/utils/webxr.js';
import { createArSessionId } from '@ar-engine/utils/arReturnReload.js';

const STEP_ICONS_SURFACE = [ScanLine, Zap];

const getDeviceType = () => {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) return 'mobile';
  return 'desktop';
};

const hubButtonClass =
  'flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl border border-violet-500/35 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-100 transition hover:border-violet-400/50 hover:bg-violet-500/16 active:scale-[0.98]';

const stepVariants = {
  hidden: { opacity: 0, y: 8 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 + i * 0.05, duration: 0.28, ease: 'easeOut' },
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
  const [webXrSupported, setWebXrSupported] = useState(null);
  const [surfaceAr, setSurfaceAr] = useState(null);
  const [surfaceArError, setSurfaceArError] = useState('');

  useEffect(() => {
    applyThemeClass('dark');
    return () => applyThemeClass(theme);
  }, [theme]);

  useEffect(() => {
    setIsMobile(getDeviceType() !== 'desktop');

    const resetLaunching = () => {
      if (document.visibilityState !== 'hidden') {
        setLaunching(false);
      }
    };
    window.addEventListener('pageshow', resetLaunching);
    document.addEventListener('visibilitychange', resetLaunching);

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

    return () => {
      window.removeEventListener('pageshow', resetLaunching);
      document.removeEventListener('visibilitychange', resetLaunching);
    };
  }, [campaignId]);

  const imageTargetOn = campaign?.requiresImageTarget !== false;

  useEffect(() => {
    if (!campaign || imageTargetOn) {
      setWebXrSupported(null);
      return;
    }
    checkWebXrArSupported().then(setWebXrSupported);
  }, [campaign, imageTargetOn]);

  const handleLaunchAR = () => {
    if (!imageTargetOn) {
      setSurfaceArError('');
      setLaunching(true);
      try {
        const shell = createSurfaceArShell();
        const sessionPromise = requestSurfaceSession(shell.domOverlay);
        sessionPromise.catch(() => {
          removeSurfaceArShell();
          setLaunching(false);
          setSurfaceAr(null);
          setSurfaceArError(
            'Could not start surface AR. Use Chrome on Android and allow camera access.'
          );
        });
        setSurfaceAr({
          campaign,
          sessionId: createArSessionId(),
          sessionPromise,
        });
      } catch {
        removeSurfaceArShell();
        setLaunching(false);
        setSurfaceArError('Surface AR is not supported on this device.');
      }
      return;
    }

    setLaunching(true);
    const arEngineUrl =
      import.meta.env.VITE_AR_ENGINE_URL ||
      (window.location.hostname.includes('onrender.com')
        ? 'https://phygital8thwall-ar.onrender.com'
        : 'http://localhost:5174');
    window.location.href = `${arEngineUrl}/ar/${campaignId}`;
  };

  const handleCloseSurfaceAr = () => {
    setSurfaceAr(null);
    setLaunching(false);
  };

  const hubHref =
    campaign?.hubPageUrl
    || (campaign?.ownerHandle && campaign?.hubSlug
      ? `/open/${campaign.ownerHandle}/${campaign.hubSlug}`
      : null);

  const experienceCopy = getArExperienceCopy(campaign?.campaignType, imageTargetOn);
  const stepIcons = imageTargetOn ? [ScanLine, Camera, Zap] : STEP_ICONS_SURFACE;
  const howToSteps = experienceCopy.steps.map((text, i) => ({
    icon: stepIcons[i] || Zap,
    text,
  }));

  const surfaceLaunchBlocked = !imageTargetOn && webXrSupported === false;

  const hubButton = hubHref ? (
    hubHref.startsWith('http') ? (
      <a href={hubHref} className={hubButtonClass}>
        <ExternalLink size={16} aria-hidden />
        View profile hub
      </a>
    ) : (
      <Link to={hubHref} className={hubButtonClass}>
        <ExternalLink size={16} aria-hidden />
        View profile hub
      </Link>
    )
  ) : null;

  const launchButton = (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={handleLaunchAR}
      disabled={launching || surfaceLaunchBlocked}
      className="flex w-full min-h-[52px] items-center justify-center gap-2.5 rounded-2xl bg-gradient-brand py-3.5 text-base font-bold text-white shadow-glow-lg transition-all hover:shadow-glow disabled:opacity-60"
    >
      {launching ? (
        <><Loader2 size={18} className="animate-spin" /> Opening camera…</>
      ) : (
        <><Camera size={18} /> Launch AR Experience</>
      )}
    </motion.button>
  );

  const desktopQrPanel = (
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

  /** Hub first, Launch AR second */
  const actionStack = (
    <div className="flex w-full flex-col gap-2.5">
      {hubButton}
      {isMobile ? launchButton : desktopQrPanel}
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

  const mobileActionBarHeight = hubHref ? '9.75rem' : '5.5rem';

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
        <div className="absolute left-1/2 top-[18%] h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-700/16 blur-[100px]" />
        <div className="absolute bottom-24 right-0 h-[200px] w-[200px] rounded-full bg-violet-900/18 blur-[80px]" />
      </div>

      <header
        className="mx-auto flex w-full max-w-md shrink-0 items-center justify-between"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <BrandLockup variant="header" className="min-h-10 py-0 [&_.brand-word]:brightness-110" />
        <PublicQuickLinksMenu theme="dark" />
      </header>

      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-y-auto"
        style={{
          paddingBottom: isMobile
            ? `calc(${mobileActionBarHeight} + max(0.5rem, env(safe-area-inset-bottom)))`
            : 'max(1rem, env(safe-area-inset-bottom))',
        }}
      >
        {/* Hero preview */}
        <section className="pt-2 text-center">
          <div className="relative mx-auto w-fit max-w-[min(100%,12.5rem)]">
            <div className="overflow-hidden rounded-2xl border border-violet-500/20 bg-white/[0.03] p-1 shadow-[0_0_28px_rgba(124,58,237,0.1)]">
              {imageTargetOn ? (
                <CampaignThumbnail
                  campaign={campaign}
                  alt={campaign?.campaignName || experienceCopy.target}
                  className="mx-auto max-h-[10.5rem] w-auto max-w-full rounded-xl object-contain"
                  placeholderClassName="flex h-32 w-28 items-center justify-center rounded-xl bg-brand-900/50"
                />
              ) : (
                <div className="flex h-32 w-36 flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-violet-900/40 to-brand-900/30 sm:h-[10.5rem] sm:w-40">
                  <Layers size={36} className="text-violet-300/90" aria-hidden />
                  <p className="px-2 text-[10px] font-medium leading-snug text-white/50">
                    No printed marker needed
                  </p>
                </div>
              )}
            </div>
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-brand-500/40 bg-brand-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-brand-200 backdrop-blur-md">
              {experienceCopy.badge}
            </span>
          </div>
        </section>

        {/* Title block */}
        <section className="mt-4 px-0.5 text-center">
          <h1 className="break-words text-balance text-xl font-extrabold tracking-tight text-white">
            {campaign?.campaignName}
          </h1>
          <p className="mx-auto mt-1.5 max-w-[18rem] text-sm leading-snug text-white/55">
            {experienceCopy.subtitle}
          </p>
        </section>

        {/* Quick links */}
        {Array.isArray(campaign?.links) && campaign.links.length > 0 && (
          <section className="mt-4 px-0.5">
            <ArExperienceLinkDock
              links={campaign.links}
              redirectSlug={campaign.redirectSlug}
            />
          </section>
        )}

        {/* How it works */}
        <section className="mt-4 px-0.5">
          <p className="mb-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
            How it works
          </p>
          <div className="flex flex-col gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
            {howToSteps.map(({ icon: Icon, text }, i) => (
              <motion.div
                key={text}
                custom={i}
                variants={stepVariants}
                initial="hidden"
                animate="show"
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/18 ring-1 ring-brand-500/20">
                  <Icon size={15} className="text-brand-300" aria-hidden />
                </div>
                <p className="text-xs leading-snug text-white/72">{text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Desktop: actions inline; mobile uses fixed bar */}
        {!isMobile && (
          <section className="mt-5 pb-2">
            {surfaceArError && (
              <p className="mb-2 text-center text-xs text-red-300/90">{surfaceArError}</p>
            )}
            {surfaceLaunchBlocked && (
              <p className="mb-2 text-center text-xs text-amber-200/80">
                Surface AR needs Chrome on Android. Turn Image target on in your dashboard for other devices.
              </p>
            )}
            {actionStack}
          </section>
        )}

        {!isMobile && (
          <footer className="mt-auto pb-2 pt-4">
            <PoweredByPhygitalFooter theme="dark" />
            <span className="mt-1 block text-center text-[10px] text-white/20">Immersive WebAR</span>
          </footer>
        )}
      </motion.main>

      {/* Mobile: sticky bottom actions — always thumb-reachable */}
      {isMobile && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-[#020617]/92 backdrop-blur-xl"
          style={{
            paddingLeft: 'max(1rem, env(safe-area-inset-left))',
            paddingRight: 'max(1rem, env(safe-area-inset-right))',
            paddingTop: '0.75rem',
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          }}
        >
          <div className="mx-auto w-full max-w-md">
            {surfaceArError && (
              <p className="mb-2 text-center text-xs text-red-300/90">{surfaceArError}</p>
            )}
            {surfaceLaunchBlocked && (
              <p className="mb-2 text-center text-xs text-amber-200/80">
                Surface AR needs Chrome on Android. Turn Image target on in your dashboard for other devices.
              </p>
            )}
            {actionStack}
            <p className="mt-2 text-center text-[10px] text-white/25">Powered by Phygital · WebAR</p>
          </div>
        </div>
      )}
      {surfaceAr && (
        <SurfaceArHost
          campaign={surfaceAr.campaign}
          sessionId={surfaceAr.sessionId}
          sessionPromise={surfaceAr.sessionPromise}
          onClose={handleCloseSurfaceAr}
          onError={(msg) => {
            setSurfaceArError(msg);
            setSurfaceAr(null);
            setLaunching(false);
          }}
          onReady={() => setLaunching(false)}
        />
      )}
    </div>
  );
};

export default ARExperiencePage;
