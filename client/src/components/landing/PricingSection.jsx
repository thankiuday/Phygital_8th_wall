import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Layers, X } from 'lucide-react';
import Icon3D, { ICON3D_PRESETS } from '../ui/Icon3D';
import { pricingPlans } from '../../data/pricingPlans';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const PricingSection = () => {
  const [billingCycle, setBillingCycle] = useState('monthly');

  const cycleLabel = useMemo(
    () => (billingCycle === 'monthly' ? 'Monthly' : 'Yearly'),
    [billingCycle]
  );

  return (
    <section
      id="pricing"
      className="bg-[var(--bg-primary)] px-4 py-16 sm:px-6 sm:py-20 md:px-8 lg:px-16 xl:px-24"
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
            Simple, transparent{' '}
            <span className="gradient-text">pricing</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--text-secondary)] sm:text-base">
            Start free. Upgrade when you&apos;re ready. No hidden fees, no lock-in.
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
          viewport={{ once: true, amount: 0.1 }}
          className="grid gap-5 sm:gap-6 lg:grid-cols-3"
        >
          {pricingPlans.map((plan) => {
            const priceInfo = billingCycle === 'monthly' ? plan.monthly : plan.yearly;
            return (
              <motion.article
                key={plan.id}
                variants={fadeUp}
                className={`relative flex h-full flex-col rounded-2xl border p-6 transition-all duration-300 sm:p-7 ${
                  plan.featured
                    ? 'border-brand-500 bg-brand-500/5 shadow-glow'
                    : 'border-[var(--border-color)] bg-[var(--surface-1)]'
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-brand-600 px-4 py-1 text-xs font-bold text-white shadow-glow">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="inline-flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
                    <Icon3D
                      icon={Layers}
                      size={10}
                      className="h-6 w-6"
                      accent={plan.featured ? ICON3D_PRESETS.brand : ICON3D_PRESETS.slate}
                      rounded="rounded-md"
                    />
                    {plan.name}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--text-muted)] sm:text-sm">{plan.subtitle}</p>
                  <div className="mt-4">
                    {priceInfo.oldPrice && (
                      <p className="text-sm text-[var(--text-muted)] line-through">{priceInfo.oldPrice}</p>
                    )}
                    <p className="text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold leading-tight tracking-tight text-[var(--text-primary)]">
                      {priceInfo.price}
                    </p>
                    {priceInfo.period && (
                      <p className="mt-0.5 text-sm text-[var(--text-muted)]">{priceInfo.period}</p>
                    )}
                  </div>
                </div>

                <ul className="mb-6 flex flex-1 flex-col gap-2.5">
                  {plan.features.map((feat) => {
                    const excluded = feat.startsWith('No ');
                    return (
                      <li key={feat} className="flex items-start gap-2.5 text-sm">
                        {excluded ? (
                          <X size={15} className="mt-0.5 shrink-0 text-[var(--text-muted)]" aria-hidden />
                        ) : (
                          <Check
                            size={15}
                            className={`mt-0.5 shrink-0 ${plan.featured ? 'text-brand-400' : 'text-emerald-400'}`}
                            aria-hidden
                          />
                        )}
                        <span className={excluded ? 'text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}>
                          {feat}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <Link
                  to={plan.ctaTo}
                  className={`mt-auto flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] ${
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

        <p className="mt-8 text-center text-xs text-[var(--text-muted)]">
          {cycleLabel} billing shown. See the{' '}
          <Link to="/pricing" className="font-medium text-brand-500 hover:text-brand-400">
            full pricing page
          </Link>{' '}
          for a feature comparison.
        </p>
      </div>
    </section>
  );
};

export default PricingSection;
