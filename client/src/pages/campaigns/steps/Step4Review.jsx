import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  QrCode,
  Image as ImageIcon,
  Video as VideoIcon,
  Tag,
  Rocket,
  LayoutDashboard,
} from 'lucide-react';
import useCampaignStore from '../../../store/useCampaignStore';

/* ── Review row ──────────────────────────────────────────────────── */
const ReviewRow = ({ icon: Icon, label, value, preview }) => (
  <div className="flex items-start gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-4">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
      <Icon size={18} />
    </div>
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
    {preview && (
      <img src={preview} alt={label} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
    )}
  </div>
);

/* ── Success state ───────────────────────────────────────────────── */
const SuccessView = ({ campaign, onSuccess }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center gap-5 py-4 text-center"
  >
    <div className="relative">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15">
        <CheckCircle2 size={40} className="text-green-400" />
      </div>
      {/* Pulse ring */}
      <span className="absolute inset-0 animate-ping rounded-full bg-green-500/20" />
    </div>

    <div>
      <h3 className="text-xl font-bold text-[var(--text-primary)]">Campaign is live! 🎉</h3>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        <strong>{campaign?.campaignName}</strong> has been created. Share the QR code and watch the scans roll in!
      </p>
    </div>

    <div className="flex flex-wrap justify-center gap-3">
      <Link
        to="/dashboard/campaigns"
        className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-brand-500/50"
      >
        <LayoutDashboard size={15} />
        My Campaigns
      </Link>
      <Link
        to={`/dashboard/campaigns/${campaign?._id}`}
        className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:bg-brand-500"
      >
        <QrCode size={15} />
        View QR Code &amp; Details
      </Link>
    </div>
  </motion.div>
);

/* ── Step 4 — Review & Submit ────────────────────────────────────── */
const Step4Review = ({ onSuccess }) => {
  const { wizardData, setWizardStep, submitCampaign, isSubmitting, wizardError } = useCampaignStore();
  const [createdCampaign, setCreatedCampaign] = useState(null);

  const handleSubmit = async () => {
    const result = await submitCampaign();
    if (result.success) {
      setCreatedCampaign(result.campaign);
    }
  };

  if (createdCampaign) {
    return <SuccessView campaign={createdCampaign} onSuccess={onSuccess} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Review your campaign</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Everything looks good? Hit <strong>Create Campaign</strong> to go live.
        </p>
      </div>

      {/* Review rows */}
      <div className="flex flex-col gap-3">
        <ReviewRow
          icon={Tag}
          label="Campaign Name"
          value={wizardData.campaignName}
        />
        <ReviewRow
          icon={ImageIcon}
          label="Business Card Image"
          value={wizardData.targetImageUrl ? 'Uploaded ✓' : 'Not uploaded'}
          preview={wizardData.targetImagePreview}
        />
        <ReviewRow
          icon={VideoIcon}
          label="Intro Video"
          value={wizardData.videoUrl ? 'Uploaded ✓' : 'Not uploaded'}
        />
      </div>

      {/* Summary info box */}
      <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4 text-sm">
        <div className="flex items-start gap-2">
          <Rocket size={16} className="mt-0.5 shrink-0 text-brand-400" />
          <p className="text-[var(--text-secondary)]">
            Your campaign will be set to <strong className="text-[var(--text-primary)]">Active</strong> immediately.
            A shareable QR code will be generated automatically. You can pause or edit it anytime.
          </p>
        </div>
      </div>

      {/* API error */}
      {wizardError && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {wizardError}
        </p>
      )}

      {/* Nav buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setWizardStep(3)}
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-brand-500/50 disabled:opacity-50"
        >
          <ArrowLeft size={15} /> Back
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-brand-500 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <><Loader2 size={15} className="animate-spin" /> Creating…</>
          ) : (
            <><Rocket size={15} /> Create Campaign</>
          )}
        </button>
      </div>
    </div>
  );
};

export default Step4Review;
