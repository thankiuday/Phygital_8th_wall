import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, HeartHandshake, Sparkles, Users, Wand2 } from 'lucide-react';
import SEOHead from '../components/ui/SEOHead';
import Icon3D, { ICON3D_PRESETS } from '../components/ui/Icon3D';

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const values = [
  {
    title: 'Emotion-First Design',
    text: 'We believe technology should move people, not just serve them. Every feature is crafted to create meaningful connections.',
    icon: HeartHandshake,
  },
  {
    title: 'Accessibility for All',
    text: 'Advanced technology should be simple. We make powerful AR experiences accessible to everyone, everywhere.',
    icon: Users,
  },
  {
    title: 'Innovation with Purpose',
    text: "We don't innovate for the sake of it. Every advancement serves one goal: helping you tell better stories.",
    icon: Sparkles,
  },
  {
    title: 'Community-Driven',
    text: 'The Phygital Movement is built by creators, for creators. Your feedback shapes our future.',
    icon: Wand2,
  },
];

const timeline = [
  {
    phase: 'The Beginning',
    title: 'A Vision Takes Shape',
    text: 'Started with a simple question: What if every physical design could tell a digital story?',
  },
  {
    phase: 'The Launch',
    title: 'Phygital Zone Goes Live',
    text: 'Turned vision into reality. Launched the platform that bridges physical and digital worlds.',
  },
  {
    phase: 'The Movement',
    title: 'Growing Together',
    text: 'From a tool to a movement. Thousands of creators now bringing their designs to life.',
  },
];

const stats = [
  { value: '10K+', label: 'Active Creators' },
  { value: '50K+', label: 'Experiences Created' },
  { value: '1M+', label: 'Connections Made' },
  { value: '95%', label: 'Love What We Do' },
];

const valueAccents = [
  ICON3D_PRESETS.rose,
  ICON3D_PRESETS.emerald,
  ICON3D_PRESETS.violet,
  ICON3D_PRESETS.cyan,
];

const AboutPage = () => (
  <div className="overflow-hidden bg-[var(--bg-primary)]">
    <SEOHead
      title="About Phygital Zone"
      description="Learn our story, mission, and vision behind the movement connecting physical designs with meaningful digital experiences."
    />

    <section className="px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 md:px-8 lg:px-16 lg:pt-24 xl:px-24">
      <div className="content-width">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-500">About Us</p>
          <h1 className="text-[clamp(2rem,6vw,3.6rem)] font-extrabold leading-tight text-[var(--text-primary)]">
            We&apos;re Building More Than
            <br />
            <span className="gradient-text">A Platform</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--text-secondary)] sm:text-base">
            We&apos;re building a movement where physical and digital worlds merge into experiences that move people.
          </p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="mx-auto mt-8 max-w-4xl rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-5 text-sm text-[var(--text-secondary)] shadow-[var(--shadow-md)] sm:p-7 sm:text-base"
        >
          From dynamic QR updates to video/AR storytelling and digital card hubs, we design tools that make every
          physical touchpoint more alive, more human, and more memorable.
        </motion.div>

        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="mt-12 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-md)] sm:p-8"
        >
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Our Story</h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
            <p>
              Phygital Zone began with a simple observation: the world is filled with beautiful designs — posters,
              business cards, product packaging, art — but they often lack the ability to tell their complete story.
            </p>
            <p>
              We live between two worlds — one physical, one digital. Most tools force you to choose. We decided to
              bridge them.
            </p>
            <p>
              What started as a technical solution evolved into something deeper: a platform that helps creators,
              brands, educators, and dreamers connect emotionally with their audience.
            </p>
            <p>
              Today, Phygital Zone is more than a tool — it&apos;s a movement redefining how we experience the world around
              us.
            </p>
          </div>
        </motion.section>

        <motion.section
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          className="mt-8 grid gap-5 md:grid-cols-2"
        >
          <motion.article
            variants={fadeUp}
            className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-sm)] sm:p-7"
          >
            <h3 className="text-xl font-bold text-[var(--text-primary)]">Our Mission</h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
              To democratize interactive experiences and empower everyone to transform their physical creations into
              stories that resonate, connect, and inspire.
            </p>
          </motion.article>
          <motion.article
            variants={fadeUp}
            className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-sm)] sm:p-7"
          >
            <h3 className="text-xl font-bold text-[var(--text-primary)]">Our Vision</h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
              A world where every physical touchpoint becomes a gateway to rich, meaningful digital experiences —
              making information more engaging, connections deeper, and stories unforgettable.
            </p>
          </motion.article>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45 }}
          className="mt-12"
        >
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">What Drives Us</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)] sm:text-base">
              The principles that guide every decision we make
            </p>
          </div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.1 }}
            className="mt-6 grid gap-4 sm:grid-cols-2"
          >
            {values.map((item, idx) => (
              <motion.article
                key={item.title}
                variants={fadeUp}
                className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-5 shadow-[var(--shadow-sm)] sm:p-6"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                  <Icon3D
                    icon={item.icon}
                    size={12}
                    className="h-10 w-10"
                    accent={valueAccents[idx]}
                    rounded="rounded-lg"
                  />
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{item.text}</p>
              </motion.article>
            ))}
          </motion.div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45 }}
          className="mt-12"
        >
          <h2 className="text-center text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">Our Journey</h2>
          <div className="mx-auto mt-6 max-w-4xl space-y-4">
            {timeline.map((step) => (
              <article
                key={step.phase}
                className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-5 shadow-[var(--shadow-sm)] sm:p-6"
              >
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-500">
                  <Icon3D icon={Sparkles} size={10} className="h-6 w-6" accent={ICON3D_PRESETS.brand} rounded="rounded-md" />
                  {step.phase}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{step.title}</h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{step.text}</p>
              </article>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45 }}
          className="mt-12 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-6 text-center shadow-[var(--shadow-md)] sm:p-8"
        >
          <h2 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">Growing Together</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)] sm:text-base">
            The movement is gaining momentum
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
                <div className="mb-2 flex justify-center">
                  <Icon3D icon={Users} size={10} className="h-7 w-7" accent={ICON3D_PRESETS.violet} rounded="rounded-md" />
                </div>
                <p className="text-2xl font-extrabold text-[var(--text-primary)]">{stat.value}</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{stat.label}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45 }}
          className="mt-12 rounded-2xl border border-brand-500/30 bg-brand-500/5 p-6 text-center sm:p-8"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-500">Join the Movement</p>
          <h2 className="mt-2 text-[clamp(1.8rem,4vw,2.8rem)] font-extrabold leading-tight text-[var(--text-primary)]">
            Be Part of Something
            <br />
            Bigger
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[var(--text-secondary)] sm:text-base">
            Start creating experiences that bridge worlds and move people.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-500 hover:shadow-glow"
            >
              Start Creating Free
              <ArrowRight size={15} />
            </Link>
            <Link
              to="/contact"
              className="flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] px-6 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-brand-500/50 hover:text-brand-500"
            >
              Get in Touch
            </Link>
          </div>
        </motion.section>
      </div>
    </section>
  </div>
);

export default AboutPage;
