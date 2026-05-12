import { motion } from 'framer-motion';
import { PlusCircle, QrCode, TrendingUp } from 'lucide-react';
import Icon3D, { ICON3D_PRESETS } from '../ui/Icon3D';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.12 } },
};

const STEPS = [
  {
    number: '01',
    icon: PlusCircle,
    accent: ICON3D_PRESETS.violet,
    title: 'Create your campaign',
    desc: 'Pick a campaign type, fill in your content — links, video, documents, or a digital card — and publish in minutes.',
  },
  {
    number: '02',
    icon: QrCode,
    accent: ICON3D_PRESETS.cyan,
    title: 'Share your QR code',
    desc: 'Your branded QR is auto-generated and ready to download, print, or embed anywhere — business cards, flyers, menus.',
  },
  {
    number: '03',
    icon: TrendingUp,
    accent: ICON3D_PRESETS.emerald,
    title: 'Watch it convert',
    desc: 'Every scan updates your live analytics dashboard — scans, locations, session time, link clicks, and video completion.',
  },
];

const HowItWorksSection = () => (
  <section
    id="how-it-works"
    className="bg-[var(--bg-primary)] px-4 py-16 sm:px-6 sm:py-20 md:px-8 lg:px-16 xl:px-24"
  >
    <div className="content-width">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.5 }}
        className="mb-12 text-center sm:mb-16"
      >
        <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-tight tracking-tight text-[var(--text-primary)]">
          Live in <span className="gradient-text">3 steps</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--text-secondary)] sm:text-base">
          No technical setup. No app store. From zero to your first scan in under two minutes.
        </p>
      </motion.div>

      {/* Steps */}
      <div className="relative">
        {/* Connecting line — desktop only */}
        <div
          className="absolute left-1/2 top-9 hidden h-px w-2/3 -translate-x-1/2 border-t border-dashed border-[var(--border-color)] lg:block"
          aria-hidden="true"
        />

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          className="grid gap-8 lg:grid-cols-3 lg:gap-6"
        >
          {STEPS.map(({ number, icon, accent, title, desc }) => (
            <motion.div
              key={number}
              variants={fadeUp}
              className="flex flex-col items-center text-center lg:items-center"
            >
              {/* Number + icon bubble */}
              <div className="relative mb-5 flex flex-col items-center">
                <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--surface-solid)] shadow-[var(--shadow-md)]">
                  <Icon3D icon={icon} size={20} className="h-10 w-10" accent={accent} rounded="rounded-xl" />
                </div>
                <span className="mt-2 text-[clamp(2.5rem,6vw,4rem)] font-black leading-none tracking-tighter gradient-text opacity-20 select-none">
                  {number}
                </span>
              </div>

              <h3 className="mb-2 text-base font-bold text-[var(--text-primary)] sm:text-lg">
                {title}
              </h3>
              <p className="max-w-xs text-sm leading-relaxed text-[var(--text-secondary)]">
                {desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  </section>
);

export default HowItWorksSection;
