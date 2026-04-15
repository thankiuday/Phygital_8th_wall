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
import useThemeStore, { applyThemeClass } from '../store/useThemeStore';

/* ── Detect device type for analytics ───────────────────────────── */
const getDeviceType = () => {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) return 'mobile';
  return 'desktop';
};

/* ── Simple visitor hash (fingerprint) ──────────────────────────── */
const getVisitorHash = () => {
  const stored = sessionStorage.getItem('p8w_vid');
  if (stored) return stored;
  const hash = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessionStorage.setItem('p8w_vid', hash);
  return hash;
};

/* ── Steps shown on the page ─────────────────────────────────────── */
const HOW_TO_STEPS = [
  { icon: ScanLine, text: 'Keep your business card flat on a surface' },
  { icon: Camera, text: 'Point your phone camera directly at the card' },
  { icon: Zap, text: 'Hold still — the hologram will appear in seconds' },
];

/* ── Main page ───────────────────────────────────────────────────── */
const ARExperiencePage = () => {
  const { campaignId } = useParams();
  const { theme } = useThemeStore();

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [launching, setLaunching] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Force dark theme for the AR page — immersive look
  useEffect(() => {
    applyThemeClass('dark');
    return () => applyThemeClass(theme); // restore on unmount
  }, [theme]);

  useEffect(() => {
    setIsMobile(getDeviceType() !== 'desktop');

    const load = async () => {
      try {
        const data = await publicService.getCampaign(campaignId);
        setCampaign(data);

        // Record scan event
        publicService.recordScan(campaignId, {
          deviceType: getDeviceType(),
          browser: navigator.userAgent.slice(0, 100),
          visitorHash: getVisitorHash(),
        }).catch(() => {}); // non-blocking
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

  /* ── Launch AR engine ──────────────────────────────────────── */
  const handleLaunchAR = () => {
    setLaunching(true);
    const arEngineUrl =
      import.meta.env.VITE_AR_ENGINE_URL ||
      (window.location.hostname.includes('onrender.com')
        ? 'https://phygital8thwall-ar.onrender.com'
        : 'http://localhost:5174');
    window.location.href = `${arEngineUrl}/ar/${campaignId}`;
  };

  /* ── Loading state ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#020617]">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand shadow-glow-lg"
        >
          <Zap size={28} className="text-white" />
        </motion.div>
        <p className="text-sm text-white/50">Loading AR experience…</p>
      </div>
    );
  }

  /* ── Error state ───────────────────────────────────────────── */
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#020617] px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/15">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Experience unavailable</h2>
          <p className="mt-1.5 text-sm text-white/50">{error}</p>
        </div>
        <Link to="/" className="text-sm font-medium text-brand-400 hover:text-brand-300 hover:underline">
          Visit Phygital8ThWall →
        </Link>
      </div>
    );
  }

  /* ── Main page ─────────────────────────────────────────────── */
  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-[#020617] px-5 py-10 text-white">
      <SEOHead
        title={campaign?.campaignName ? `${campaign.campaignName} — AR Experience` : 'AR Experience'}
        description="Point your camera at the business card to launch the AR hologram experience."
        noIndex={true}
      />
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-700/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-accent-700/15 blur-[80px]" />
      </div>

      {/* Header */}
      <Link to="/" className="flex items-center gap-2 self-start">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand shadow-glow">
          <Zap size={16} className="text-white" />
        </span>
        <span className="text-sm font-bold tracking-tight text-white/70">Phygital8ThWall</span>
      </Link>

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex w-full max-w-sm flex-col items-center gap-8 text-center"
      >
        {/* Thumbnail / card preview */}
        <div className="relative">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-glow">
            {campaign?.thumbnailUrl ? (
              <img
                src={campaign.thumbnailUrl}
                alt={campaign.campaignName}
                className="h-48 w-48 object-cover"
              />
            ) : (
              <div className="flex h-48 w-48 items-center justify-center bg-brand-900/50">
                <ScanLine size={48} className="text-brand-400/50" />
              </div>
            )}
          </div>

          {/* Floating hologram hint badge */}
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-brand-500/40 bg-brand-500/20 px-3 py-1 text-xs font-semibold text-brand-300 backdrop-blur-sm"
          >
            ✦ AR Hologram Ready
          </motion.div>
        </div>

        {/* Campaign info */}
        <div>
          <h1 className="text-2xl font-extrabold text-white">{campaign?.campaignName}</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            Point your camera at the business card to see the augmented reality experience.
          </p>
        </div>

        {/* How-to steps */}
        <div className="flex w-full flex-col gap-2">
          {HOW_TO_STEPS.map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/20">
                <Icon size={16} className="text-brand-400" />
              </div>
              <p className="text-left text-xs text-white/70">{text}</p>
            </div>
          ))}
        </div>

        {/* CTA button */}
        {isMobile ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleLaunchAR}
            disabled={launching}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-brand py-4 text-base font-bold text-white shadow-glow-lg transition-all hover:shadow-glow disabled:opacity-60 animate-pulse-glow"
          >
            {launching ? (
              <><Loader2 size={18} className="animate-spin" /> Opening camera…</>
            ) : (
              <><Camera size={18} /> Launch AR Experience</>
            )}
          </motion.button>
        ) : (
          /* Desktop — show QR to scan with phone */
          <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">
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

      {/* Footer */}
      <p className="text-xs text-white/25">
        Powered by{' '}
        <Link to="/" className="text-white/40 hover:text-white/60">Phygital8ThWall</Link>
        {' '}· WebAR by 8th Wall
      </p>
    </div>
  );
};

export default ARExperiencePage;
