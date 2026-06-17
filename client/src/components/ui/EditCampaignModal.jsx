import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Check, Video as VideoIcon, Link2, UploadCloud } from 'lucide-react';
import MultiLinksEditor from '../../pages/campaigns/multiple-links/MultiLinksEditor';
import {
  campaignLinkItemsToRows,
  validateLinkRows,
  rowsToApiLinkItems,
} from '../../pages/campaigns/multiple-links/multiLinkFormUtils';
import {
  campaignVideoItemsToEditSlots,
  slotsToPatchVideoItems,
  createVideoSlot,
  isVideoSlotReady,
} from '../../pages/campaigns/links-doc-video/linksDocVideoFormUtils';
import { isAllowedVideoHost, toEmbedSrc } from '../../utils/videoEmbed';
import FileDropZone from './FileDropZone';
import FormInput from './FormInput';
import UploadProgress from './UploadProgress';
import VideoItemsEditor from './VideoItemsEditor';
import ArEffectPicker from '../campaigns/ArEffectPicker';
import ArImageTargetToggle from '../campaigns/ArImageTargetToggle';
import { campaignService } from '../../services/campaignService';
import { isArMediaType } from '../../constants/arMediaProducts';
import { AR_VIDEO_MAX_DURATION_SEC } from '../../constants/arVideoLimits';

const ACCEPTED_VIDEO_TYPES = 'video/*,.mp4,.webm,.mov,.m4v';
const ACCEPTED_WEBM_TYPES = 'video/webm,.webm';
const ACCEPTED_MOV_TYPES = 'video/quicktime,.mov';
const MAX_VIDEO_SIZE_MB = 100;
const MAX_VIDEO_DURATION_SEC = 60;

const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/m4v']);
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const WEBM_EXT = /\.webm(\?|$)/i;
const MOV_EXT = /\.mov(\?|$)/i;

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

/** AR-card iOS replacement: enforce .mov extension and a landscape (side-by-side) aspect. */
const validateMovSideBySideFile = (file) =>
  new Promise((resolve) => {
    const typeOk = file.type === 'video/quicktime' || file.type === 'video/mp4';
    const extOk = MOV_EXT.test(file.name || '');
    if (!typeOk && !extOk) {
      return resolve('The iOS upload must be the side-by-side .mov file.');
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      if (video.duration > AR_VIDEO_MAX_DURATION_SEC) {
        resolve(`Video is too long (${Math.round(video.duration)}s). Max ${AR_VIDEO_MAX_DURATION_SEC}s.`);
      } else if (video.duration < 1) {
        resolve('Video appears to be empty.');
      } else if (
        Number.isFinite(video.videoWidth)
        && Number.isFinite(video.videoHeight)
        && video.videoWidth > 0
        && video.videoHeight > 0
        && video.videoWidth < video.videoHeight
      ) {
        resolve('Use the side-by-side .mov export (RGB on the left, alpha mask on the right).');
      } else {
        resolve(null);
      }
    };
    video.onerror = () => { URL.revokeObjectURL(video.src); resolve(null); };
    video.src = URL.createObjectURL(file);
  });

/** AR-card Android replacement: enforce .webm extension only. */
const validateWebmFile = (file) =>
  new Promise((resolve) => {
    const typeOk = file.type === 'video/webm';
    const extOk = WEBM_EXT.test(file.name || '');
    if (!typeOk && !extOk) {
      return resolve('The Android upload must be a transparent .webm file.');
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      if (video.duration > AR_VIDEO_MAX_DURATION_SEC) {
        resolve(`Video is too long (${Math.round(video.duration)}s). Max ${AR_VIDEO_MAX_DURATION_SEC}s.`);
      } else if (video.duration < 1) {
        resolve('Video appears to be empty.');
      } else {
        resolve(null);
      }
    };
    video.onerror = () => { URL.revokeObjectURL(video.src); resolve(null); };
    video.src = URL.createObjectURL(file);
  });

const HeroSourceTab = ({ active, onClick, Icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
      active
        ? 'border-brand-500/60 bg-brand-500/15 text-brand-300'
        : 'border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-brand-500/40'
    }`}
  >
    <Icon size={15} />
    {label}
  </button>
);

/** Validate multi-video editor for links-doc-video-qr (documents are not edited here). */
const validateDocVideoModal = (slots, videoSource, campaign) => {
  for (const slot of slots) {
    const hasAnything =
      slot.uploadUrl
      || slot.externalUrl?.trim()
      || (slot.label || '').trim();
    if (!hasAnything) continue;
    if (!isVideoSlotReady(slot, videoSource)) {
      if (videoSource === 'upload') {
        return 'Finish uploading every video, or remove unfinished rows.';
      }
      const url = (slot.externalUrl || '').trim();
      if (!url) return 'Add a video URL or remove the empty slot.';
      if (!isAllowedVideoHost(url) || !toEmbedSrc(url)) {
        return 'Only YouTube, Vimeo, or Facebook video URLs are supported.';
      }
      return 'Each video needs a label.';
    }
  }
  const readyCount = slots.filter((s) => isVideoSlotReady(s, videoSource)).length;
  const hasDocs = Array.isArray(campaign.docItems) && campaign.docItems.length > 0;
  if (readyCount === 0 && !hasDocs) {
    return 'Add at least one video, or keep documents on this campaign from the creation flow.';
  }
  return '';
};

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
  const isArMedia = isArMediaType(campaign.campaignType);
  const isLinksVideo = campaign.campaignType === 'links-video-qr';
  const isLinksDocVideo = campaign.campaignType === 'links-doc-video-qr';
  const hasLinkItems =
    campaign.campaignType === 'multiple-links-qr'
    || campaign.campaignType === 'links-video-qr'
    || campaign.campaignType === 'links-doc-video-qr';
  const hasHubLinks = hasLinkItems || isArMedia;
  const showPreciseGeo = hasLinkItems && !isArMedia;

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

  // AR-card iOS .mov replacement — independent state so swapping the
  // iOS asset doesn't disturb the Android .webm upload or vice versa.
  const [pendingVideoIos, setPendingVideoIos] = useState(null);
  const [videoIosPreview, setVideoIosPreview] = useState('');
  const [videoIosUploading, setVideoIosUploading] = useState(false);
  const [videoIosProgress, setVideoIosProgress] = useState(0);
  const [videoIosError, setVideoIosError] = useState('');
  const [arIosChangeMode, setArIosChangeMode] = useState(false);
  const [arEffect, setArEffect] = useState(campaign.arEffect || 'none');
  const [requiresImageTarget, setRequiresImageTarget] = useState(
    campaign.requiresImageTarget !== false,
  );

  /** When true, hero FileDropZone hides saved campaign video so the drop zone is empty after ✕. */
  const [suppressExistingHeroPreview, setSuppressExistingHeroPreview] = useState(false);

  const [arVideoChangeMode, setArVideoChangeMode] = useState(false);
  const [heroLinksVideoSource, setHeroLinksVideoSource] = useState(
    () => campaign.videoSource || 'upload',
  );
  const [heroLinksExternalUrl, setHeroLinksExternalUrl] = useState(
    () => campaign.externalVideoUrl || '',
  );

  const [docVideoSource, setDocVideoSource] = useState(() => campaign.videoSource || 'upload');
  const [docVideoSlots, setDocVideoSlots] = useState(() => {
    if (campaign.campaignType !== 'links-doc-video-qr') return [];
    const slots = campaignVideoItemsToEditSlots(campaign.videoItems);
    return slots.length ? slots : [createVideoSlot()];
  });
  const [docVideoError, setDocVideoError] = useState('');
  const [docVideoUploading, setDocVideoUploading] = useState(false);

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
    setArVideoChangeMode(false);
    setSuppressExistingHeroPreview(false);
    setDocVideoError('');

    // Reset iOS-video replacement state too
    if (videoIosPreview) URL.revokeObjectURL(videoIosPreview);
    setVideoIosPreview('');
    setPendingVideoIos(null);
    setVideoIosUploading(false);
    setVideoIosProgress(0);
    setVideoIosError('');
    setArIosChangeMode(false);
    setRequiresImageTarget(campaign.requiresImageTarget !== false);

    if (campaign.campaignType === 'multiple-links-qr'
      || campaign.campaignType === 'links-video-qr'
      || campaign.campaignType === 'links-doc-video-qr'
      || isArMediaType(campaign.campaignType)
    ) {
      setLinkRows(campaignLinkItemsToRows(campaign.linkItems));
      setPreciseGeo(!!campaign.preciseGeoAnalytics);
    } else {
      setLinkRows([]);
    }

    if (campaign.campaignType === 'links-video-qr') {
      setHeroLinksVideoSource(campaign.videoSource || 'upload');
      setHeroLinksExternalUrl(campaign.externalVideoUrl || '');
    }

    if (campaign.campaignType === 'links-doc-video-qr') {
      setDocVideoSource(campaign.videoSource || 'upload');
      const slots = campaignVideoItemsToEditSlots(campaign.videoItems);
      setDocVideoSlots(slots.length ? slots : [createVideoSlot()]);
    } else {
      setDocVideoSlots([]);
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
    campaign.videoIosPublicId,
    campaign.videoSource,
    campaign.externalVideoUrl,
    campaign.videoItems,
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

  useEffect(() => () => {
    if (videoIosPreview) URL.revokeObjectURL(videoIosPreview);
  }, [videoIosPreview]);

  const handleVideoFile = async (file) => {
    setVideoError('');
    // The AR-card hero slot is the Android (.webm) source; only the iOS slot
    // accepts side-by-side .mov files. We keep the looser MP4/WebM/MOV check
    // for non-AR types (links-video-qr) where the previous behaviour holds.
    const validator = isArMedia ? validateWebmFile : validateVideoFile;
    const err = await validator(file);
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

  const handleVideoIosFile = async (file) => {
    setVideoIosError('');
    const err = await validateMovSideBySideFile(file);
    if (err) {
      setVideoIosError(err);
      return;
    }

    if (videoIosPreview) URL.revokeObjectURL(videoIosPreview);
    const localPreview = URL.createObjectURL(file);
    setVideoIosPreview(localPreview);
    setPendingVideoIos(null);
    setVideoIosUploading(true);
    setVideoIosProgress(0);

    try {
      const uploaded = await campaignService.uploadToCloudinary(
        file,
        'video',
        (p) => setVideoIosProgress(p),
      );
      setPendingVideoIos({
        url: uploaded.url,
        publicId: uploaded.publicId,
      });
      setVideoIosProgress(100);
    } catch {
      setVideoIosError('iOS video upload failed. Please try again.');
      URL.revokeObjectURL(localPreview);
      setVideoIosPreview('');
    } finally {
      setVideoIosUploading(false);
    }
  };

  const discardIosReplaceDraft = () => {
    if (videoIosPreview) URL.revokeObjectURL(videoIosPreview);
    setVideoIosPreview('');
    setPendingVideoIos(null);
    setVideoIosError('');
    setVideoIosProgress(0);
  };

  const currentIosPreviewUrl =
    videoIosPreview || pendingVideoIos?.url || campaign.videoUrlIos || null;

  const clearLocalHeroVideoSelection = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoPreview('');
    setPendingVideo(null);
    setVideoError('');
    setUploadProgress(0);
  };

  /** Clear preview in hero replace UI (drops local draft and hides saved video until user picks another file). */
  const handleHeroReplaceClear = () => {
    clearLocalHeroVideoSelection();
    setSuppressExistingHeroPreview(true);
  };

  /** Close AR replace mode without persisting drafts; show saved hero again next time. */
  const discardArReplaceDraft = () => {
    clearLocalHeroVideoSelection();
    setSuppressExistingHeroPreview(false);
  };

  const currentVideoPreviewUrl =
    videoPreview
    || pendingVideo?.thumbnailUrl
    || campaign.thumbnailUrl
    || campaign.videoUrl
    || null;

  /** Preview inside FileDropZone for AR “change video” / links-video upload (respects suppress after ✕). */
  const heroFileDropPreviewUrl =
    videoPreview
    || pendingVideo?.url
    || pendingVideo?.thumbnailUrl
    || (
      !suppressExistingHeroPreview
      && (campaign.videoUrl || campaign.thumbnailUrl)
    )
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

    if (videoIosUploading) {
      setVideoIosError('Please wait for the iOS video upload to finish.');
      return;
    }

    if (isLinksVideo) {
      if (heroLinksVideoSource === 'link') {
        const t = heroLinksExternalUrl.trim();
        if (!t || !isAllowedVideoHost(t) || !toEmbedSrc(t)) {
          setVideoError('Enter a supported YouTube, Vimeo, or Facebook video URL.');
          return;
        }
      } else if (campaign.videoSource === 'link' && !pendingVideo?.publicId) {
        setVideoError('Upload a video to replace the embedded link.');
        return;
      }
    }

    if (isLinksDocVideo) {
      const derr = validateDocVideoModal(docVideoSlots, docVideoSource, campaign);
      if (derr) {
        setDocVideoError(derr);
        return;
      }
      setDocVideoError('');
    }

    if (docVideoUploading) {
      setDocVideoError('Please wait for video uploads to finish.');
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
    } else if (isArMedia) {
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

    if (isArMedia) {
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
      if (
        pendingVideoIos
        && pendingVideoIos.publicId
        && pendingVideoIos.publicId !== campaign.videoIosPublicId
      ) {
        updates.videoUrlIos = pendingVideoIos.url;
        updates.videoIosPublicId = pendingVideoIos.publicId;
      }
      if (arEffect !== (campaign.arEffect || 'none')) {
        updates.arEffect = arEffect;
      }
      if (requiresImageTarget !== (campaign.requiresImageTarget !== false)) {
        updates.requiresImageTarget = requiresImageTarget;
      }
    }

    if (isLinksVideo) {
      if (heroLinksVideoSource === 'link') {
        updates.videoSource = 'link';
        updates.externalVideoUrl = heroLinksExternalUrl.trim();
      } else {
        updates.videoSource = 'upload';
        if (pendingVideo?.publicId && pendingVideo.publicId !== campaign.videoPublicId) {
          updates.videoUrl = pendingVideo.url;
          updates.videoPublicId = pendingVideo.publicId;
          updates.thumbnailUrl = pendingVideo.thumbnailUrl ?? null;
        }
      }
    }

    if (isLinksDocVideo) {
      updates.videoSource = docVideoSource;
      updates.videoItems = slotsToPatchVideoItems(docVideoSlots, docVideoSource);
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

  const panelMaxW = hasHubLinks ? 'max-w-xl' : 'max-w-md';
  const modalTitle = isArMedia
    ? 'Edit campaign, video & links'
    : isLinksDocVideo
      ? 'Edit campaign, videos & links'
      : isLinksVideo
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

              {isArMedia && (
                <div className="space-y-3 border-t border-[var(--border-color)] pt-5">
                  <div>
                    <p className="text-xs font-medium text-[var(--text-secondary)]">Hologram · Android (.webm)</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      Plays on Android Chrome and most desktop browsers. Use the transparent VP9 .webm export.
                    </p>
                  </div>

                  {!arVideoChangeMode ? (
                    <div className="space-y-3">
                      {currentVideoPreviewUrl ? (
                        <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-black/40">
                          <video
                            className="aspect-[9/16] max-h-[14rem] w-full object-contain"
                            controls
                            muted
                            playsInline
                            poster={campaign.thumbnailUrl || undefined}
                            src={currentVideoPreviewUrl}
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--text-muted)]">No video on file yet.</p>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const ok = window.confirm(
                            'Replacing the video removes the previous upload from storage (best effort). Continue?',
                          );
                          if (!ok) return;
                          setArVideoChangeMode(true);
                          setSuppressExistingHeroPreview(false);
                          setVideoError('');
                        }}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border-color)] px-4 text-sm font-semibold text-brand-400 transition-colors hover:border-brand-500/50"
                      >
                        Change video
                      </button>
                    </div>
                  ) : (
                    <>
                      {!videoUploading ? (
                        <FileDropZone
                          accept={ACCEPTED_WEBM_TYPES}
                          acceptLabel="WebM only (VP9 + alpha)"
                          maxSizeMB={null}
                          onFile={handleVideoFile}
                          previewUrl={heroFileDropPreviewUrl}
                          previewType="video"
                          onClear={handleHeroReplaceClear}
                          error={videoError}
                          icon={VideoIcon}
                          hint="Drop the transparent .webm export here · max 2 minutes"
                        />
                      ) : (
                        <UploadProgress
                          progress={uploadProgress}
                          label="Uploading the WebM file…"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setArVideoChangeMode(false);
                          discardArReplaceDraft();
                        }}
                        className="text-xs font-medium text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--text-secondary)]"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {arVideoChangeMode && pendingVideo && !videoUploading && (
                    <p className="text-xs font-medium text-green-400">
                      New WebM ready — save to apply on hub and AR experience.
                    </p>
                  )}

                  {/* iOS side-by-side .mov ─ paired upload for iPhone visitors. */}
                  <div className="mt-2 space-y-3 border-t border-dashed border-[var(--border-color)] pt-4">
                    <div>
                      <p className="text-xs font-medium text-[var(--text-secondary)]">
                        Hologram · iPhone / iPad (side-by-side .mov)
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        H.264 .mov with RGB on the left half and the alpha mask on the right half.
                        Without this, iPhone visitors see a black background over the AR camera feed.
                      </p>
                    </div>

                    {!arIosChangeMode ? (
                      <div className="space-y-3">
                        {currentIosPreviewUrl ? (
                          <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-black/40">
                            <video
                              className="aspect-[18/16] max-h-[14rem] w-full object-contain"
                              controls
                              muted
                              playsInline
                              src={currentIosPreviewUrl}
                            />
                          </div>
                        ) : (
                          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                            No iOS .mov on file yet. Add one so iPhone visitors get a transparent hologram.
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const ok = currentIosPreviewUrl
                              ? window.confirm(
                                'Replacing the iOS video removes the previous upload from storage (best effort). Continue?',
                              )
                              : true;
                            if (!ok) return;
                            setArIosChangeMode(true);
                            setVideoIosError('');
                          }}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border-color)] px-4 text-sm font-semibold text-brand-400 transition-colors hover:border-brand-500/50"
                        >
                          {currentIosPreviewUrl ? 'Change iOS video' : 'Add iOS video'}
                        </button>
                      </div>
                    ) : (
                      <>
                        {!videoIosUploading ? (
                          <FileDropZone
                            accept={ACCEPTED_MOV_TYPES}
                            acceptLabel="MOV only (side-by-side alpha)"
                            maxSizeMB={null}
                            onFile={handleVideoIosFile}
                            previewUrl={videoIosPreview || pendingVideoIos?.url || null}
                            previewType="video"
                            onClear={discardIosReplaceDraft}
                            error={videoIosError}
                            icon={VideoIcon}
                            hint="Drop the side-by-side .mov export here · max 2 minutes"
                          />
                        ) : (
                          <UploadProgress
                            progress={videoIosProgress}
                            label="Uploading the iOS .mov file…"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setArIosChangeMode(false);
                            discardIosReplaceDraft();
                          }}
                          className="text-xs font-medium text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--text-secondary)]"
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {arIosChangeMode && pendingVideoIos && !videoIosUploading && (
                      <p className="text-xs font-medium text-sky-400">
                        New iOS .mov ready — save to apply on the AR experience.
                      </p>
                    )}
                  </div>

                  {/* Image target vs surface mode */}
                  <div className="mt-2 border-t border-dashed border-[var(--border-color)] pt-4">
                    <ArImageTargetToggle
                      variant="settings"
                      value={requiresImageTarget}
                      onChange={setRequiresImageTarget}
                    />
                  </div>

                  {/* Hologram base effect — animated theme under the AR video */}
                  <div className="mt-2 space-y-3 border-t border-dashed border-[var(--border-color)] pt-4">
                    <div>
                      <p className="text-xs font-medium text-[var(--text-secondary)]">AR effect</p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        Animated hologram effect shown at the base of the video when the target is
                        detected. Applies instantly to the live AR experience after saving.
                      </p>
                    </div>
                    <ArEffectPicker value={arEffect} onChange={setArEffect} />
                  </div>
                </div>
              )}

              {isLinksVideo && (
                <div className="space-y-3 border-t border-[var(--border-color)] pt-5">
                  <div>
                    <p className="text-xs font-medium text-[var(--text-secondary)]">Hero video</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      Shown at the top of your link hub. Upload a short clip or paste an embeddable URL.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <HeroSourceTab
                      active={heroLinksVideoSource === 'upload'}
                      onClick={() => {
                        setHeroLinksVideoSource('upload');
                        setSuppressExistingHeroPreview(false);
                        setVideoError('');
                      }}
                      Icon={UploadCloud}
                      label="Upload video"
                    />
                    <HeroSourceTab
                      active={heroLinksVideoSource === 'link'}
                      onClick={() => {
                        setHeroLinksVideoSource('link');
                        setVideoError('');
                      }}
                      Icon={Link2}
                      label="Paste link"
                    />
                  </div>

                  {heroLinksVideoSource === 'upload' ? (
                    !videoUploading ? (
                      <FileDropZone
                        accept={ACCEPTED_VIDEO_TYPES}
                        acceptLabel="MP4, WebM, MOV"
                        maxSizeMB={MAX_VIDEO_SIZE_MB}
                        onFile={handleVideoFile}
                        previewUrl={heroFileDropPreviewUrl}
                        previewType="video"
                        onClear={handleHeroReplaceClear}
                        error={videoError}
                        icon={VideoIcon}
                        hint="Max 60 seconds · max 100 MB"
                      />
                    ) : (
                      <UploadProgress
                        progress={uploadProgress}
                        label="Uploading your video…"
                      />
                    )
                  ) : (
                    <FormInput
                      label="Video URL (YouTube, Vimeo, Facebook)"
                      value={heroLinksExternalUrl}
                      onChange={(e) => {
                        setHeroLinksExternalUrl(e.target.value);
                        setVideoError('');
                      }}
                      placeholder="https://youtube.com/watch?v=…"
                      error={
                        heroLinksExternalUrl.trim()
                        && (!isAllowedVideoHost(heroLinksExternalUrl.trim())
                          || !toEmbedSrc(heroLinksExternalUrl.trim()))
                          ? 'Use a supported YouTube, Vimeo, or Facebook URL'
                          : ''
                      }
                    />
                  )}

                  {pendingVideo && !videoUploading && heroLinksVideoSource === 'upload' && (
                    <p className="text-xs font-medium text-green-400">
                      New video ready — save to apply on your hub.
                    </p>
                  )}
                </div>
              )}

              {isLinksDocVideo && (
                <VideoItemsEditor
                  videoSource={docVideoSource}
                  onVideoSourceChange={(s) => {
                    setDocVideoSource(s);
                    setDocVideoError('');
                  }}
                  slots={docVideoSlots}
                  setSlots={setDocVideoSlots}
                  error={docVideoError}
                  onUploadingChange={setDocVideoUploading}
                />
              )}

              {hasHubLinks && (
                <>
                  <div className="border-t border-[var(--border-color)] pt-5">
                    <p className="mb-3 text-xs font-medium text-[var(--text-secondary)]">
                      {isArMedia
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
                disabled={saving || videoUploading || videoIosUploading || docVideoUploading}
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
