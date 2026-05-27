import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Loader2, Rocket, QrCode } from 'lucide-react';
import {
  compositeQrOnCardImage,
  getArQrPreviewUrl,
} from '../../../utils/compositeQrOnCardImage';
import useCampaignStore from '../../../store/useCampaignStore';

const AdminFulfillReview = ({ onSuccess }) => {
  const { requestId } = useParams();
  const {
    wizardData,
    updateWizardData,
    setWizardStep,
    submitFulfillRequest,
    isSubmitting,
    wizardError,
  } = useCampaignStore();
  const [createdCampaign, setCreatedCampaign] = useState(null);
  const [compositedThumb, setCompositedThumb] = useState('');
  const [compositedThumbBusy, setCompositedThumbBusy] = useState(false);

  const imageSrc = wizardData.targetImagePreview || wizardData.targetImageUrl;

  useEffect(() => {
    if (!imageSrc) {
      setCompositedThumb('');
      return undefined;
    }
    let cancelled = false;
    setCompositedThumbBusy(true);
    (async () => {
      try {
        const blob = await compositeQrOnCardImage({
          imageSrc,
          qrDataString: getArQrPreviewUrl(),
          placement: wizardData.qrPlacement,
          qrDesign: wizardData.qrDesign,
        });
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setCompositedThumb(url);
      } catch {
        if (!cancelled) setCompositedThumb('');
      } finally {
        if (!cancelled) setCompositedThumbBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [imageSrc, wizardData.qrPlacement, wizardData.qrDesign]);

  const handleSubmit = async () => {
    const result = await submitFulfillRequest(requestId);
    if (result.success) setCreatedCampaign(result.campaign);
  };

  if (createdCampaign) {
    const id = createdCampaign._id;
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-5 py-4 text-center">
        <CheckCircle2 size={40} className="text-green-400" />
        <h3 className="text-xl font-bold">Campaign published for user</h3>
        <div className="flex gap-3">
          <Link to="/admin/ar-requests" className="rounded-xl border px-4 py-2 text-sm">Back to queue</Link>
          <Link to={`/dashboard/campaigns/${id}`} className="rounded-xl bg-brand-600 px-4 py-2 text-sm text-white">
            View campaign
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold">Review &amp; publish</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Publishes an active AR campaign on the user&apos;s account. A real scan QR is burned onto
          their card at the marker they chose — no manual QR placement needed.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-brand-500/20 bg-brand-500/5 p-3 text-xs text-[var(--text-secondary)]">
        <QrCode size={16} className="mt-0.5 shrink-0 text-brand-400" />
        <p>
          <strong className="text-[var(--text-primary)]">QR placement:</strong>{' '}
          {wizardData.qrPlacement?.preset
            ? wizardData.qrPlacement.preset.replace(/-/g, ' ')
            : `custom (${Math.round((wizardData.qrPlacement?.x ?? 0) * 100)}%, ${Math.round((wizardData.qrPlacement?.y ?? 0) * 100)}%)`}
          {' · '}
          scale {Math.round((wizardData.qrPlacement?.scale ?? 0.22) * 100)}%
        </p>
      </div>

      <p className="text-sm">
        <strong>Campaign name:</strong> {wizardData.campaignName}
      </p>
      {wizardData.linkRows?.length > 0 && (
        <p className="text-sm text-[var(--text-muted)]">
          <strong>Social links:</strong> {wizardData.linkRows.length} from user request
        </p>
      )}
      {compositedThumb && (
        <img src={compositedThumb} alt="Preview" className="max-h-48 rounded-lg border" />
      )}
      {compositedThumbBusy && <p className="text-xs text-[var(--text-muted)]">Generating QR preview…</p>}

      {wizardError && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {wizardError}
        </p>
      )}

      <div className="flex justify-between">
        <button type="button" onClick={() => setWizardStep(1)} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm">
          <ArrowLeft size={14} /> Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !wizardData.videoUrl || !wizardData.videoUrlIos}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
          Publish for user
        </button>
      </div>
    </div>
  );
};

export default AdminFulfillReview;
