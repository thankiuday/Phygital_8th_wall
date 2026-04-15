import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Zap, QrCode, Video, BarChart3, ArrowRight, Sparkles, Shield, Globe } from 'lucide-react';
import SEOHead from '../components/ui/SEOHead';

/* ─── Animation variants ─────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.1 } },
};

/* ─── Feature cards data ─────────────────────────────────────────── */
const FEATURES = [
  {
    icon: QrCode,
    title: 'Instant QR Codes',
    desc: 'Auto-generate branded QR codes the moment your campaign is live.',
    color: 'text-brand-400',
    bg: 'bg-brand-500/10',
  },
  {
    icon: Video,
    title: 'Holographic Video',
    desc: 'Your vertical video pops out from any business card in 3D AR.',
    color: 'text-accent-400',
    bg: 'bg-accent-500/10',
  },
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    desc: 'Track scans, watch time, locations, and engagement trends.',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
  },
  {
    icon: Globe,
    title: 'Works Everywhere',
    desc: 'Pure WebAR — no app download required. Camera-scan and go.',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
  {
    icon: Shield,
    title: 'Secure & Reliable',
    desc: 'Enterprise-grade security with Cloudinary CDN for fast delivery.',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
  },
  {
    icon: Sparkles,
    title: 'Premium AR Effects',
    desc: 'GSAP-powered pop-up, float, and glow animations out of the box.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
  },
];

/* ─── Use-case pills ─────────────────────────────────────────────── */
const USE_CASES = [
  'Freelancers',
  'Agencies',
  'Real Estate',
  'Doctors',
  'Salons',
  'Cafes',
  'Coaches',
  'Startups',
];

/* ─── Component ──────────────────────────────────────────────────── */
const LandingPage = () => {
  return (
    <div className="overflow-hidden">
      <SEOHead
        title="AR Business Card Platform"
        description="Turn any business card into an immersive AR hologram experience. Upload your card, add a video, share a QR code — no app required."
      />
      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-4 pt-24 pb-16 text-center">
        {/* Background gradient blob */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden="true"
        >
          <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/20 blur-[120px] dark:bg-brand-700/30" />
          <div className="absolute right-1/4 top-2/3 h-[300px] w-[300px] rounded-full bg-accent-500/15 blur-[80px]" />
        </div>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="flex max-w-4xl flex-col items-center gap-6"
        >
          {/* Badge */}
          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold text-brand-400">
              <Zap size={12} />
              Powered by 8th Wall WebAR
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl lg:text-7xl"
          >
            Turn Business Cards
            <br />
            into{' '}
            <span className="gradient-text">Holographic AR</span>
            <br />
            Experiences
          </motion.h1>

          {/* Sub-headline */}
          <motion.p
            variants={fadeUp}
            className="max-w-xl text-base leading-relaxed text-[var(--text-secondary)] md:text-lg"
          >
            Upload your card + video, get a QR code instantly. When scanned, your video pops out
            from the card in stunning 3D augmented reality — no app required.
          </motion.p>

          {/* CTA buttons */}
          <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/register"
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:bg-brand-500 hover:shadow-glow-lg"
            >
              Start for Free
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/demo"
              className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-6 py-3 text-sm font-semibold text-[var(--text-primary)] transition-all duration-200 hover:border-brand-500/50"
            >
              Watch Demo
            </Link>
          </motion.div>

          {/* Use case pills */}
          <motion.div
            variants={fadeUp}
            className="flex flex-wrap items-center justify-center gap-2"
          >
            {USE_CASES.map((label) => (
              <span
                key={label}
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-1 text-xs text-[var(--text-muted)]"
              >
                {label}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section id="features" className="section-padding bg-[var(--bg-secondary)]">
        <div className="content-width">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-12 text-center"
          >
            <h2 className="text-3xl font-bold md:text-4xl">
              Everything you need to{' '}
              <span className="gradient-text">stand out</span>
            </h2>
            <p className="mt-3 text-[var(--text-secondary)]">
              From upload to hologram in under 2 minutes.
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                className="glass-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-glow"
              >
                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
                  <Icon size={20} className={color} />
                </div>
                <h3 className="mb-2 font-semibold text-[var(--text-primary)]">{title}</h3>
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────────── */}
      <section className="section-padding">
        <div className="content-width">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-brand p-10 text-center text-white shadow-glow-lg"
          >
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent)]" />
            <h2 className="text-3xl font-extrabold md:text-4xl">
              Your AR card is waiting.
            </h2>
            <p className="mt-3 text-white/80">
              Create your first holographic campaign in minutes — free.
            </p>
            <Link
              to="/register"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-700 shadow-lg transition-all hover:shadow-xl"
            >
              Get Started Free <ArrowRight size={16} />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
