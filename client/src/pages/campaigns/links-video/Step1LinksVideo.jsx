import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, QrCode, UploadCloud, Link2, Video as VideoIcon, ExternalLink } from 'lucide-react';
import FormInput from '../../../components/ui/FormInput';
import FileDropZone from '../../../components/ui/FileDropZone';
import UploadProgress from '../../../components/ui/UploadProgress';
import MultiLinksEditor from '../multiple-links/MultiLinksEditor';
import { campaignService } from '../../../services/campaignService';
import { detectVideoHost, toEmbedSrc } from '../../../utils/videoEmbed';
import { buildLinksVideoPayload, validateLinksVideoForm } from './linksVideoFormUtils';

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

const Step1LinksVideo = ({
  isAuthenticated,
  campaignName,
  onCampaignNameChange,
  onRegenerateName,
  linkRows,
  onLinkRowsChange,
  preciseGeoAnalytics,
  onPreciseGeoAnalyticsChange,
  onContinue,
}) => {
  const [nameError, setNameError] = useState('');
  const [videoError, setVideoError] = useState('');
  const [linkError, setLinkError] = useState('');

  const [videoSource, setVideoSource] = useState('upload');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoPreview, setVideoPreview] = useState('');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState('');
  const [uploadedVideoPublicId, setUploadedVideoPublicId] = useState('');
  const [uploadedVideoThumbnailUrl, setUploadedVideoThumbnailUrl] = useState('');
  const [externalVideoUrl, setExternalVideoUrl] = useState('');
  const [linkPreviewMeta, setLinkPreviewMeta] = useState(null);
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false);

  const embedSrc = useMemo(
    () => (videoSource === 'link' ? toEmbedSrc(externalVideoUrl) : null),
    [videoSource, externalVideoUrl]
  );
  const embedHost = useMemo(
    () => (videoSource === 'link' ? detectVideoHost(externalVideoUrl) : null),
    [videoSource, externalVideoUrl]
  );

  useEffect(() => {
    let aborted = false;
    const run = async () => {
      if (videoSource !== 'link') {
        setLinkPreviewMeta(null);
        setLinkPreviewLoading(false);
        return;
      }
      const raw = (externalVideoUrl || '').trim();
      if (!raw || !embedHost || !embedSrc) {
        setLinkPreviewMeta(null);
        setLinkPreviewLoading(false);
        return;
      }

      const hostLabel =
        embedHost === 'youtube'
          ? 'YouTube'
          : embedHost === 'vimeo'
            ? 'Vimeo'
            : embedHost === 'facebook'
              ? 'Facebook'
              : 'Video';
      const fallback = { title: `Watch video on ${hostLabel}`, author: '', thumbnail: '' };
      if (embedHost === 'youtube') {
        const id = getYoutubeId(raw);
        if (id) fallback.thumbnail = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
      }
      setLinkPreviewMeta(fallback);
      setLinkPreviewLoading(true);

      if (embedHost !== 'youtube' && embedHost !== 'vimeo') {
        setLinkPreviewLoading(false);
        return;
      }

      try {
        const canonicalUrl = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`;
        const endpoint = `https://${embedHost === 'youtube' ? 'www.youtube.com' : 'vimeo.com'}/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
        const resp = await fetch(endpoint);
        if (!resp.ok) throw new Error('oEmbed failed');
        const data = await resp.json();
        if (aborted) return;
        setLinkPreviewMeta({
          title: data?.title || fallback.title,
          author: data?.author_name || '',
          thumbnail: data?.thumbnail_url || fallback.thumbnail || '',
        });
      } catch {
        // Keep fallback preview silently.
      } finally {
        if (!aborted) setLinkPreviewLoading(false);
      }
    };

    run();
    return () => {
      aborted = true;
    };
  }, [videoSource, externalVideoUrl, embedHost, embedSrc]);

  const clearUploadState = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoPreview('');
    setUploadedVideoUrl('');
    setUploadedVideoPublicId('');
    setUploadedVideoThumbnailUrl('');
    setUploadProgress(0);
  };

  const handleVideoUpload = async (file) => {
    setVideoError('');
    const err = await validateVideoFile(file);
    if (err) {
      setVideoError(err);
      return;
    }

    clearUploadState();
    const localPreview = URL.createObjectURL(file);
    setVideoPreview(localPreview);
    setUploading(true);
    try {
      const uploaded = await campaignService.uploadToCloudinary(
        file,
        'video',
        (p) => setUploadProgress(p),
        { draft: !isAuthenticated }
      );
      setUploadedVideoUrl(uploaded.url);
      setUploadedVideoPublicId(uploaded.publicId);
      setUploadedVideoThumbnailUrl(uploaded.thumbnailUrl || '');
      setUploadProgress(100);
    } catch {
      setVideoError('Video upload failed. Please try again.');
      clearUploadState();
    } finally {
      setUploading(false);
    }
  };

  const handleContinue = () => {
    const err = validateLinksVideoForm({
      campaignName,
      videoSource,
      uploadedVideoUrl,
      externalVideoUrl,
      linkRows,
    });

    if (err) {
      setNameError(err.toLowerCase().includes('campaign') ? err : '');
      setVideoError(err.toLowerCase().includes('video') || err.toLowerCase().includes('youtube') ? err : '');
      setLinkError(err.includes('link') && !err.toLowerCase().includes('video') ? err : '');
      return;
    }

    setNameError('');
    setVideoError('');
    setLinkError('');

    onContinue(
      buildLinksVideoPayload({
        campaignName,
        videoSource,
        uploadedVideoUrl,
        uploadedVideoPublicId,
        uploadedVideoThumbnailUrl,
        externalVideoUrl,
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
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Step 1: Video + links</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Auto-name your campaign, choose a hero video source, and add the destination links.
          </p>
        </div>
      </div>

      <FormInput
        id="linksVideoCampaignName"
        label="Campaign name"
        placeholder="e.g. Product Demo Hub"
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

      <div className="space-y-3">
        <p className="text-sm font-medium text-[var(--text-primary)]">Hero video source</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <SourceTab
            active={videoSource === 'upload'}
            onClick={() => {
              setVideoError('');
              setVideoSource('upload');
            }}
            Icon={UploadCloud}
            label="Upload video"
          />
          <SourceTab
            active={videoSource === 'link'}
            onClick={() => {
              setVideoError('');
              setVideoSource('link');
            }}
            Icon={Link2}
            label="Paste video link"
          />
        </div>

        {videoSource === 'upload' ? (
          <div className="space-y-3">
            {uploading ? (
              <UploadProgress progress={uploadProgress} label="Uploading video..." />
            ) : (
              <FileDropZone
                accept={ACCEPTED_VIDEO_TYPES}
                acceptLabel="MP4, WebM, MOV"
                maxSizeMB={MAX_VIDEO_MB}
                onFile={handleVideoUpload}
                previewUrl={videoPreview}
                previewType="video"
                onClear={clearUploadState}
                error={videoError}
                icon={VideoIcon}
                hint="Max 60s · up to 100 MB"
              />
            )}
            {uploadedVideoUrl && !videoError && (
              <p className="text-xs font-medium text-emerald-400">Video uploaded successfully.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <FormInput
              id="externalVideoUrl"
              label="YouTube / Vimeo / Facebook video URL"
              placeholder="https://youtube.com/watch?v=..."
              value={externalVideoUrl}
              onChange={(e) => {
                setVideoError('');
                setExternalVideoUrl(e.target.value);
              }}
              error={videoError}
            />
            {embedSrc && (
              <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--surface-2)]">
                {linkPreviewMeta?.thumbnail ? (
                  <img
                    src={linkPreviewMeta.thumbnail}
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
                    {linkPreviewMeta?.title || 'Video link preview'}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {linkPreviewMeta?.author
                      ? `${linkPreviewMeta.author} · ${embedHost || 'video source'}`
                      : `Source: ${embedHost || 'embedded video'}`}
                  </p>
                  <div className="pt-1">
                    <a
                      href={externalVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:underline"
                    >
                      Open video
                      <ExternalLink size={12} />
                    </a>
                    {linkPreviewLoading && (
                      <span className="ml-2 text-xs text-[var(--text-muted)]">Loading details…</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <MultiLinksEditor
        rows={linkRows}
        onRowsChange={(next) => {
          setLinkError('');
          onLinkRowsChange(next);
        }}
        error={linkError}
      />

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-4">
        <input
          type="checkbox"
          checked={preciseGeoAnalytics}
          onChange={(e) => onPreciseGeoAnalyticsChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-[var(--border-color)]"
        />
        <div>
          <span className="text-sm font-medium text-[var(--text-primary)]">Precise location (optional)</span>
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

export default Step1LinksVideo;

