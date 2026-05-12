import { motion } from 'framer-motion';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Zap } from 'lucide-react';
import BrandWord from '../ui/BrandWord';
import BrandLogo from '../ui/BrandLogo';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.1 } },
};

/* ── Hologram Figure SVG ─────────────────────────────────────────── */
const HoloFigureSVG = () => {
  const uid = useId().replace(/:/g, '');
  const headGradId = `headGrad-${uid}`;
  const bodyGradId = `bodyGrad-${uid}`;
  const lowerGradId = `lowerGrad-${uid}`;
  const glowFilterId = `figureGlow-${uid}`;

  return (
    <svg
      viewBox="0 0 100 160"
      xmlns="http://www.w3.org/2000/svg"
      width="140"
      height="224"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <radialGradient id={headGradId} cx="38%" cy="32%" r="60%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
          <stop offset="45%" stopColor="rgba(100,210,255,0.75)" />
          <stop offset="100%" stopColor="rgba(40,120,240,0.55)" />
        </radialGradient>
        <linearGradient id={bodyGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.65)" />
          <stop offset="40%" stopColor="rgba(80,185,255,0.7)" />
          <stop offset="100%" stopColor="rgba(30,80,210,0.45)" />
        </linearGradient>
        <linearGradient id={lowerGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(60,160,255,0.55)" />
          <stop offset="55%" stopColor="rgba(40,120,240,0.2)" />
          <stop offset="100%" stopColor="rgba(40,120,240,0)" />
        </linearGradient>
        <filter id={glowFilterId} x="-40%" y="-20%" width="180%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="50" cy="20" r="16" fill={`url(#${headGradId})`} filter={`url(#${glowFilterId})`} />
      <path
        d="M50,34 C50,34 70,36 79,48 C88,60 90,58 92,66 C95,76 88,84 80,84
           C74,84 67,81 65,90 C63,100 61,112 61,122 C61,134 57,142 50,144
           C43,142 39,134 39,122 C39,112 37,100 35,90 C33,81 26,84 20,84
           C12,84 5,76 8,66 C10,58 12,60 21,48 C30,36 50,34 50,34Z"
        fill={`url(#${bodyGradId})`}
        stroke="rgba(100,210,255,0.3)"
        strokeWidth="0.8"
        filter={`url(#${glowFilterId})`}
      />
      <path d="M38,138 L62,138 L56,160 L44,160Z" fill={`url(#${lowerGradId})`} />
    </svg>
  );
};

/* ── Product Mockup ───────────────────────────────────────────────── */
const ProductMockup = () => (
  <motion.div
    initial={{ opacity: 0, y: 32, scale: 0.96 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
    className="relative mx-auto mt-12 w-full max-w-sm sm:mt-16 lg:mt-0 lg:max-w-xs xl:max-w-sm"
    aria-hidden="true"
  >
    {/*
      Single flex-column composition.
      The hologram, ring, and card stack naturally top→bottom.
      Horizontal centering is controlled by ONE value: the card's
      left offset inside the SVG figure (figureOffset).
      The whole scene is nudged right by the outer wrapper's marginLeft.
    */}
    <div className="relative flex flex-col items-center">

      {/* ── Hologram figure — centered over card ── */}
      <motion.div
        animate={{ y: [0, -9, 0], opacity: [0.88, 1, 0.88] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none relative z-20"
      >
        <HoloFigureSVG />
      </motion.div>

      {/* ── Oval glow ring — pulled up to sit at figure's feet ── */}
      <motion.div
        animate={{
          y: [20, 20, 20],
          scaleX: [0.95, 1.06, 0.95],
          scaleY: [0.95, 1.04, 0.95],
          opacity: [0.7, 1, 0.7],
        }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute z-25"
        style={{
          top: '250px',
          left: '50%',
          marginLeft: '-55px',
          width: '110px',
          height: '28px',
          borderRadius: '50%',
          border: '1.5px solid rgba(80,220,255,0.9)',
          boxShadow:
            '0 0 20px rgba(6,182,212,0.85), inset 0 0 12px rgba(59,130,246,0.5), 0 0 40px rgba(6,182,212,0.4)',
        }}
      />

      {/* ── 3D tilted card — sits directly below ring ── */}
      <div
        className="relative z-10"
        style={{ marginTop: '-10px' }}
      >
        <div
          className="relative rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] px-4 pb-4 pt-5"
          style={{
            width: '300px',
            transform: 'perspective(900px) rotateX(52deg) scaleX(1.1)',
            transformOrigin: 'center bottom',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Diffuse glow blob on card surface */}
          <motion.div
            animate={{ opacity: [0.5, 0.8, 0.5], scaleX: [0.95, 1.1, 0.95] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-none absolute top-1 z-10"
            style={{
              left: '50%',
              transform: 'translateX(-50%)',
              width: '110px',
              height: '32px',
              borderRadius: '50%',
              background:
                'radial-gradient(ellipse, rgba(6,182,212,0.38) 0%, rgba(6,182,212,0.1) 55%, transparent 85%)',
              filter: 'blur(4px)',
            }}
          />

          {/* Contact shadow on card surface */}
          <motion.div
            animate={{ scaleX: [0.96, 1.06, 0.96], opacity: [0.3, 0.45, 0.3] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-none absolute top-2 z-10 rounded-[50%]"
            style={{
              width: '80px',
              height: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              background:
                'radial-gradient(ellipse at center, rgba(15,23,42,0.55) 0%, rgba(15,23,42,0.25) 50%, transparent 80%)',
              filter: 'blur(2px)',
            }}
          />

          {/* Content lines */}
          <div className="mb-3 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
            <div className="mb-2 h-2.5 w-2/3 rounded bg-[var(--surface-3)]" />
            <div className="mb-2 h-2 w-11/12 rounded bg-[var(--surface-3)]" />
            <div className="mb-2 h-2 w-10/12 rounded bg-[var(--surface-3)]" />
            <div className="h-16 rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--surface-3)]" />
          </div>

          {/* Brand strip */}
          <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand shadow-glow">
                <Zap size={14} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">Print Campaign Card</p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  <BrandWord /> Material
                </p>
              </div>
            </div>
            <span className="rounded-full border border-accent-500/30 px-2 py-0.5 text-[10px] font-semibold text-accent-500">
              AR ON
            </span>
          </div>

          {/* Card edge highlight */}
          <div className="pointer-events-none absolute inset-x-6 bottom-1 h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent" />
        </div>
      </div>

      {/* Ground glow under card */}
      <div className="pointer-events-none absolute bottom-0 z-0 h-8 w-64 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-lg" style={{ left: '50%' }} />
    </div>

    {/* Ambient radial glow */}
    <div
      className="pointer-events-none absolute inset-0 -z-10 rounded-2xl opacity-40 blur-[44px]"
      style={{ background: 'radial-gradient(circle at 50% 55%, var(--brand) 0%, transparent 70%)' }}
    />
  </motion.div>
);

/* ── Hero ─────────────────────────────────────────────────────────── */
const HeroSection = () => (
  <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pb-16 pt-28 max-[380px]:pb-8 max-[380px]:pt-24 sm:pt-32 lg:flex-row lg:gap-16 lg:pt-24 xl:gap-24">
    {/* Background blobs */}
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/20 blur-[100px] sm:h-[700px] sm:w-[700px] dark:bg-brand-700/25" />
      <div className="absolute right-0 top-1/4 h-[300px] w-[300px] rounded-full bg-accent-500/15 blur-[80px] dark:bg-accent-600/20" />
      <div className="absolute bottom-0 left-1/4 h-[250px] w-[250px] rounded-full bg-brand-400/10 blur-[80px]" />
    </div>

    {/* Left: copy */}
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="flex w-full max-w-2xl flex-col items-center gap-5 max-[380px]:gap-3 text-center lg:items-start lg:text-left"
    >
      <motion.div variants={fadeUp}>
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3.5 py-1.5 text-xs font-semibold text-brand-400 sm:px-4">
          <BrandLogo imgClassName="h-5 w-5 shrink-0 rounded-md object-cover object-center" />
          6 campaign types &mdash; one platform
        </span>
      </motion.div>

      <motion.h1
        variants={fadeUp}
        className="text-[clamp(2rem,7vw,4.75rem)] max-[380px]:text-[clamp(1.8rem,9vw,2.4rem)] font-extrabold leading-[1.1] tracking-tight text-[var(--text-primary)]"
      >
        Welcome to the <BrandWord /> Movement
      </motion.h1>

      {/* Mobile-first: show hologram immediately under headline */}
      <motion.div variants={fadeUp} className="w-full lg:hidden">
        <div className="mx-auto w-full max-w-sm max-[380px]:-mt-5 max-[380px]:scale-[0.82] max-[380px]:[transform-origin:top_center]">
          <ProductMockup />
        </div>
      </motion.div>

      <motion.p
        variants={fadeUp}
        className="max-w-xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg"
      >
        Where Physical World
        <br />
        <span className="gradient-text">Meets Digital Storytelling</span>
      </motion.p>

      <motion.div
        variants={fadeUp}
        className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
      >
        <Link
          to="/register"
          className="flex min-h-[48px] max-[380px]:min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-7 max-[380px]:px-5 py-3.5 max-[380px]:py-2.5 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:scale-[1.02] hover:bg-brand-500 hover:shadow-glow-lg sm:w-auto"
        >
          Start for Free
          <ArrowRight size={16} />
        </Link>
        <a
          href="#how-it-works"
          className="flex min-h-[48px] max-[380px]:min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-7 max-[380px]:px-5 py-3.5 max-[380px]:py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-all duration-200 hover:scale-[1.02] hover:border-brand-500/50 sm:w-auto"
        >
          See how it works
          <ChevronDown size={15} />
        </a>
      </motion.div>

      <motion.p variants={fadeUp} className="text-xs text-[var(--text-muted)]">
        Trusted by freelancers, agencies, restaurants & real estate pros
      </motion.p>
    </motion.div>

    {/* Right: mockup */}
    <div className="hidden w-full max-w-sm shrink-0 lg:block lg:w-auto">
      <ProductMockup />
    </div>
  </section>
);

export default HeroSection;