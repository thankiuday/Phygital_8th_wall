import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowLeft, Hammer } from 'lucide-react';

/**
 * ComingSoonPage — shared placeholder for campaign types that aren't built yet.
 *
 * Receives a human-readable `type` prop from the route (e.g. "Phygital QR")
 * so we can reuse a single component for every unbuilt campaign type.
 */
const ComingSoonPage = ({ type = 'This campaign type' }) => (
  <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="glass-card flex w-full flex-col items-center gap-5 p-8 text-center md:p-10"
    >
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-brand shadow-glow-lg">
          <Hammer size={32} className="text-white" />
        </div>
        <Sparkles
          size={20}
          className="absolute -right-2 -top-2 text-brand-400"
        />
      </div>

      <div className="space-y-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-400">
          Coming soon
        </span>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {type}
        </h1>
        <p className="max-w-md text-sm text-[var(--text-secondary)]">
          We're putting the finishing touches on this Phygitalize flow. In the
          meantime, you can create an AR Digital Business Card to get started.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/dashboard/campaigns/new/digital-business-card/ar"
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-500 hover:shadow-glow-lg"
        >
          <Sparkles size={15} />
          Try AR Digital Business Card
        </Link>
        <Link
          to="/dashboard/campaigns"
          className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-5 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:border-brand-500/40 hover:text-[var(--text-primary)]"
        >
          <ArrowLeft size={15} />
          Back to Campaigns
        </Link>
      </div>
    </motion.div>
  </div>
);

export default ComingSoonPage;
