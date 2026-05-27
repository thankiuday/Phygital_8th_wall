import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, Loader2, Sparkles, ExternalLink } from 'lucide-react';
import { arServiceRequestService, SLA_SUBTEXT } from '../../services/arServiceRequestService';
import { getArMediaProduct } from '../../constants/arMediaProducts';

const STATUS_LABELS = {
  submitted: { label: 'Submitted', className: 'bg-amber-500/15 text-amber-400' },
  in_progress: { label: 'In progress', className: 'bg-brand-500/15 text-brand-400' },
  completed: { label: 'Ready', className: 'bg-green-500/15 text-green-400' },
  cancelled: { label: 'Cancelled', className: 'bg-red-500/15 text-red-400' },
};

const kindBadgeClass = (kind) =>
  kind === 'ar-poster'
    ? 'bg-violet-500/15 text-violet-300'
    : 'bg-brand-500/15 text-brand-300';

const ArServiceRequestsPanel = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ar-service-requests', 'mine'],
    queryFn: () => arServiceRequestService.listMyRequests({ limit: 50 }),
    staleTime: 30_000,
  });

  const requests = data?.requests || [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-brand-400" size={28} />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
        Could not load AR requests.
      </p>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <Sparkles size={28} className="text-brand-400" />
        <p className="text-sm text-[var(--text-muted)]">No AR requests yet.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            to="/dashboard/campaigns/new/digital-business-card/ar"
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Request AR card
          </Link>
          <Link
            to="/dashboard/campaigns/new/ar-poster"
            className="rounded-xl border border-[var(--border-color)] px-5 py-2.5 text-sm font-semibold text-[var(--text-primary)]"
          >
            Request AR poster
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {requests.map((req) => {
        const st = STATUS_LABELS[req.status] || STATUS_LABELS.submitted;
        const kind = req.requestKind || 'ar-card';
        const product = getArMediaProduct(kind);
        const campaignId = req.campaignId?._id || req.campaignId;
        return (
          <li key={req._id} className="glass-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {product.shortLabel} request
                </p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${kindBadgeClass(kind)}`}>
                  {product.shortLabel}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Submitted {new Date(req.submittedAt || req.createdAt).toLocaleString()}
              </p>
              {(req.status === 'submitted' || req.status === 'in_progress') && (
                <p className="mt-1 flex items-center gap-1 text-xs text-amber-400/90">
                  <Clock size={12} /> {SLA_SUBTEXT}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.className}`}>
                {st.label}
              </span>
              {req.status === 'completed' && campaignId && (
                <Link
                  to={`/dashboard/campaigns/${campaignId}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:underline"
                >
                  View campaign <ExternalLink size={12} />
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default ArServiceRequestsPanel;
