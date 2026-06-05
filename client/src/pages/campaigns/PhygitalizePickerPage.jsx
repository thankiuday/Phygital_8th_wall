import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  QrCode,
  RefreshCw,
  IdCard,
  Video,
  FileText,
  Link2,
  Layers,
  User,
  Sparkles,
  ArrowRight,
  CreditCard,
  Lock,
} from 'lucide-react';
import Icon3D, { ICON3D_PRESETS } from '../../components/ui/Icon3D';
import useAuthStore from '../../store/useAuthStore';

const ICON_ACCENTS = {
  'links-video': ICON3D_PRESETS.violet,
  'links-doc-video': ICON3D_PRESETS.cyan,
  'single-link': ICON3D_PRESETS.emerald,
  'multiple-links': ICON3D_PRESETS.amber,
  'personalized-identity': ICON3D_PRESETS.rose,
  'ar-business-card': ICON3D_PRESETS.brand,
  'ar-poster': ICON3D_PRESETS.violet,
  'phygital-qr': ICON3D_PRESETS.violet,
  'dynamic-qr': ICON3D_PRESETS.cyan,
  'digital-business-cards': ICON3D_PRESETS.rose,
};

/* ── Section + card data ─────────────────────────────────────────── */
// `available: true` drives the green badge + copy; routes may still point at
// ComingSoonPage for types that are not built yet.
const buildSections = (basePath) => [
  {
    id: 'phygital-qr',
    title: 'Phygital QR',
    subtitle: 'Requires Phygital QR subscription ($14.99/mo or $149/yr). Subscribe before creating.',
    icon: QrCode,
    cards: [
      {
        id: 'links-video',
        title: 'Links + Video QR',
        description: 'A single QR that surfaces curated links alongside a hero video.',
        icon: Video,
        to: `${basePath}/phygital-qr/links-video`,
        available: true,
      },
      {
        id: 'links-doc-video',
        title: 'Links, Doc & Video QR',
        description: 'Bundle links, downloadable documents and video into one scan.',
        icon: FileText,
        to: `${basePath}/phygital-qr/links-doc-video`,
        available: true,
      },
    ],
  },
  {
    id: 'dynamic-qr',
    title: 'Dynamic QR',
    subtitle: 'Editable destinations you can update anytime — the QR stays the same.',
    icon: RefreshCw,
    cards: [
      {
        id: 'single-link',
        title: 'Single Link QR',
        description: 'Point one QR at a single destination and rewrite it whenever you need.',
        icon: Link2,
        to: `${basePath}/dynamic-qr/single-link`,
        available: true,
      },
      {
        id: 'multiple-links',
        title: 'Multiple Links QR',
        description: 'Serve a curated list of links from one QR — perfect for bios and menus.',
        icon: Layers,
        to: `${basePath}/dynamic-qr/multiple-links`,
        available: true,
      },
    ],
  },
  {
    id: 'digital-business-cards',
    title: 'Digital Business Cards',
    subtitle: 'Modern, shareable cards that replace paper for good.',
    icon: IdCard,
    cards: [
      {
        id: 'personalized-identity',
        title: 'Personalized Identity',
        description: 'A branded digital card with your photo, contacts, and social links.',
        icon: User,
        to: '/dashboard/identity',
        available: true,
      },
    ],
  },
  {
    id: 'ar-experiences',
    title: 'AR Experiences',
    subtitle: 'Holographic AR on your print — we handle video processing and publish.',
    icon: Sparkles,
    cards: [
      {
        id: 'ar-business-card',
        title: 'AR Digital Business Card',
        description: 'Submit your card image, QR placement, and green-screen video — we build your AR card within 24 hours.',
        icon: Sparkles,
        to: '/dashboard/campaigns/new/digital-business-card/ar',
        available: true,
      },
      {
        id: 'ar-poster',
        title: 'AR Posters',
        description: 'Submit poster artwork, QR placement, and green-screen video — we build your holographic AR poster within 24 hours.',
        icon: Sparkles,
        to: '/dashboard/campaigns/new/ar-poster',
        available: true,
      },
    ],
  },
];

/* ── Single campaign-type card ───────────────────────────────────── */
const TypeCard = ({ card, index, requiresSubscription = false, hasSubscription = true }) => {
  const Icon = card.icon;
  const accent = ICON_ACCENTS[card.id] || ICON3D_PRESETS.brand;
  const locked = requiresSubscription && !hasSubscription;
  const inner = (
    <>
        <div className="flex items-start justify-between gap-3">
          <Icon3D icon={Icon} accent={accent} size={20} className="h-11 w-11" />
          {locked ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              <Lock size={10} />
              Subscribe
            </span>
          ) : card.available ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
              Available
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-color)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Coming soon
            </span>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-semibold text-[var(--text-primary)] group-hover:text-brand-400">
            {card.title}
          </h3>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {card.description}
          </p>
        </div>

        <div className="mt-auto flex items-center gap-1.5 pt-1 text-xs font-medium text-brand-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {locked ? 'Subscribe to unlock' : card.available ? 'Start creating' : 'Preview'}
          <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: index * 0.04 }}
    >
      {locked ? (
        <div className="glass-card relative flex h-full flex-col gap-3 p-5 opacity-95">
          {inner}
        </div>
      ) : (
        <Link
          to={card.to}
          className="group glass-card relative flex h-full flex-col gap-3 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-glow"
        >
          {inner}
        </Link>
      )}
    </motion.div>
  );
};

/* ── Section header ──────────────────────────────────────────────── */
const SectionHeader = ({ icon: Icon, title, subtitle, accent }) => (
  <div className="flex items-start gap-3">
    <Icon3D icon={Icon} accent={accent || ICON3D_PRESETS.brand} size={18} className="h-10 w-10" />
    <div className="min-w-0">
      <h2 className="text-lg font-bold text-[var(--text-primary)] sm:text-xl">{title}</h2>
      <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>
    </div>
  </div>
);

/* ── Main page ───────────────────────────────────────────────────── */
const PhygitalizePickerPage = () => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();
  const qrBasePath = isAuthenticated ? '/dashboard/campaigns/new' : '/create';
  const sections = buildSections(qrBasePath);
  const isPublicRoute = !location.pathname.startsWith('/dashboard');
  const hasPhygitalQrAccess = user?.hasPhygitalQrAccess || user?.hasFullAccess;

  return (
    <div
      className={`mx-auto max-w-6xl space-y-8 p-4 sm:p-6 ${isPublicRoute ? 'pt-[calc(var(--navbar-height)+1rem)] sm:pt-[calc(var(--navbar-height)+1.5rem)]' : ''}`}
    >
    {/* Page header */}
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="space-y-1"
    >
      <h1 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
        Phygitalize now
      </h1>
      <p className="text-sm text-[var(--text-secondary)] sm:text-base">
        Pick the campaign type you want to launch. Every option is one scan away from real-world engagement.
      </p>
      {isAuthenticated && !hasPhygitalQrAccess && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-[var(--text-secondary)]">
          <strong className="font-semibold text-[var(--text-primary)]">Phygital QR</strong> campaigns
          require a subscription ($14.99/mo or $149/yr).{' '}
          <Link to="/pricing" className="inline-flex items-center gap-1 font-semibold text-brand-400 hover:underline">
            <CreditCard size={14} />
            Subscribe first
          </Link>
          , then create Links + Video or Links, Doc &amp; Video QR.
        </div>
      )}
    </motion.div>

    {/* Sections */}
    <div className="space-y-10">
      {sections.map((section, sIdx) => (
        <motion.section
          key={section.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut', delay: 0.05 + sIdx * 0.05 }}
          className="space-y-4"
        >
          <SectionHeader
            icon={section.icon}
            title={section.title}
            subtitle={section.subtitle}
            accent={ICON_ACCENTS[section.id]}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {section.cards.map((card, idx) => (
              <TypeCard
                key={card.id}
                card={card}
                index={idx}
                requiresSubscription={section.id === 'phygital-qr'}
                hasSubscription={hasPhygitalQrAccess}
              />
            ))}
          </div>
        </motion.section>
      ))}
    </div>
    </div>
  );
};

export default PhygitalizePickerPage;
