import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, CheckCircle2, Clock, Image as ImageIcon, Video, Link2, Loader2, Send,
} from 'lucide-react';
import useArServiceRequestStore from '../../../../store/useArServiceRequestStore';
import { SLA_MESSAGE } from '../../../../services/arServiceRequestService';

const ServiceStepSubmit = ({ onDone, product }) => {
  const assetNoun = product?.assetNoun || 'card';
  const productLabel = product?.label || 'AR Digital Business Card';
  const {
    wizardData,
    setWizardStep,
    submitRequest,
    isSubmitting,
    wizardError,
    openRequestConflictId,
    submittedRequest,
  } = useArServiceRequestStore();

  if (submittedRequest) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6 py-4 text-center"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15">
          <CheckCircle2 size={40} className="text-green-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-[var(--text-primary)]">Request received</h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{SLA_MESSAGE}</p>
        </div>
        <div className="w-full max-w-md rounded-xl border border-brand-500/25 bg-brand-500/10 p-4 text-left text-sm">
          <p className="flex items-center gap-2 font-medium text-brand-300">
            <Clock size={16} /> Ready within 24 hours
          </p>
          <p className="mt-2 text-[var(--text-muted)]">
            Track status under <strong className="text-[var(--text-primary)]">Campaigns → AR requests</strong>.
            We will publish your {productLabel.toLowerCase()} to your account when it is done.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/dashboard/campaigns"
            className="rounded-xl border border-[var(--border-color)] px-5 py-2.5 text-sm font-medium"
          >
            View AR requests
          </Link>
          <button
            type="button"
            onClick={onDone}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Done
          </button>
        </div>
      </motion.div>
    );
  }

  const handleSubmit = async (options = {}) => {
    await submitRequest(options);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Review &amp; submit</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Confirm your assets. Our team will build your full AR experience.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-4">
          <ImageIcon size={18} className="text-brand-400" />
          <span className="text-sm">{assetNoun.charAt(0).toUpperCase() + assetNoun.slice(1)} image uploaded</span>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-4">
          <ImageIcon size={18} className="text-brand-400" />
          <span className="text-sm">QR placement marked</span>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-4">
          <Video size={18} className="text-brand-400" />
          <span className="text-sm">Green-screen MP4 uploaded</span>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-4">
          <Link2 size={18} className="text-brand-400" />
          <span className="text-sm">
            {wizardData.linkRows?.length
              ? `${wizardData.linkRows.length} social link(s)`
              : 'No social links (optional)'}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-[var(--text-secondary)]">
        <p className="flex items-center gap-2 font-medium text-amber-200">
          <Clock size={16} /> 24-hour turnaround
        </p>
        <p className="mt-2">
          After you submit, our team configures your hologram and AR {assetNoun} within <strong>24 hours</strong>.
          You will see the live campaign in your dashboard when it is ready.
        </p>
      </div>

      {wizardError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <p>{wizardError}</p>
          {openRequestConflictId && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/dashboard/campaigns"
                state={{ tab: 'ar-requests' }}
                className="rounded-lg border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/10"
              >
                View my request
              </Link>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSubmit({ replaceOpen: true })}
                className="rounded-lg bg-red-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                Cancel previous &amp; submit again
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button type="button" onClick={() => setWizardStep(3)} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2.5 text-sm">
          <ArrowLeft size={15} /> Back
        </button>
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={isSubmitting}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          Submit request
        </button>
      </div>
    </div>
  );
};

export default ServiceStepSubmit;
