import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap } from 'lucide-react';

const FinalCtaSection = () => {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    const dest = email.trim()
      ? `/register?email=${encodeURIComponent(email.trim())}`
      : '/register';
    navigate(dest);
  };

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 md:px-8 lg:px-16 xl:px-24">
      <div className="content-width">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-brand p-8 text-center text-white shadow-glow-lg sm:rounded-3xl sm:p-14"
        >
          {/* Decorative radial highlight */}
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              background:
                'radial-gradient(ellipse at top right, rgba(255,255,255,0.15), transparent 60%), radial-gradient(ellipse at bottom left, rgba(255,255,255,0.08), transparent 60%)',
            }}
          />

          {/* Icon */}
          <div className="mb-5 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <Zap size={26} className="text-white" />
            </div>
          </div>

          <h2 className="text-[clamp(1.75rem,5vw,3rem)] font-extrabold leading-tight tracking-tight">
            Your first campaign is free.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-white/80 sm:text-base">
            Join thousands of professionals who turned their printed materials into living, breathing digital experiences.
            No credit card required.
          </p>

          {/* Email + CTA */}
          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-7 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:gap-2"
          >
            <label htmlFor="cta-email" className="sr-only">
              Email address
            </label>
            <input
              id="cta-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="min-h-[48px] flex-1 rounded-xl border border-white/20 bg-white/15 px-4 text-sm text-white placeholder-white/50 backdrop-blur-sm outline-none focus:border-white/50 focus:bg-white/20 transition-all"
            />
            <button
              type="submit"
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-700 shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
            >
              Get Started Free
              <ArrowRight size={15} />
            </button>
          </form>

          <p className="mt-4 text-xs text-white/50">
            No spam. Unsubscribe anytime.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCtaSection;
