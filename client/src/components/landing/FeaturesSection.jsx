import { motion } from 'framer-motion';
import { QrCode, BarChart3, Globe } from 'lucide-react';
import Icon3D, { ICON3D_PRESETS } from '../ui/Icon3D';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.08 } },
};

const FEATURES = [
  {
    icon: QrCode,
    accent: ICON3D_PRESETS.violet,
    title: 'Instant QR Codes',
    desc: 'Auto-generate styled, branded QR codes the moment your campaign goes live. Download as SVG, PNG, or print-ready PDF.',
  },
  {
    icon: BarChart3,
    accent: ICON3D_PRESETS.emerald,
    title: 'Real-time Analytics',
    desc: 'Track scans, unique visitors, session time, video completion, link clicks, and geo data — updated the instant someone taps.',
  },
  {
    icon: Globe,
    accent: ICON3D_PRESETS.cyan,
    title: 'Works on Any Phone',
    desc: 'Pure browser-based — iOS, Android, Chrome, Safari. No app download. Just scan and experience.',
  },
];

const FeaturesSection = () => (
  <section
    id="features"
    className="bg-[var(--bg-secondary)] px-4 py-16 sm:px-6 sm:py-20 md:px-8 lg:px-16 xl:px-24"
  >
    <div className="content-width">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.5 }}
        className="mb-10 text-center sm:mb-12"
      >
        <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-tight tracking-tight text-[var(--text-primary)]">
          Built for the whole{' '}
          <span className="gradient-text">journey</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--text-secondary)] sm:text-base">
          From first scan to final conversion, every tool you need is already here.
        </p>
      </motion.div>

      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
        className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
      >
        {FEATURES.map(({ icon, accent, title, desc }) => (
          <motion.div
            key={title}
            variants={fadeUp}
            className="glass-card p-6 transition-all duration-300 hover:-translate-y-1"
          >
            <Icon3D icon={icon} size={18} className="mb-4 h-11 w-11" accent={accent} />
            <h3 className="mb-2 text-base font-semibold text-[var(--text-primary)]">{title}</h3>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

export default FeaturesSection;
