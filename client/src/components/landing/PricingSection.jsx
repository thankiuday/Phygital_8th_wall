import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.08 } },
};

const TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'Free',
    period: null,
    tagline: 'Perfect for getting started',
    recommended: false,
    features: [
      'Up to 3 active campaigns',
      '500 scans / month',
      '1 Dynamic QR code',
      'Basic analytics (7 days)',
      'Standard QR design',
      'Community support',
    ],
    cta: 'Get Started Free',
    ctaClass:
      'border border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:border-brand-500/50',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19',
    period: '/ month',
    tagline: 'For professionals who mean business',
    recommended: true,
    features: [
      'Unlimited campaigns',
      '50,000 scans / month',
      'All 6 campaign types',
      'Full analytics (90 days)',
      'Custom QR design & branding',
      'AR Digital Business Card',
      'Priority email support',
    ],
    cta: 'Start Pro Trial',
    ctaClass: 'bg-brand-600 text-white shadow-glow hover:bg-brand-500 hover:shadow-glow-lg',
  },
  {
    id: 'business',
    name: 'Business',
    price: '$49',
    period: '/ month',
    tagline: 'For teams and agencies',
    recommended: false,
    features: [
      'Everything in Pro',
      'Unlimited scans',
      'White-label QR codes',
      'Team seats (up to 10)',
      'Analytics API access',
      'Custom domain for cards',
      'Dedicated support & onboarding',
    ],
    cta: 'Contact Sales',
    ctaClass:
      'border border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:border-brand-500/50',
  },
];

const PricingSection = () => (
  <section
    id="pricing"
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
          Simple, transparent{' '}
          <span className="gradient-text">pricing</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--text-secondary)] sm:text-base">
          Start free. Upgrade when you're ready. No hidden fees, no lock-in.
        </p>
      </motion.div>

      {/* Tier cards */}
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.1 }}
        className="grid gap-5 sm:gap-6 lg:grid-cols-3"
      >
        {TIERS.map(({ id, name, price, period, tagline, recommended, features, cta, ctaClass }) => (
          <motion.div
            key={id}
            variants={fadeUp}
            className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-300 sm:p-7 ${
              recommended
                ? 'border-brand-500 bg-brand-500/5 shadow-glow'
                : 'border-[var(--border-color)] bg-[var(--surface-1)]'
            }`}
          >
            {/* Recommended badge */}
            {recommended && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-brand-600 px-4 py-1 text-xs font-bold text-white shadow-glow">
                  Most Popular
                </span>
              </div>
            )}

            {/* Tier info */}
            <div className="mb-5">
              <h3 className="text-base font-bold text-[var(--text-primary)]">{name}</h3>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{tagline}</p>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-[clamp(2rem,5vw,2.75rem)] font-extrabold leading-none tracking-tight text-[var(--text-primary)]">
                  {price}
                </span>
                {period && (
                  <span className="mb-1 text-sm text-[var(--text-muted)]">{period}</span>
                )}
              </div>
            </div>

            {/* Features */}
            <ul className="mb-6 flex flex-1 flex-col gap-2.5">
              {features.map((feat) => (
                <li key={feat} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">
                  <Check
                    size={15}
                    className={`mt-0.5 shrink-0 ${recommended ? 'text-brand-400' : 'text-emerald-400'}`}
                  />
                  {feat}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Link
              to="/register"
              className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] ${ctaClass}`}
            >
              {cta}
              <ArrowRight size={14} />
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* Small print */}
      <p className="mt-8 text-center text-xs text-[var(--text-muted)]">
        All plans include a 14-day Pro trial. No credit card required to start.
      </p>
    </div>
  </section>
);

export default PricingSection;
