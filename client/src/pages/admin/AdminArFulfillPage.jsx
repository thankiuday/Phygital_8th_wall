import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { adminService } from '../../services/adminService';
import useCampaignStore from '../../store/useCampaignStore';
import { campaignLinkItemsToRows } from '../campaigns/multiple-links/multiLinkFormUtils';
import WizardStepBar from '../../components/ui/WizardStepBar';
import AdminFulfillVideoStep from './steps/AdminFulfillVideoStep';
import AdminFulfillReview from './steps/AdminFulfillReview';
import AdminRequestAssetsBar from './AdminRequestAssetsBar';
import { resolveRequestImageUrl } from '../../utils/arServiceRequestMedia';
import { getArMediaProduct } from '../../constants/arMediaProducts';

const FULFILL_STEPS = [
  { number: 1, shortLabel: 'Video', label: 'Upload videos' },
  { number: 2, shortLabel: 'Publish', label: 'Review & publish' },
];

const AdminArFulfillPage = () => {
  const { requestId } = useParams();
  const { wizardStep, resetWizard, updateWizardData, setFulfillRequestId } = useCampaignStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'ar-request', requestId],
    queryFn: () => adminService.getArServiceRequest(requestId),
    enabled: !!requestId,
  });

  useEffect(() => {
    resetWizard();
  }, [requestId, resetWizard]);

  useEffect(() => {
    const req = data?.request;
    if (!req) return;

    const product = getArMediaProduct(req.requestKind || 'ar-card');
    const userLabel = req.userId?.name || req.userId?.email || 'User';
    const defaultName = `${userLabel} ${product.defaultCampaignSuffix}`;

    setFulfillRequestId(requestId, req.requestKind || 'ar-card');

    const placement = req.qrPlacement || {
      x: 0.82,
      y: 0.82,
      scale: 0.26,
      preset: 'bottom-right',
    };

    updateWizardData({
      campaignName: defaultName,
      targetImageUrl: req.targetImageUrl,
      targetImagePublicId: req.targetImagePublicId,
      targetImagePreview: resolveRequestImageUrl(req) || req.targetImageUrl,
      qrPlacement: placement,
      linkRows: campaignLinkItemsToRows(req.linkItems),
      qrDesign: { frame: 'bottom-bar', frameCaption: 'Scan me!' },
    });

    if (req.status === 'submitted') {
      adminService.updateArServiceRequest(req._id, { status: 'in_progress' }).catch(() => {});
    }
  }, [data, updateWizardData, requestId, setFulfillRequestId]);

  const stepComponents = [
    <AdminFulfillVideoStep key={1} />,
    <AdminFulfillReview key={2} />,
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-brand-400" size={32} />
      </div>
    );
  }

  if (error || !data?.request) {
    return (
      <p className="text-red-400">
        {error?.message || 'Request not found'}
        <Link to="/admin/ar-requests" className="ml-2 text-brand-400">Back</Link>
      </p>
    );
  }

  const req = data.request;
  const product = getArMediaProduct(req.requestKind || 'ar-card');
  const assetNoun = product.assetNoun;

  if (req.status === 'completed') {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-sm text-[var(--text-muted)]">This request is already completed.</p>
        <Link to="/admin/ar-requests" className="mt-4 inline-block text-brand-400">Back to queue</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/admin/ar-requests" className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-brand-400">
        <ArrowLeft size={14} /> AR requests
      </Link>
      <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-3 text-sm">
        <span className="mb-2 inline-block rounded-full bg-brand-500/15 px-2 py-0.5 text-xs font-semibold text-brand-300">
          {product.shortLabel}
        </span>
        <p className="mt-1">
          Fulfilling for <strong>{req.userId?.email}</strong> — their {assetNoun} image, QR marker, and social links
          are already on file. Convert their green-screen MP4 to WebM + iOS .mov, upload both, then publish.
          The system composites a <strong>live AR QR</strong> on their marker automatically.
        </p>
      </div>

      <AdminRequestAssetsBar request={req} />

      <WizardStepBar steps={FULFILL_STEPS} currentStep={wizardStep} className="mb-6" />

      <div className="glass-card p-6 md:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={wizardStep}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
          >
            {stepComponents[wizardStep - 1]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminArFulfillPage;
