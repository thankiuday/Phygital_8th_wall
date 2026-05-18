import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Check, Video as VideoIcon } from 'lucide-react';
import MultiLinksEditor from '../../pages/campaigns/multiple-links/MultiLinksEditor';
import {
  campaignLinkItemsToRows,
  validateLinkRows,
  rowsToApiLinkItems,
} from '../../pages/campaigns/multiple-links/multiLinkFormUtils';
import FileDropZone from './FileDropZone';
import UploadProgress from './UploadProgress';
import { campaignService } from '../../services/campaignService';

const ACCEPTED_VIDEO_TYPES = 'video/*,.mp4,.webm,.mov,.m4v';
const MAX_VIDEO_SIZE_MB = 100;
const MAX_VIDEO_DURATION_SEC = 60;

const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/m4v']);
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

const validateVideoFile = (file) =>
  new Promise((resolve) => {
    const typeOk = file.type && VIDEO_TYPES.has(file.type);
    const extOk = VIDEO_EXT.test(file.name || '');
    if (!typeOk && !extOk) {
      return resolve('Only MP4, WebM, and MOV videos are accepted.');
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      if (video.duration > MAX_VIDEO_DURATION_SEC) {
        resolve(`Video is too long (${Math.round(video.duration)}s). Maximum is ${MAX_VIDEO_DURATION_SEC} seconds.`);
      } else if (video.duration < 1) {
        resolve('Video appears to be empty. Please upload a valid video.');
      } else {
        resolve(null);
      }
    };
    video.onerror = () => { URL.revokeObjectURL(video.src); resolve(null); };
    video.src = URL.createObjectURL(file);
  });

/**
 * EditCampaignModal — inline modal to rename a campaign, toggle status, and
 * for hub / ar-card types: edit links; for ar-card: replace intro video.
 */
const EditCampaignModal = ({ campaign, onSave, onClose }) => {
  const [name, setName]       = useState(campaign.campaignName);
  const [status, setStatus]   = useState(campaign.status);
  const [destinationUrl, setDestinationUrl] = useState(campaign.destinationUrl || '');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const inputRef              = useRef(null);

  const isSingleLink = campaign.campaignType === 'single-link-qr';
  const isArCard = campaign.campaignType === 'ar-card';
  const hasLinkItems =
    campaign.campaignType === 'multiple-links-qr'
    || campaign.campaignType === 'links-video-qr'
    || campaign.campaignType === 'links-doc-video-qr';
  const hasHubLinks = hasLinkItems || isArCard;
  const showPreciseGeo = hasLinkItems && !isArCard;

  const [linkRows, setLinkRows] = useState(() =>
    hasHubLinks ? campaignLinkItemsToRows(campaign.linkItems) : []
  );
  const [linkError, setLinkError] = useState('');
  const [preciseGeo, setPreciseGeo] = useState(!!campaign.preciseGeoAnalytics);

  const [pendingVideo, setPendingVideo] = useState(null);
  const [videoPreview, setVideoPreview] = useState('');
  const [videoUploading, setVideoUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoError, setVideoError] = useState('');

  useEffect(() => {
    setName(campaign.campaignName);
    setStatus(campaign.status);
    setDestinationUrl(campaign.destinationUrl || '');
    setError('');
    setLinkError('');
    setVideoError('');
    setPendingVideo(null);
    setVideoUploading(false);
    setUploadProgress(0);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoPreview('');

    if (
      campaign.campaignType === 'multiple-links-qr'
      || campaign.campaignType === 'links-video-qr'
      || campaign.campaignType === 'links-doc-video-qr'
      || campaign.campaignType === 'ar-card'
    ) {
      setLinkRows(campaignLinkItemsToRows(campaign.linkItems));
      setPreciseGeo(!!campaign.preciseGeoAnalytics);
    } else {
      setLinkRows([]);
    }
  }, [
    campaign._id,
    campaign.campaignName,
    campaign.status,
    campaign.destinationUrl,
    campaign.campaignType,
    campaign.linkItems,
    campaign.preciseGeoAnalytics,
    campaign.videoPublicId,
  ]);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
  }, [videoPreview]);

  const handleVideoFile = async (file) => {
    setVideoError('');
    const err = await validateVideoFile(file);
    if (err) {
      setVideoError(err);
      return;
    }

    if (videoPreview) URL.revokeObjectURL(videoPreview);
    const localPreview = URL.createObjectURL(file);
    setVideoPreview(localPreview);
    setPendingVideo(null);
    setVideoUploading(true);
    setUploadProgress(0);

    try {
      const uploaded = await campaignService.uploadToCloudinary(
        file,
        'video',
        (p) => setUploadProgress(p),
      );
      setPendingVideo({
        url: uploaded.url,
        publicId: uploaded.publicId,
        thumbnailUrl: uploaded.thumbnailUrl || null,
      });
      setUploadProgress(100);
    } catch {
      setVideoError('Video upload failed. Please try again.');
      URL.revokeObjectURL(localPreview);
      setVideoPreview('');
    } finally {
      setVideoUploading(false);
    }
  };

  const handleClearVideo = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoPreview('');
    setPendingVideo(null);
    setVideoError('');
    setUploadProgress(0);
  };

  const currentVideoPreviewUrl =
    videoPreview
    || pendingVideo?.thumbnailUrl
    || campaign.thumbnailUrl
    || campaign.videoUrl
    || null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Campaign name cannot be empty.'); return; }
    if (trimmed.length > 100) { setError('Name must be 100 characters or fewer.'); return; }

    if (videoUploading) {
      setVideoError('Please wait for the video upload to finish.');
      return;
    }

    if (isSingleLink) {
      const cleanedUrl = String(destinationUrl || '').trim();
      if (!cleanedUrl) {
        setError('Destination URL cannot be empty.');
        return;
      }
      try {
        const parsed = new URL(cleanedUrl);
        if (!/^https?:$/.test(parsed.protocol)) {
          setError('Destination URL must start with http:// or https://');
          return;
        }
      } catch {
        setError('Please enter a valid destination URL.');
        return;
      }
    }

    if (hasLinkItems) {
      const lerr = validateLinkRows(linkRows);
      if (lerr) {
        setLinkError(lerr);
        return;
      }
    } else if (isArCard) {
      const lerr = linkRows?.length ? validateLinkRows(linkRows) : null;
      if (lerr) {
        setLinkError(lerr);
        return;
      }
    }

    setSaving(true);
    setError('');
    setLinkError('');
    setVideoError('');

    const updates = {};
    if (trimmed !== campaign.campaignName) updates.campaignName = trimmed;
    if (status !== campaign.status)       updates.status = status;
    if (isSingleLink) {
      const cleanedUrl = String(destinationUrl || '').trim();
      if (cleanedUrl && cleanedUrl !== (campaign.destinationUrl || '')) {
        updates.destinationUrl = cleanedUrl;
      }
    }

    if (hasLinkItems) {
      updates.linkItems = rowsToApiLinkItems(linkRows);
      if (preciseGeo !== !!campaign.preciseGeoAnalytics) {
        updates.preciseGeoAnalytics = preciseGeo;
      }
    }

    if (isArCard) {
      updates.linkItems = rowsToApiLinkItems(linkRows);
      if (
        pendingVideo
        && pendingVideo.publicId
        && pendingVideo.publicId !== campaign.videoPublicId
      ) {
        updates.videoUrl = pendingVideo.url;
        updates.videoPublicId = pendingVideo.publicId;
        updates.thumbnailUrl = pendingVideo.thumbnailUrl;
      }
    }

    if (Object.keys(updates).length === 0) {
      setSaving(false);
      onClose();
      return;
    }

    const result = await onSave(campaign._id, updates);
    setSaving(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.message || 'Save failed. Please try again.');
    }
  };

  const STATUS_OPTIONS = [
    { value: 'active', label: 'Active', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
    { value: 'paused', label: 'Paused', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  ];

  const panelMaxW = hasHubLinks ? 'max-w-lg' : 'max-w-md';
  const modalTitle = isArCard
    ? 'Edit campaign, video & links'
    : hasLinkItems
      ? 'Edit campaign & links'
      : 'Edit Campaign';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-campaign-title"
          className={`flex max-h-[min(100dvh-2rem,46rem)] w-full ${panelMaxW} flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--surface-solid)] shadow-2xl`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
            <h2 id="edit-campaign-title" className="text-base font-semibold text-[var(--text-primary)]">
              {modalTitle}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
            >
              <X size={18} />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 space-y-5 overflow-y-auto px-6 pt-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[var(--text-secondary)]">
                  Campaign Name
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(''); }}
                  maxLength={100}
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                  placeholder="My AR Card"
                />
                <p className="text-right text-xs text-[var(--text-muted)]">{name.length}/100</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[var(--text-secondary)]">Status</label>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatus(opt.value)}
                      className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border py-2 text-sm font-semibold transition-all ${
                        status === opt.value
                          ? `${opt.bg} ${opt.color}`
                          : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--border-color-hover)]'
                      }`}
                    >
                      {status === opt.value && <Check size={14} />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {isSingleLink && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">
                    Destination URL
                  </label>
                  <input
                    type="url"
                    value={destinationUrl}
                    onChange={(e) => {
                      setDestinationUrl(e.target.value);
                      setError('');
                    }}
                    placeholder="https://example.com"
                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                  />
                  <p className="text-xs text-[var(--text-muted)]">
                    Updating this URL keeps the same QR code active — only the redirect destination changes.
                  </p>
                </div>
              )}

              {isArCard && (
                <div className="space-y-3 border-t border-[var(--border-color)] pt-5">
                  <div>
                    <p className="text-xs font-medium text-[var(--text-secondary)]">Intro video</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      Replaces the hologram on your card and the hero video on your profile hub.
                    </p>
                  </div>

                  {!videoUploading ? (
                    <FileDropZone
                      accept={ACCEPTED_VIDEO_TYPES}
                      acceptLabel="MP4, WebM, MOV"
                      maxSizeMB={MAX_VIDEO_SIZE_MB}
                      onFile={handleVideoFile}
                      previewUrl={currentVideoPreviewUrl}
                      previewType="video"
                      onClear={pendingVideo || videoPreview ? handleClearVideo : undefined}
                      error={videoError}
                      icon={VideoIcon}
                      hint="9:16 vertical · max 60 seconds · max 100 MB"
                    />
                  ) : (
                    <UploadProgress
                      progress={uploadProgress}
                      label="Uploading video…"
                    />
                  )}

                  {pendingVideo && !videoUploading && (
                    <p className="text-xs font-medium text-green-400">
                      New video ready — save to apply on hub and AR experience.
                    </p>
                  )}
                </div>
              )}

              {hasHubLinks && (
                <>
                  <div className="border-t border-[var(--border-color)] pt-5">
                    <p className="mb-3 text-xs font-medium text-[var(--text-secondary)]">
                      {isArCard
                        ? 'Social links on your profile hub (optional).'
                        : 'Hub links — edit, remove, or add destinations. Saved links keep their analytics IDs when possible.'}
                    </p>
                    <MultiLinksEditor
                      rows={linkRows}
                      onRowsChange={(next) => {
                        setLinkError('');
                        setLinkRows(next);
                      }}
                      error={linkError}
                    />
                  </div>
                  {showPreciseGeo && (
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-4">
                      <input
                        type="checkbox"
                        checked={preciseGeo}
                        onChange={(e) => setPreciseGeo(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-[var(--border-color)]"
                      />
                      <div>
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          Precise location (optional)
                        </span>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                          QR targets the location bridge so visitors can opt in to GPS for analytics.
                        </p>
                      </div>
                    </label>
                  )}
                </>
              )}

              {error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
              )}
            </div>

            <div className="flex shrink-0 gap-2.5 border-t border-[var(--border-color)] px-6 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-[var(--border-color)] py-2.5 text-sm font-semibold text-[var(--text-muted)] transition-colors hover:border-[var(--border-color-hover)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || videoUploading}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-500 disabled:opacity-60"
              >
                {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save Changes'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EditCampaignModal;
