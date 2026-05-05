import { useMemo, useState } from 'react';
import { ArrowRight, QrCode, UploadCloud, Link2, Video as VideoIcon } from 'lucide-react';
import FormInput from '../../../components/ui/FormInput';
import FileDropZone from '../../../components/ui/FileDropZone';
import UploadProgress from '../../../components/ui/UploadProgress';
import MultiLinksEditor from '../multiple-links/MultiLinksEditor';
import { campaignService } from '../../../services/campaignService';
import { detectVideoHost, toEmbedSrc } from '../../../utils/videoEmbed';
import { buildLinksVideoPayload, validateLinksVideoForm } from './linksVideoFormUtils';

const ACCEPTED_VIDEO_TYPES = 'video/mp4,video/webm,video/quicktime';
const MAX_VIDEO_MB = 100;

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

  const embedSrc = useMemo(
    () => (videoSource === 'link' ? toEmbedSrc(externalVideoUrl) : null),
    [videoSource, externalVideoUrl]
  );
  const embedHost = useMemo(
    () => (videoSource === 'link' ? detectVideoHost(externalVideoUrl) : null),
    [videoSource, externalVideoUrl]
  );

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
        (p) => setUploadProgress(p)
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
        value={campaignName}
        onChange={(e) => {
          setNameError('');
          onCampaignNameChange(e.target.value);
        }}
        error={nameError}
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
                <iframe
                  title="Video preview"
                  src={embedSrc}
                  className="aspect-video w-full"
                  loading="lazy"
                  allow="autoplay; fullscreen; picture-in-picture"
                  referrerPolicy="no-referrer"
                />
                <p className="px-3 py-2 text-xs text-[var(--text-muted)]">
                  Preview source: {embedHost || 'embedded video'}
                </p>
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

      <button
        type="button"
        onClick={handleContinue}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-accent-600 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-95"
      >
        Continue to design
        <ArrowRight size={16} />
      </button>
    </div>
  );
};

export default Step1LinksVideo;

