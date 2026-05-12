import { motion } from 'framer-motion';
import {
  Video,
  FileText,
  Link as LinkIcon,
  List,
  CreditCard,
  Sparkles,
} from 'lucide-react';
import Icon3D, { ICON3D_PRESETS } from '../ui/Icon3D';
import BrandWord from '../ui/BrandWord';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.08 } },
};

/* ── Data matching PhygitalizePickerPage exactly ─────────────────── */
const GROUPS = [
  {
    id: 'phygital-qr',
    label: <><BrandWord /> QR</>,
    tagline: 'Bridge physical prints with rich digital experiences.',
    accent: ICON3D_PRESETS.violet,
    pillClass: 'border-brand-500/30 bg-brand-500/10 text-brand-400',
    types: [
      {
        icon: Video,
        accent: ICON3D_PRESETS.violet,
        title: 'Links + Video QR',
        desc: 'A single QR that surfaces curated links alongside a hero video — perfect for product launches and portfolios.',
      },
      {
        icon: FileText,
        accent: ICON3D_PRESETS.rose,
        title: 'Links, Doc & Video QR',
        desc: 'Bundle links, downloadable documents, and video into one scan. Great for menus, brochures, and pitches.',
      },
    ],
  },
  {
    id: 'dynamic-qr',
    label: 'Dynamic QR',
    tagline: 'Editable destinations — the QR stays the same, you change the link.',
    accent: ICON3D_PRESETS.cyan,
    pillClass: 'border-accent-500/30 bg-accent-500/10 text-accent-400',
    types: [
      {
        icon: LinkIcon,
        accent: ICON3D_PRESETS.cyan,
        title: 'Single Link QR',
        desc: 'Point one QR at any destination and rewrite it whenever you need — no reprint required.',
      },
      {
        icon: List,
        accent: ICON3D_PRESETS.amber,
        title: 'Multiple Links QR',
        desc: 'Serve a curated list of links from one QR — perfect for bios, social profiles, and restaurant menus.',
      },
    ],
  },
  {
    id: 'digital-business-cards',
    label: 'Digital Business Cards',
    tagline: 'Modern, shareable cards that replace paper for good.',
    accent: ICON3D_PRESETS.emerald,
    pillClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    types: [
      {
        icon: CreditCard,
        accent: ICON3D_PRESETS.emerald,
        title: 'Personalized Identity',
        desc: 'A branded digital card with your photo, contact details, and social links — shareable in a single tap.',
      },
      {
        icon: Sparkles,
        accent: ICON3D_PRESETS.brand,
        title: 'AR Digital Business Card',
        desc: 'Holographic AR experience that plays your video on top of your printed card. The ultimate first impression.',
      },
    ],
  },
];

/* ── Type card ───────────────────────────────────────────────────── */
const TypeCard = ({ icon, accent, title, desc }) => (
  <motion.div
    variants={fadeUp}
    className="flex gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 transition-all duration-200 hover:-translate-y-0.5"
  >
    <Icon3D icon={icon} size={15} className="h-8 w-8 shrink-0 mt-0.5" accent={accent} rounded="rounded-lg" />
    <div>
      <h4 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h4>
      <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">{desc}</p>
    </div>
  </motion.div>
);

/* ── Group block ─────────────────────────────────────────────────── */
const GroupBlock = ({ group }) => (
  <motion.div
    variants={fadeUp}
    className="glass-card p-5 sm:p-6"
  >
    {/* Group header */}
    <div className="mb-4">
      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${group.pillClass}`}>
        {group.label}
      </span>
      <p className="mt-2 text-xs text-[var(--text-muted)]">{group.tagline}</p>
    </div>

    {/* Type cards */}
    <motion.div
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      className="flex flex-col gap-3"
    >
      {group.types.map((type) => (
        <TypeCard key={type.title} {...type} />
      ))}
    </motion.div>
  </motion.div>
);

/* ── Section ─────────────────────────────────────────────────────── */
const CampaignTypesSection = () => (
  <section
    id="use-cases"
    className="bg-[var(--bg-primary)] px-4 py-16 sm:px-6 sm:py-20 md:px-8 lg:px-16 xl:px-24"
  >
    <div className="content-width">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.5 }}
        className="mb-10 text-center sm:mb-12"
      >
        <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-tight tracking-tight text-[var(--text-primary)]">
          Everything you need to{' '}
          <span className="gradient-text">Phygitalize</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--text-secondary)] sm:text-base">
          Six ways to bridge physical prints with rich digital experiences — pick what fits your workflow.
        </p>
      </motion.div>

      {/* Group grid */}
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.1 }}
        className="grid gap-5 sm:gap-6 lg:grid-cols-3"
      >
        {GROUPS.map((group) => (
          <GroupBlock key={group.id} group={group} />
        ))}
      </motion.div>
    </div>
  </section>
);

export default CampaignTypesSection;
