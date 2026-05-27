import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Loader2, Play, Download, Video, Image as ImageIcon } from 'lucide-react';
import { adminService } from '../../services/adminService';
import {
  resolveRequestImageUrl,
  resolveRequestVideoUrl,
  downloadGreenscreenVideo,
} from '../../utils/arServiceRequestMedia';
import { getArMediaProduct } from '../../constants/arMediaProducts';

const ADMIN_QUERY = { staleTime: 30_000, refetchOnWindowFocus: false };

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
];

const KIND_TABS = [
  { value: '', label: 'All types' },
  { value: 'ar-card', label: 'AR Cards' },
  { value: 'ar-poster', label: 'AR Posters' },
];

const kindBadgeClass = (kind) =>
  kind === 'ar-poster'
    ? 'bg-violet-500/15 text-violet-300'
    : 'bg-brand-500/15 text-brand-300';

const statusClass = (status) => {
  const map = {
    submitted: 'bg-amber-500/15 text-amber-400',
    in_progress: 'bg-brand-500/15 text-brand-400',
    completed: 'bg-green-500/15 text-green-400',
    cancelled: 'bg-red-500/15 text-red-400',
  };
  return map[status] || map.submitted;
};

const AdminArServiceRequestsPage = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [kindFilter, setKindFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [imagePreviewFailed, setImagePreviewFailed] = useState(false);
  const [downloadingVideo, setDownloadingVideo] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const listQ = useQuery({
    queryKey: ['admin', 'ar-requests', statusFilter, kindFilter, search],
    queryFn: () => adminService.getArServiceRequests({
      status: statusFilter || undefined,
      requestKind: kindFilter || undefined,
      search,
      limit: 50,
    }),
    ...ADMIN_QUERY,
  });

  const detailQ = useQuery({
    queryKey: ['admin', 'ar-request', selected],
    queryFn: () => adminService.getArServiceRequest(selected),
    enabled: !!selected,
    ...ADMIN_QUERY,
  });

  const startMut = useMutation({
    mutationFn: (id) => adminService.updateArServiceRequest(id, { status: 'in_progress' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'ar-requests'] }),
  });

  const requests = listQ.data?.requests || [];
  const detail = detailQ.data?.request;

  const handleDownloadVideo = async () => {
    if (!detail) return;
    setDownloadError('');
    setDownloadingVideo(true);
    try {
      await downloadGreenscreenVideo(detail);
    } catch (err) {
      setDownloadError(err.message || 'Download failed');
    } finally {
      setDownloadingVideo(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">AR requests</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Fulfill AR card and AR poster submissions (processed video + publish).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user…"
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] py-2.5 pl-8 pr-4 text-sm"
          />
        </div>
        <div className="flex gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-1">
          {KIND_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setKindFilter(tab.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                kindFilter === tab.value ? 'bg-violet-600 text-white' : 'text-[var(--text-muted)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                statusFilter === tab.value ? 'bg-brand-600 text-white' : 'text-[var(--text-muted)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card overflow-hidden">
          {listQ.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-brand-400" />
            </div>
          ) : requests.length === 0 ? (
            <p className="p-8 text-center text-sm text-[var(--text-muted)]">No requests</p>
          ) : (
            <ul className="divide-y divide-[var(--border-color)]">
              {requests.map((req) => (
                <li key={req._id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(req._id);
                      setImagePreviewFailed(false);
                      setDownloadError('');
                    }}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-2)] ${
                      selected === req._id ? 'bg-brand-500/10' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{req.userId?.email || 'User'}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${kindBadgeClass(req.requestKind || 'ar-card')}`}>
                          {getArMediaProduct(req.requestKind || 'ar-card').shortLabel}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusClass(req.status)}`}>
                          {req.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">
                      {new Date(req.submittedAt || req.createdAt).toLocaleString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-card p-5">
          {!selected ? (
            <p className="text-sm text-[var(--text-muted)]">Select a request to view assets.</p>
          ) : detailQ.isLoading ? (
            <Loader2 className="mx-auto animate-spin text-brand-400" />
          ) : detail ? (
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{detail.userId?.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${kindBadgeClass(detail.requestKind || 'ar-card')}`}>
                    {getArMediaProduct(detail.requestKind || 'ar-card').shortLabel}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-muted)]">{detail.userId?.email}</p>
              </div>
              {detail.targetImageUrl && (
                <div>
                  <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)]">
                    <ImageIcon size={12} /> {getArMediaProduct(detail.requestKind || 'ar-card').assetNoun} image (user upload)
                  </p>
                  {!imagePreviewFailed ? (
                    <img
                      src={resolveRequestImageUrl(detail)}
                      alt="User business card"
                      className="max-h-48 w-full rounded-lg border border-[var(--border-color)] object-contain bg-[var(--surface-2)]"
                      onError={() => setImagePreviewFailed(true)}
                    />
                  ) : (
                    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] p-4 text-center text-xs text-[var(--text-muted)]">
                      Preview unavailable.{' '}
                      <a
                        href={resolveRequestImageUrl(detail)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-400 hover:underline"
                      >
                        Open image
                      </a>
                    </div>
                  )}
                </div>
              )}
              {detail.greenscreenVideoUrl && (
                <div>
                  <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)]">
                    <Video size={12} /> Green-screen source (MP4)
                  </p>
                  <video
                    src={resolveRequestVideoUrl(detail)}
                    controls
                    className="w-full max-h-40 rounded-lg border border-[var(--border-color)] bg-black"
                  />
                  <button
                    type="button"
                    onClick={handleDownloadVideo}
                    disabled={downloadingVideo}
                    className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {downloadingVideo ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    Download green-screen MP4
                  </button>
                  {downloadError && (
                    <p className="mt-1 text-xs text-red-400">{downloadError}</p>
                  )}
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    Convert to WebM + side-by-side .mov, then upload in the fulfill wizard.
                  </p>
                </div>
              )}
              {detail.linkItems?.length > 0 && (
                <ul className="text-sm">
                  {detail.linkItems.map((l) => (
                    <li key={l.linkId} className="text-[var(--text-secondary)]">
                      {l.label}: {l.value}
                    </li>
                  ))}
                </ul>
              )}
              {detail.userNotes && (
                <p className="text-sm text-[var(--text-muted)]">Note: {detail.userNotes}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                {detail.status === 'submitted' && (
                  <button
                    type="button"
                    onClick={() => startMut.mutate(detail._id)}
                    className="rounded-lg border border-brand-500/40 px-3 py-2 text-xs text-brand-400"
                  >
                    Mark in progress
                  </button>
                )}
                {(detail.status === 'submitted' || detail.status === 'in_progress') && (
                  <Link
                    to={`/admin/ar-requests/${detail._id}/fulfill`}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white"
                  >
                    <Play size={12} /> Fulfill (full wizard)
                  </Link>
                )}
                {detail.status === 'completed' && detail.campaignId && (
                  <Link
                    to={`/dashboard/campaigns/${detail.campaignId._id || detail.campaignId}`}
                    className="text-xs text-brand-400 hover:underline"
                  >
                    View campaign
                  </Link>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AdminArServiceRequestsPage;
