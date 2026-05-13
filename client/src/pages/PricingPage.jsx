import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CreditCard, HelpCircle, Layers, X } from 'lucide-react';
import SEOHead from '../components/ui/SEOHead';
import Icon3D, { ICON3D_PRESETS } from '../components/ui/Icon3D';
import { pricingPlans as plans } from '../data/pricingPlans';

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const compareRows = [
  { feature: 'Price (monthly)', free: '$0', pro: '$14.99', enterprise: 'Ask for Quote' },
  { feature: 'Price (yearly)', free: '$0', pro: '$149', enterprise: 'Ask for Quote' },
  { feature: 'QR type', free: 'Dynamic', pro: 'Dynamic', enterprise: 'Dynamic' },
  { feature: 'No. of QR codes', free: 'Unlimited', pro: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'No. of scans', free: 'Unlimited', pro: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'Dynamic update', free: true, pro: true, enterprise: true },
  { feature: 'Video / AR hosting', free: false, pro: 'Yes (10 videos)', enterprise: 'Unlimited' },
  { feature: 'AR Navigation', free: false, pro: false, enterprise: true },
  { feature: 'AR Search', free: false, pro: false, enterprise: true },
  {
    feature: 'AR Object scan to redirect (No QR, your object is your QR)',
    free: false,
    pro: false,
    enterprise: true,
  },
  { feature: 'Analytics', free: 'Basic', pro: 'Advanced', enterprise: 'Advanced + exportable reports' },
  { feature: 'Custom branding', free: false, pro: true, enterprise: 'Full white-label' },
  { feature: 'Bulk creation', free: false, pro: 'Limited', enterprise: true },
  { feature: 'API integration', free: false, pro: false, enterprise: true },
  { feature: 'Multi-user / team access', free: false, pro: false, enterprise: 'Yes (team & client accounts)' },
  { feature: 'Assign QR codes to customer email', free: false, pro: false, enterprise: true },
  { feature: 'Earn commission credit on customer upgrades', free: false, pro: false, enterprise: true },
  { feature: 'Best for', free: 'Personal use', pro: 'SMBs (AR & video storytelling)', enterprise: 'Enterprises' },
];

const ValueCell = ({ value }) => {
  if (value === true) {
    return <Check size={16} className="mx-auto text-emerald-500" aria-label="Included" />;
  }
  if (value === false) {
    return <X size={16} className="mx-auto text-[var(--text-muted)]" aria-label="Not included" />;
  }
  return <span>{value}</span>;
};

const PricingPage = () => {
  const [billingCycle, setBillingCycle] = useState('monthly');

  const cycleLabel = useMemo(
    () => (billingCycle === 'monthly' ? 'Monthly' : 'Yearly'),
    [billingCycle]
  );

  return (
    <div className="overflow-hidden bg-[var(--bg-primary)]">
      <SEOHead
        title="Pricing Plans"
        description="Simple, transparent pricing for QR and AR storytelling campaigns. Start free and scale to enterprise."
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
            <div className="mb-2 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand-500">
              <Icon3D icon={CreditCard} size={11} className="h-7 w-7" accent={ICON3D_PRESETS.violet} rounded="rounded-md" />
              Pricing
            </div>
            <h1 className="text-[clamp(2rem,6vw,3.5rem)] font-extrabold leading-tight text-[var(--text-primary)]">
              Simple, Transparent
              <span className="gradient-text"> Pricing</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--text-secondary)] sm:text-base">
              Choose the perfect plan for your needs. Start free and upgrade as you grow.
            </p>

            <div className="mt-7 inline-flex rounded-2xl border border-[var(--border-color)] bg-[var(--surface-2)] p-1">
              {['monthly', 'yearly'].map((cycle) => (
                <button
                  key={cycle}
                  type="button"
                  onClick={() => setBillingCycle(cycle)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all sm:px-6 ${
                    billingCycle === cycle
                      ? 'bg-brand-600 text-white shadow-glow'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {cycle === 'monthly' ? 'Monthly' : 'Yearly'}
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.08 }}
            className="mt-10 grid gap-5 lg:grid-cols-3"
          >
            {plans.map((plan) => {
              const priceInfo = billingCycle === 'monthly' ? plan.monthly : plan.yearly;
              return (
                <motion.article
                  key={plan.id}
                  variants={fadeUp}
                  className={`relative flex h-full flex-col rounded-2xl border p-5 sm:p-6 ${
                    plan.featured
                      ? 'border-brand-500 bg-brand-500/5 shadow-glow'
                      : 'border-[var(--border-color)] bg-[var(--surface-1)]'
                  }`}
                >
                  {plan.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div>
                    <h2 className="inline-flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
                      <Icon3D
                        icon={Layers}
                        size={10}
                        className="h-6 w-6"
                        accent={plan.featured ? ICON3D_PRESETS.brand : ICON3D_PRESETS.slate}
                        rounded="rounded-md"
                      />
                      {plan.name}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{plan.subtitle}</p>
                    <div className="mt-5">
                      {priceInfo.oldPrice && (
                        <p className="text-sm text-[var(--text-muted)] line-through">{priceInfo.oldPrice}</p>
                      )}
                      <p className="text-[clamp(1.8rem,4vw,2.5rem)] font-extrabold leading-tight text-[var(--text-primary)]">
                        {priceInfo.price}
                      </p>
                      {priceInfo.period && (
                        <p className="text-sm text-[var(--text-muted)]">
                          {priceInfo.period}
                        </p>
                      )}
                    </div>
                  </div>

                  <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                    {plan.features.map((feature) => {
                      const excluded = feature.startsWith('No ');
                      return (
                        <li key={feature} className="flex items-start gap-2.5 text-sm">
                          {excluded ? (
                            <X size={15} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
                          ) : (
                            <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                          )}
                          <span className={excluded ? 'text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}>
                            {feature}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  <Link
                    to={plan.ctaTo}
                    className={`mt-6 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] ${
                      plan.featured
                        ? 'bg-brand-600 text-white shadow-glow hover:bg-brand-500 hover:shadow-glow-lg'
                        : 'border border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:border-brand-500/50'
                    }`}
                  >
                    {plan.ctaLabel}
                    <ArrowRight size={14} />
                  </Link>
                </motion.article>
              );
            })}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.45 }}
            className="mt-16"
          >
            <div className="mb-5 text-center">
              <h2 className="inline-flex items-center justify-center gap-2 text-[clamp(1.4rem,3.2vw,2rem)] font-bold text-[var(--text-primary)]">
                <Icon3D icon={Layers} size={12} className="h-8 w-8" accent={ICON3D_PRESETS.cyan} rounded="rounded-lg" />
                Compare Features
              </h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                See how our plans stack up against each other
              </p>
            </div>

            <div className="hidden overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] shadow-[var(--shadow-md)] md:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[var(--surface-2)] text-left">
                    <th className="px-5 py-3 font-semibold text-[var(--text-primary)]">Feature</th>
                    <th className="px-4 py-3 text-center font-semibold text-[var(--text-primary)]">QR (Free)</th>
                    <th className="px-4 py-3 text-center font-semibold text-[var(--text-primary)]">Phygital QR</th>
                    <th className="px-4 py-3 text-center font-semibold text-[var(--text-primary)]">Phygital Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row) => (
                    <tr key={row.feature} className="border-t border-[var(--border-subtle)]">
                      <td className="px-5 py-3 text-[var(--text-secondary)]">{row.feature}</td>
                      <td className="px-4 py-3 text-center text-[var(--text-primary)]"><ValueCell value={row.free} /></td>
                      <td className="px-4 py-3 text-center text-[var(--text-primary)]"><ValueCell value={row.pro} /></td>
                      <td className="px-4 py-3 text-center text-[var(--text-primary)]"><ValueCell value={row.enterprise} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {compareRows.map((row) => (
                <div
                  key={row.feature}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4 shadow-[var(--shadow-sm)]"
                >
                  <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{row.feature}</p>
                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    <div>
                      <p className="mb-1 text-[var(--text-muted)]">Free</p>
                      <div className="text-[var(--text-secondary)]"><ValueCell value={row.free} /></div>
                    </div>
                    <div>
                      <p className="mb-1 text-[var(--text-muted)]">Phygital</p>
                      <div className="text-[var(--text-secondary)]"><ValueCell value={row.pro} /></div>
                    </div>
                    <div>
                      <p className="mb-1 text-[var(--text-muted)]">Enterprise</p>
                      <div className="text-[var(--text-secondary)]"><ValueCell value={row.enterprise} /></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.45 }}
            className="mt-14 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-6 text-center shadow-[var(--shadow-md)] sm:p-8"
          >
            <h3 className="inline-flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]">
              <Icon3D icon={HelpCircle} size={12} className="h-8 w-8" accent={ICON3D_PRESETS.amber} rounded="rounded-lg" />
              Still have questions?
            </h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Our team is here to help you choose the right plan for your needs.
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/contact"
                className="flex min-h-[44px] items-center justify-center rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-500 hover:shadow-glow"
              >
                Contact Us
              </Link>
              <a
                href="tel:+919000000000"
                className="flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-6 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-brand-500/50 hover:text-brand-500"
              >
                Call Us
              </a>
            </div>
            <p className="mt-4 text-xs font-medium text-[var(--text-muted)]">{cycleLabel} billing selected</p>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default PricingPage;
