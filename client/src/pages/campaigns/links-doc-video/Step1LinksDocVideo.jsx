import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link2,
  Plus,
  QrCode,
  Trash2,
  UploadCloud,
  Video as VideoIcon,
  X,
} from 'lucide-react';
import FormInput from '../../../components/ui/FormInput';
import FileDropZone from '../../../components/ui/FileDropZone';
import UploadProgress from '../../../components/ui/UploadProgress';
import MultiLinksEditor from '../multiple-links/MultiLinksEditor';
import { campaignService } from '../../../services/campaignService';
import { detectVideoHost, toEmbedSrc, isAllowedVideoHost } from '../../../utils/videoEmbed';
import {
  ALLOWED_DOC_MIME_TYPES,
  DOC_ACCEPT_LABEL,
  DOC_ACCEPT_STRING,
  MAX_DOC_BYTES,
  MAX_DOC_MB,
  MAX_DOC_SLOTS,
  MAX_VIDEO_SLOTS,
  buildLinksDocVideoPayload,
  createDocSlot,
  createVideoSlot,
  isDocSlotReady,
  isVideoSlotReady,
  labelFromFileName,
  validateLinksDocVideoForm,
} from './linksDocVideoFormUtils';

const ACCEPTED_VIDEO_TYPES = 'video/*,.mp4,.webm,.mov,.m4v';
const MAX_VIDEO_MB = 100;
const YT_ID_RE = /^[A-Za-z0-9_-]{6,32}$/;

const getYoutubeId = (input) => {
  if (!input) return null;
  try {
    const u = new URL(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input) ? input : `https://${input}`);
    const host = u.hostname.toLowerCase();
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\/+/, '').split('/')[0];
      return YT_ID_RE.test(id) ? id : null;
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v');
        return id && YT_ID_RE.test(id) ? id : null;
      }
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
      if (m && YT_ID_RE.test(m[1])) return m[1];
    }
  } catch {
    return null;
  }
  return null;
};

const validateVideoFile = (file) =>
  new Promise((resolve) => {
    if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) {
      return resolve('Only MP4, WebM, and MOV videos are accepted.');
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      if (video.duration > 60) {
        resolve(`Video is too long (${Math.round(video.duration)}s). Maximum is 60 seconds.`);
      } else if (video.duration < 1) {
        resolve('Video appears empty. Please upload a valid video.');
      } else {
        resolve(null);
      }
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(null);
    };
    video.src = URL.createObjectURL(file);
  });

const SourceTab = ({ active, onClick, Icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
      active
        ? 'border-brand-500/60 bg-brand-500/15 text-brand-300'
        : 'border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-brand-500/40'
    }`}
  >
    <Icon size={15} />
    {label}
  </button>
);

const formatBytes = (bytes) => {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/* ─────────────────────────────────────────────────────────────────────────
   VideoSlotRow
   - upload mode: drop zone, then "uploaded" preview with thumbnail/label input
   - link mode:   URL input + thumbnail-only preview card (oEmbed best-effort)
   ───────────────────────────────────────────────────────────────────────── */
const VideoSlotRow = ({ index, slot, source, isAuthenticated, onChange, onRemove, canRemove }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [localPreview, setLocalPreview] = useState('');
  const [error, setError] = useState('');
  const [linkPreview, setLinkPreview] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const lastFetchedRef = useRef('');

  const embedHost = useMemo(
    () => (source === 'link' ? detectVideoHost(slot.externalUrl) : null),
    [source, slot.externalUrl]
  );
  const embedSrc = useMemo(
    () => (source === 'link' ? toEmbedSrc(slot.externalUrl) : null),
    [source, slot.externalUrl]
  );

  useEffect(
    () => () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    },
    [localPreview]
  );

  // Fetch oEmbed metadata for link previews (debounced via abort flag).
  useEffect(() => {
    if (source !== 'link') {
      setLinkPreview(null);
      setLinkLoading(false);
      return undefined;
    }
    const raw = (slot.externalUrl || '').trim();
    if (!raw || !embedHost || !embedSrc) {
      setLinkPreview(null);
      setLinkLoading(false);
      return undefined;
    }
    if (lastFetchedRef.current === raw) return undefined;
    lastFetchedRef.current = raw;

    const hostLabel =
      embedHost === 'youtube'
        ? 'YouTube'
        : embedHost === 'vimeo'
          ? 'Vimeo'
          : embedHost === 'facebook'
            ? 'Facebook'
            : 'Video';
    const fallback = { title: `Watch on ${hostLabel}`, author: '', thumbnail: '' };
    if (embedHost === 'youtube') {
      const id = getYoutubeId(raw);
      if (id) fallback.thumbnail = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    }
    setLinkPreview(fallback);

    if (embedHost !== 'youtube' && embedHost !== 'vimeo') {
      setLinkLoading(false);
      return undefined;
    }

    let aborted = false;
    setLinkLoading(true);
    (async () => {
      try {
        const canonical = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`;
        const endpoint = `https://${embedHost === 'youtube' ? 'www.youtube.com' : 'vimeo.com'}/oembed?url=${encodeURIComponent(canonical)}&format=json`;
        const resp = await fetch(endpoint);
        if (!resp.ok) throw new Error('oEmbed failed');
        const data = await resp.json();
        if (aborted) return;
        setLinkPreview({
          title: data?.title || fallback.title,
          author: data?.author_name || '',
          thumbnail: data?.thumbnail_url || fallback.thumbnail || '',
        });
        if (!slot.uploadThumbnailUrl && data?.thumbnail_url) {
          // Persist a thumbnail hint for the hub page even when in link mode.
          onChange({ ...slot, externalThumbnailUrl: data.thumbnail_url });
        }
      } catch {
        // Keep the fallback silently.
      } finally {
        if (!aborted) setLinkLoading(false);
      }
    })();

    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, slot.externalUrl, embedHost, embedSrc]);

  const clearUpload = () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview('');
    setProgress(0);
    onChange({
      ...slot,
      uploadUrl: '',
      uploadPublicId: '',
      uploadThumbnailUrl: '',
    });
  };

  const handleVideoUpload = async (file) => {
    setError('');
    const err = await validateVideoFile(file);
    if (err) {
      setError(err);
      return;
    }
    if (localPreview) URL.revokeObjectURL(localPreview);
    const preview = URL.createObjectURL(file);
    setLocalPreview(preview);
    setUploading(true);
    try {
      const uploaded = await campaignService.uploadToCloudinary(
        file,
        'video',
        (p) => setProgress(p),
        { draft: !isAuthenticated }
      );
      onChange({
        ...slot,
        uploadUrl: uploaded.url,
        uploadPublicId: uploaded.publicId,
        uploadThumbnailUrl: uploaded.thumbnailUrl || '',
        // First upload pre-fills the label so the user can just review/edit.
        label: slot.label || labelFromFileName(file.name) || `Video ${index + 1}`,
      });
      setProgress(100);
    } catch {
      setError('Video upload failed. Please try again.');
      clearUpload();
    } finally {
      setUploading(false);
    }
  };

  const ready = isVideoSlotReady(slot, source);

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          Video {index + 1}
          {ready && <span className="ml-2 text-xs font-medium text-emerald-400">Ready</span>}
        </p>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove video ${index + 1}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {source === 'upload' ? (
        <div className="space-y-3">
          {uploading ? (
            <UploadProgress progress={progress} label={`Uploading video ${index + 1}…`} />
          ) : slot.uploadUrl ? (
            <div className="relative overflow-hidden rounded-xl border border-brand-500/30 bg-[var(--surface-2)]">
              <video
                src={localPreview || slot.uploadUrl}
                controls
                className="max-h-56 w-full object-contain"
              />
              <button
                type="button"
                onClick={clearUpload}
                className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80"
                aria-label="Replace video"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <FileDropZone
              accept={ACCEPTED_VIDEO_TYPES}
              acceptLabel="MP4, WebM, MOV"
              maxSizeMB={MAX_VIDEO_MB}
              onFile={handleVideoUpload}
              error={error}
              icon={VideoIcon}
              hint="Max 60s · up to 100 MB"
            />
          )}
          <FormInput
            id={`video-label-${slot.uid}`}
            label="Video label"
            placeholder="e.g. Product demo"
            value={slot.label}
            onChange={(e) => onChange({ ...slot, label: e.target.value.slice(0, 80) })}
            maxLength={80}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <FormInput
            id={`video-url-${slot.uid}`}
            label="YouTube / Vimeo / Facebook URL"
            placeholder="https://youtube.com/watch?v=..."
            value={slot.externalUrl}
            onChange={(e) => onChange({ ...slot, externalUrl: e.target.value })}
            error={
              slot.externalUrl?.trim()
              && (!isAllowedVideoHost(slot.externalUrl) || !toEmbedSrc(slot.externalUrl))
                ? 'Only YouTube, Vimeo, or Facebook video URLs are supported'
                : ''
            }
          />
          {embedSrc && (
            <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--surface-2)]">
              {linkPreview?.thumbnail ? (
                <img
                  src={linkPreview.thumbnail}
                  alt=""
                  aria-hidden="true"
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-[var(--surface-3)] text-[var(--text-muted)]">
                  <VideoIcon size={28} />
                </div>
              )}
              <div className="space-y-1 px-3 py-2.5">
                <p className="line-clamp-2 text-sm font-medium text-[var(--text-primary)]">
                  {linkPreview?.title || 'Video link preview'}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {linkPreview?.author
                    ? `${linkPreview.author} · ${embedHost || 'video source'}`
                    : `Source: ${embedHost || 'embedded video'}`}
                </p>
                <div className="pt-1">
                  <a
                    href={slot.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:underline"
                  >
                    Open video
                    <ExternalLink size={12} />
                  </a>
                  {linkLoading && (
                    <span className="ml-2 text-xs text-[var(--text-muted)]">Loading details…</span>
                  )}
                </div>
              </div>
            </div>
          )}
          <FormInput
            id={`video-label-${slot.uid}`}
            label="Video label"
            placeholder="e.g. Founder welcome"
            value={slot.label}
            onChange={(e) => onChange({ ...slot, label: e.target.value.slice(0, 80) })}
            maxLength={80}
          />
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────
   DocSlotRow
   - drop zone restricted to allowed mime types + size
   - once uploaded, shows file icon + filename + label input
   ───────────────────────────────────────────────────────────────────────── */
const DocSlotRow = ({ index, slot, isAuthenticated, onChange, onRemove, canRemove }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleUpload = async (file) => {
    setError('');
    if (!ALLOWED_DOC_MIME_TYPES.includes(file.type)) {
      setError('Unsupported file type. Allowed: ' + DOC_ACCEPT_LABEL);
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      setError(`File exceeds ${MAX_DOC_MB} MB.`);
      return;
    }
    setUploading(true);
    try {
      const uploaded = await campaignService.uploadDocumentToCloudinary(
        file,
        (p) => setProgress(p),
        { draft: !isAuthenticated }
      );
      onChange({
        ...slot,
        url: uploaded.url,
        publicId: uploaded.publicId,
        mimeType: uploaded.mimeType || file.type,
        bytes: uploaded.bytes || file.size || 0,
        resourceType: uploaded.resourceType || 'raw',
        fileName: file.name,
        label: slot.label || labelFromFileName(file.name) || `Document ${index + 1}`,
      });
      setProgress(100);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const clearUpload = () => {
    setProgress(0);
    onChange({
      ...slot,
      url: '',
      publicId: '',
      mimeType: '',
      bytes: 0,
      resourceType: 'raw',
      fileName: '',
    });
  };

  const isImage = (slot.mimeType || '').startsWith('image/');
  const ready = isDocSlotReady(slot);

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          Document {index + 1}
          {ready && <span className="ml-2 text-xs font-medium text-emerald-400">Ready</span>}
        </p>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove document ${index + 1}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {uploading ? (
        <UploadProgress progress={progress} label={`Uploading document ${index + 1}…`} />
      ) : slot.url ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
                {isImage ? <ImageIcon size={18} /> : <FileText size={18} />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                  {slot.fileName || 'Uploaded document'}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {slot.mimeType || 'document'} · {formatBytes(slot.bytes)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearUpload}
              aria-label="Remove document file"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-red-500/10 hover:text-red-400"
            >
              <X size={14} />
            </button>
          </div>
          <FormInput
            id={`doc-label-${slot.uid}`}
            label="Document label"
            placeholder="e.g. Pitch deck (PDF)"
            value={slot.label}
            onChange={(e) => onChange({ ...slot, label: e.target.value.slice(0, 80) })}
            maxLength={80}
          />
        </div>
      ) : (
        <FileDropZone
          accept={DOC_ACCEPT_STRING}
          acceptLabel={DOC_ACCEPT_LABEL}
          maxSizeMB={MAX_DOC_MB}
          onFile={handleUpload}
          error={error}
          icon={FileText}
          hint="One file per slot · up to 25 MB"
        />
      )}
    </div>
  );
};

const Step1LinksDocVideo = ({
  isAuthenticated,
  campaignName,
  onCampaignNameChange,
  onRegenerateName,
  videoSource,
  onVideoSourceChange,
  videoSlots,
  onVideoSlotsChange,
  docSlots,
  onDocSlotsChange,
  linkRows,
  onLinkRowsChange,
  preciseGeoAnalytics,
  onPreciseGeoAnalyticsChange,
  onContinue,
}) => {
  const [nameError, setNameError] = useState('');
  const [topError, setTopError] = useState('');
  const [linkError, setLinkError] = useState('');

  const updateVideoSlot = (uid, next) =>
    onVideoSlotsChange(videoSlots.map((s) => (s.uid === uid ? next : s)));
  const removeVideoSlot = (uid) =>
    onVideoSlotsChange(videoSlots.filter((s) => s.uid !== uid));
  const addVideoSlot = () => {
    if (videoSlots.length >= MAX_VIDEO_SLOTS) return;
    onVideoSlotsChange([...videoSlots, createVideoSlot()]);
  };

  const updateDocSlot = (uid, next) =>
    onDocSlotsChange(docSlots.map((s) => (s.uid === uid ? next : s)));
  const removeDocSlot = (uid) =>
    onDocSlotsChange(docSlots.filter((s) => s.uid !== uid));
  const addDocSlot = () => {
    if (docSlots.length >= MAX_DOC_SLOTS) return;
    onDocSlotsChange([...docSlots, createDocSlot()]);
  };

  const handleSourceChange = (next) => {
    if (next === videoSource) return;
    setTopError('');
    onVideoSourceChange(next);
  };

  const handleContinue = () => {
    const err = validateLinksDocVideoForm({
      campaignName,
      videoSource,
      videoSlots,
      docSlots,
      linkRows,
    });

    if (err) {
      const lower = err.toLowerCase();
      const isLinkError =
        lower.includes('link')
        && !lower.includes('video')
        && !lower.includes('youtube')
        && !lower.includes('document');
      setNameError(lower.includes('campaign') ? err : '');
      setLinkError(isLinkError ? err : '');
      setTopError(!lower.includes('campaign') && !isLinkError ? err : '');
      return;
    }

    setNameError('');
    setLinkError('');
    setTopError('');

    onContinue(
      buildLinksDocVideoPayload({
        campaignName,
        videoSource,
        videoSlots,
        docSlots,
        linkRows,
        preciseGeoAnalytics,
      })
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
          <QrCode size={18} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Step 1: Videos, documents &amp; links
          </h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Add up to 5 videos and 5 documents, plus the destination links visitors will tap.
            At least one video or document is required.
          </p>
        </div>
      </div>

      <FormInput
        id="linksDocVideoCampaignName"
        label="Campaign name"
        placeholder="e.g. Investor Resources Hub"
        value={campaignName}
        onChange={(e) => {
          setNameError('');
          onCampaignNameChange(e.target.value);
        }}
        error={nameError}
        maxLength={100}
        required
        hint={(
          <button
            type="button"
            onClick={onRegenerateName}
            className="text-xs font-medium text-brand-400 hover:text-brand-300"
          >
            Regenerate name
          </button>
        )}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Videos</p>
            <p className="text-xs text-[var(--text-muted)]">
              Pick a campaign-wide source. All videos use the same mode.
            </p>
          </div>
          <span className="text-xs font-medium text-[var(--text-muted)]">
            {videoSlots.length} / {MAX_VIDEO_SLOTS}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <SourceTab
            active={videoSource === 'upload'}
            onClick={() => handleSourceChange('upload')}
            Icon={UploadCloud}
            label="Upload videos"
          />
          <SourceTab
            active={videoSource === 'link'}
            onClick={() => handleSourceChange('link')}
            Icon={Link2}
            label="Paste video links"
          />
        </div>

        <div className="space-y-3">
          {videoSlots.map((slot, idx) => (
            <VideoSlotRow
              key={slot.uid}
              index={idx}
              slot={slot}
              source={videoSource}
              isAuthenticated={isAuthenticated}
              canRemove={videoSlots.length > 0}
              onChange={(next) => updateVideoSlot(slot.uid, next)}
              onRemove={() => removeVideoSlot(slot.uid)}
            />
          ))}
          <button
            type="button"
            onClick={addVideoSlot}
            disabled={videoSlots.length >= MAX_VIDEO_SLOTS}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--surface-2)] py-3 text-sm font-medium text-[var(--text-secondary)] transition hover:border-brand-500/50 hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={15} />
            {videoSlots.length === 0 ? 'Add a video' : 'Add another video'}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Documents</p>
            <p className="text-xs text-[var(--text-muted)]">
              {DOC_ACCEPT_LABEL} · up to {MAX_DOC_MB} MB each.
            </p>
          </div>
          <span className="text-xs font-medium text-[var(--text-muted)]">
            {docSlots.length} / {MAX_DOC_SLOTS}
          </span>
        </div>

        <div className="space-y-3">
          {docSlots.map((slot, idx) => (
            <DocSlotRow
              key={slot.uid}
              index={idx}
              slot={slot}
              isAuthenticated={isAuthenticated}
              canRemove={docSlots.length > 0}
              onChange={(next) => updateDocSlot(slot.uid, next)}
              onRemove={() => removeDocSlot(slot.uid)}
            />
          ))}
          <button
            type="button"
            onClick={addDocSlot}
            disabled={docSlots.length >= MAX_DOC_SLOTS}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--surface-2)] py-3 text-sm font-medium text-[var(--text-secondary)] transition hover:border-brand-500/50 hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={15} />
            {docSlots.length === 0 ? 'Add a document' : 'Add another document'}
          </button>
        </div>
      </section>

      <MultiLinksEditor
        rows={linkRows}
        onRowsChange={(next) => {
          setLinkError('');
          onLinkRowsChange(next);
        }}
        error={linkError}
      />

      {topError && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {topError}
        </p>
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-4">
        <input
          type="checkbox"
          checked={preciseGeoAnalytics}
          onChange={(e) => onPreciseGeoAnalyticsChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-[var(--border-color)]"
        />
        <div>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Precise location (optional)
          </span>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Ask visitors for browser location after scan for richer map analytics.
          </p>
        </div>
      </label>

      {preciseGeoAnalytics && (
        <p className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-4 py-2 text-xs text-[var(--text-muted)]">
          Until you publish, the QR preview uses a temporary /open/… link. After publishing, your live link becomes
          {' '}
          <span className="text-[var(--text-secondary)]">/open/your-handle/your-campaign-slug</span>
          {' '}
          (a number suffix may be added if that path is already used).
        </p>
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={!campaignName.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-accent-600 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-95"
      >
        Continue to design
        <ArrowRight size={16} />
      </button>
    </div>
  );
};

export default Step1LinksDocVideo;
