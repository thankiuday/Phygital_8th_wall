import { useState } from 'react';
import { ArrowLeft, ArrowRight, Video as VideoIcon, Loader2 } from 'lucide-react';
import FileDropZone from '../../../components/ui/FileDropZone';
import UploadProgress from '../../../components/ui/UploadProgress';
import useCampaignStore from '../../../store/useCampaignStore';

const ACCEPTED_TYPES = 'video/mp4,video/webm,video/quicktime';
const MAX_SIZE_MB = 100;
const MAX_DURATION_SEC = 60;

/* ── Client-side video validation ────────────────────────────────── */
const validateVideo = (file) =>
  new Promise((resolve) => {
    if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) {
      return resolve('Only MP4, WebM, and MOV videos are accepted.');
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      if (video.duration > MAX_DURATION_SEC) {
        resolve(`Video is too long (${Math.round(video.duration)}s). Maximum is ${MAX_DURATION_SEC} seconds.`);
      } else if (video.duration < 1) {
        resolve('Video appears to be empty. Please upload a valid video.');
      } else {
        resolve(null);
      }
    };
    video.onerror = () => { URL.revokeObjectURL(video.src); resolve(null); };
    video.src = URL.createObjectURL(file);
  });

/* ── Aspect ratio hint badge ─────────────────────────────────────── */
const AspectBadge = ({ label, recommended }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
    recommended
      ? 'bg-brand-500/15 text-brand-400'
      : 'bg-[var(--surface-3)] text-[var(--text-muted)]'
  }`}>
    {label} {recommended && '✓ Recommended'}
  </span>
);

const Step3Video = () => {
  const {
    wizardData,
    updateWizardData,
    setWizardStep,
    uploadVideo,
    isUploading,
    uploadProgress,
    wizardError,
  } = useCampaignStore();

  const [fileError, setFileError] = useState('');

  const handleFile = async (file) => {
    setFileError('');
    const err = await validateVideo(file);
    if (err) return setFileError(err);

    const preview = URL.createObjectURL(file);
    updateWizardData({
      videoFile: file,
      videoPreview: preview,
      videoUrl: null,
      videoPublicId: null,
    });
  };

  const handleClear = () => {
    if (wizardData.videoPreview) URL.revokeObjectURL(wizardData.videoPreview);
    updateWizardData({
      videoFile: null,
      videoPreview: null,
      videoUrl: null,
      videoPublicId: null,
      thumbnailUrl: null,
    });
    setFileError('');
  };

  const handleNext = async () => {
    if (!wizardData.videoFile && !wizardData.videoUrl) {
      return setFileError('Please select your intro video.');
    }

    if (!wizardData.videoUrl) {
      const result = await uploadVideo(wizardData.videoFile);
      if (!result.success) return;
    }

    setWizardStep(4);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Upload your intro video</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          This vertical video will appear as a hologram floating above your business card when scanned.
        </p>
      </div>

      {/* Aspect ratio guide */}
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Video Requirements
        </p>
        <div className="flex flex-wrap gap-2">
          <AspectBadge label="9:16 Vertical" recommended />
          <AspectBadge label="Max 60 seconds" />
          <AspectBadge label="MP4 / WebM / MOV" />
          <AspectBadge label="Max 100 MB" />
        </div>

        {/* Visual ratio reference */}
        <div className="flex items-center gap-4 pt-1">
          <div className="flex flex-col items-center gap-1">
            <div className="h-16 w-9 rounded-md border-2 border-brand-500/50 bg-brand-500/10" />
            <span className="text-xs text-brand-400">9:16 ✓</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="h-9 w-16 rounded-md border-2 border-[var(--border-color)] bg-[var(--surface-3)]" />
            <span className="text-xs text-[var(--text-muted)]">16:9 ✗</span>
          </div>
          <p className="flex-1 text-xs text-[var(--text-muted)]">
            Vertical (portrait) video looks best as a hologram above the card. Record in portrait mode on your phone.
          </p>
        </div>
      </div>

      {/* Drop zone */}
      {!isUploading ? (
        <FileDropZone
          accept={ACCEPTED_TYPES}
          acceptLabel="MP4, WebM, MOV"
          maxSizeMB={MAX_SIZE_MB}
          onFile={handleFile}
          previewUrl={wizardData.videoPreview}
          previewType="video"
          onClear={handleClear}
          error={fileError || wizardError}
          icon={VideoIcon}
          hint="9:16 vertical video · max 60 seconds"
        />
      ) : (
        <UploadProgress
          progress={uploadProgress.video}
          label="Uploading video to Cloudinary…"
        />
      )}

      {wizardData.videoUrl && !isUploading && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-green-400">
          ✓ Video uploaded successfully
        </p>
      )}

      {/* Nav buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setWizardStep(2)}
          disabled={isUploading}
          className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-brand-500/50 disabled:opacity-50"
        >
          <ArrowLeft size={15} /> Back
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={isUploading || (!wizardData.videoFile && !wizardData.videoUrl)}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-glow hover:bg-brand-500 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? (
            <><Loader2 size={15} className="animate-spin" /> Uploading…</>
          ) : (
            <>Review Campaign <ArrowRight size={15} /></>
          )}
        </button>
      </div>
    </div>
  );
};

export default Step3Video;
