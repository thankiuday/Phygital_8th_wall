import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, Mail, MapPin, MessageSquare, Phone, Sparkles, Users } from 'lucide-react';
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

const quickItems = [
  {
    title: 'Quick Responses',
    text: 'We typically respond within 24 hours',
    icon: Clock3,
    accent: ICON3D_PRESETS.cyan,
  },
  {
    title: 'Personal Touch',
    text: 'Real humans, real conversations',
    icon: Users,
    accent: ICON3D_PRESETS.violet,
  },
  {
    title: 'Solutions-Focused',
    text: "We're here to make things happen",
    icon: Sparkles,
    accent: ICON3D_PRESETS.emerald,
  },
];

const faqItems = [
  {
    q: 'How do I get started with Phygital?',
    a: 'Simply sign up for a free account, upload your design, and follow our 5-step process to create your first phygital experience.',
  },
  {
    q: 'What file formats do you support?',
    a: 'We support JPG/JPEG images (max 20MB) and MP4 videos (max 50MB) for the best quality and compatibility.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes! We offer a completely free tier that allows you to create and manage multiple projects with full access to all features.',
  },
];

const ContactPage = () => {
  const [sent, setSent] = useState(false);

  const onSubmit = (e) => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  };

  return (
    <div className="overflow-hidden bg-[var(--bg-primary)]">
      <SEOHead
        title="Contact Us"
        description="Have questions, ideas, or feedback? Reach out and our team will help bring your phygital vision to life."
      />

      <section className="px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 md:px-8 lg:px-16 lg:pt-24 xl:px-24">
        <div className="content-width">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-center"
          >
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-500">Contact</p>
            <h1 className="text-[clamp(2rem,6vw,3.5rem)] font-extrabold leading-tight text-[var(--text-primary)]">
              Let&apos;s Start a
              <br />
              <span className="gradient-text">Conversation</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--text-secondary)] sm:text-base">
              Have questions? Ideas? Feedback? We&apos;re here to listen and help you bring your phygital vision to life.
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.1 }}
            className="mt-8 grid gap-4 md:grid-cols-3"
          >
            {quickItems.map((item) => (
              <motion.article
                key={item.title}
                variants={fadeUp}
                className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-5 shadow-[var(--shadow-sm)]"
              >
                <div className="mb-3 flex items-center gap-3">
                  <Icon3D icon={item.icon} size={14} className="h-9 w-9" accent={item.accent} rounded="rounded-lg" />
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">{item.title}</h2>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">{item.text}</p>
              </motion.article>
            ))}
          </motion.div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <motion.section
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.1 }}
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-md)] sm:p-8"
            >
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">Send us a Message</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Fill out the form below and we&apos;ll get back to you within 24 hours.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium text-[var(--text-primary)]">
                    <span>First Name</span>
                    <input className="form-input" placeholder="Enter your first name" required />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-[var(--text-primary)]">
                    <span>Last Name</span>
                    <input className="form-input" placeholder="Enter your last name" required />
                  </label>
                </div>
                <label className="space-y-2 text-sm font-medium text-[var(--text-primary)]">
                  <span>Email Address</span>
                  <input type="email" className="form-input" placeholder="Enter your email" required />
                </label>
                <label className="space-y-2 text-sm font-medium text-[var(--text-primary)]">
                  <span>Subject</span>
                  <input className="form-input" placeholder="What's this about?" required />
                </label>
                <label className="space-y-2 text-sm font-medium text-[var(--text-primary)]">
                  <span>Message</span>
                  <textarea
                    className="form-input min-h-[140px] resize-y"
                    placeholder="Tell us how we can help you..."
                    required
                  />
                </label>
                <button
                  type="submit"
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-500 hover:shadow-glow"
                >
                  <Icon3D icon={MessageSquare} size={12} className="h-7 w-7" accent={ICON3D_PRESETS.violet} rounded="rounded-md" />
                  {sent ? 'Message Sent!' : 'Send Message'}
                </button>
              </form>
            </motion.section>

            <motion.aside
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.1 }}
              className="space-y-4"
            >
              <motion.article variants={fadeUp} className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-5 shadow-[var(--shadow-sm)]">
                <div className="mb-2 flex items-center gap-3">
                  <Icon3D icon={Mail} size={13} className="h-8 w-8" accent={ICON3D_PRESETS.cyan} rounded="rounded-lg" />
                  <h3 className="font-semibold text-[var(--text-primary)]">Email Us Directly</h3>
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)]">phygital.zone@gmail.com</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Send us an email anytime</p>
              </motion.article>

              <motion.article variants={fadeUp} className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-5 shadow-[var(--shadow-sm)]">
                <div className="mb-2 flex items-center gap-3">
                  <Icon3D icon={Phone} size={13} className="h-8 w-8" accent={ICON3D_PRESETS.emerald} rounded="rounded-lg" />
                  <h3 className="font-semibold text-[var(--text-primary)]">Call Us</h3>
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)]">(704) 966-7158</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Give us a call anytime</p>
              </motion.article>

              <motion.article variants={fadeUp} className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-5 shadow-[var(--shadow-sm)]">
                <div className="mb-2 flex items-center gap-3">
                  <Icon3D icon={MapPin} size={13} className="h-8 w-8" accent={ICON3D_PRESETS.rose} rounded="rounded-lg" />
                  <h3 className="font-semibold text-[var(--text-primary)]">Our Location</h3>
                </div>
                <div className="space-y-3 text-sm text-[var(--text-secondary)]">
                  <p>
                    3440 Toringdon Way, #205
                    <br />
                    Charlotte, NC 28277
                  </p>
                  <p>
                    490 Post St STE 500
                    <br />
                    San Francisco, CA 94102
                    <br />
                    United States
                  </p>
                </div>
              </motion.article>

              <motion.article variants={fadeUp} className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-5 shadow-[var(--shadow-sm)]">
                <div className="mb-2 flex items-center gap-3">
                  <Icon3D icon={Clock3} size={13} className="h-8 w-8" accent={ICON3D_PRESETS.amber} rounded="rounded-lg" />
                  <h3 className="font-semibold text-[var(--text-primary)]">Business Hours</h3>
                </div>
                <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                  <p>Monday - Friday: 9AM - 6PM EST</p>
                  <p>Saturday: 10AM - 4PM EST</p>
                  <p className="pt-1 text-[var(--text-muted)]">We&apos;re here to help</p>
                </div>
              </motion.article>
            </motion.aside>
          </div>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.45 }}
            className="mt-12 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-md)] sm:p-8"
          >
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">Quick Answers</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {faqItems.map((faq) => (
                <article key={faq.q} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{faq.q}</h3>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">{faq.a}</p>
                </article>
              ))}
            </div>
            <div className="mt-6 text-center">
              <Link
                to="/#faq"
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-500 transition-colors hover:text-brand-400"
              >
                Need more help? View all FAQs
                <ArrowRight size={14} />
              </Link>
            </div>
          </motion.section>
        </div>
      </section>
    </div>
  );
};

export default ContactPage;
