import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Video as VideoIcon,
  Loader2,
  Smartphone,
  Apple,
} from 'lucide-react';
import FileDropZone from '../../../components/ui/FileDropZone';
import UploadProgress from '../../../components/ui/UploadProgress';
import useCampaignStore from '../../../store/useCampaignStore';

/**
 * Step 3 — Hologram video upload.
 *
 * Two paired uploads are required for a polished AR experience:
 *
 *   1. WebM (VP9 + alpha)        → Android Chrome / non-iOS browsers play
 *      this directly through HTML5 <video>; transparency works out of the
 *      box because every non-WebKit engine honours the alpha channel.
 *
 *   2. Side-by-side .mov (H.264) → iOS Safari can NOT show alpha on a
 *      <video> overlay, so the AR engine plays a regular H.264 .mov whose
 *      RGB is in the LEFT half of every frame and the alpha mask (as
 *      grayscale) is in the RIGHT half. The engine recombines them in a
 *      WebGL ShaderMaterial. Generate this format with the Transpify
 *      green-screen processor.
 *
 * Both fields are required at this step — without the iOS upload, iPhone
 * visitors see a solid black background over the AR camera feed.
 */

const ACCEPTED_WEBM_TYPES = 'video/webm,.webm';
const ACCEPTED_MOV_TYPES = 'video/quicktime,.mov';

const MAX_DURATION_SEC = 60;

const WEBM_EXT = /\.webm(\?|$)/i;
const MOV_EXT = /\.mov(\?|$)/i;

/* ── Per-format file validation ────────────────────────────────── */

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
      if (video.duration > MAX_DURATION_SEC) {
        resolve(`Video is too long (${Math.round(video.duration)}s). Max ${MAX_DURATION_SEC}s.`);
      } else if (video.duration < 1) {
        resolve('Video appears to be empty.');
      } else {
        resolve(null);
      }
    };
    video.onerror = () => { URL.revokeObjectURL(video.src); resolve(null); };
    video.src = URL.createObjectURL(file);
  });

const validateMovFile = (file) =>
  new Promise((resolve) => {
    // MOV from the Transpify exporter is technically video/quicktime, but
    // some browsers (and some Transpify builds) tag it as video/mp4 — accept
    // either when the extension is .mov to avoid false negatives.
    const typeOk = file.type === 'video/quicktime' || file.type === 'video/mp4';
    const extOk = MOV_EXT.test(file.name || '');
    if (!typeOk && !extOk) {
      return resolve('The iOS upload must be the side-by-side .mov file.');
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      if (video.duration > MAX_DURATION_SEC) {
        resolve(`Video is too long (${Math.round(video.duration)}s). Max ${MAX_DURATION_SEC}s.`);
      } else if (video.duration < 1) {
        resolve('Video appears to be empty.');
      } else if (
        Number.isFinite(video.videoWidth)
        && Number.isFinite(video.videoHeight)
        && video.videoWidth > 0
        && video.videoHeight > 0
        && video.videoWidth < video.videoHeight
      ) {
        // The side-by-side master should be roughly twice as wide as it is
        // tall (9:16 portrait + 9:16 alpha mask = 18:16). A portrait-shaped
        // .mov here means the user accidentally dropped the raw render
        // instead of the side-by-side export.
        resolve('Use the side-by-side .mov export (RGB on the left, alpha mask on the right).');
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

/* ── Format card header (icon + title + subtitle) ────────────────── */
const FormatHeader = ({ icon: Icon, title, subtitle, accent }) => (
  <div className="flex items-start gap-3">
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
      <Icon size={17} />
    </div>
    <div className="min-w-0">
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">{subtitle}</p>
    </div>
  </div>
);

const Step3Video = ({ fulfillMode = false }) => {
  const {
    wizardData,
    updateWizardData,
    setWizardStep,
    uploadVideo,
    uploadVideoIos,
    uploadProgress,
    wizardError,
    fulfillRequestId,
  } = useCampaignStore();

  const isFulfill = fulfillMode || !!fulfillRequestId;

  const [webmError, setWebmError] = useState('');
  const [movError, setMovError] = useState('');
  const [webmUploading, setWebmUploading] = useState(false);
  const [movUploading, setMovUploading] = useState(false);

  /* ── WebM (Android) handlers ─────────────────────────────────── */

  const handleWebmFile = async (file) => {
    setWebmError('');
    const err = await validateWebmFile(file);
    if (err) return setWebmError(err);

    if (wizardData.videoPreview?.startsWith?.('blob:')) {
      URL.revokeObjectURL(wizardData.videoPreview);
    }
    const preview = URL.createObjectURL(file);
    updateWizardData({
      videoFile: file,
      videoPreview: preview,
      videoUrl: null,
      videoPublicId: null,
    });

    setWebmUploading(true);
    const result = await uploadVideo(file);
    setWebmUploading(false);
    if (!result.success) {
      setWebmError(result.message || 'Upload failed — please try again.');
    }
  };

  const handleWebmClear = () => {
    if (wizardData.videoPreview?.startsWith?.('blob:')) {
      URL.revokeObjectURL(wizardData.videoPreview);
    }
    updateWizardData({
      videoFile: null,
      videoPreview: null,
      videoUrl: null,
      videoPublicId: null,
      thumbnailUrl: null,
    });
    setWebmError('');
  };

  /* ── MOV (iOS side-by-side) handlers ─────────────────────────── */

  const handleMovFile = async (file) => {
    setMovError('');
    const err = await validateMovFile(file);
    if (err) return setMovError(err);

    if (wizardData.videoPreviewIos?.startsWith?.('blob:')) {
      URL.revokeObjectURL(wizardData.videoPreviewIos);
    }
    const preview = URL.createObjectURL(file);
    updateWizardData({
      videoFileIos: file,
      videoPreviewIos: preview,
      videoUrlIos: null,
      videoIosPublicId: null,
    });

    setMovUploading(true);
    const result = await uploadVideoIos(file);
    setMovUploading(false);
    if (!result.success) {
      setMovError(result.message || 'Upload failed — please try again.');
    }
  };

  const handleMovClear = () => {
    if (wizardData.videoPreviewIos?.startsWith?.('blob:')) {
      URL.revokeObjectURL(wizardData.videoPreviewIos);
    }
    updateWizardData({
      videoFileIos: null,
      videoPreviewIos: null,
      videoUrlIos: null,
      videoIosPublicId: null,
    });
    setMovError('');
  };

  /* ── Navigation ──────────────────────────────────────────────── */

  const webmReady = !!wizardData.videoUrl && !webmUploading;
  const movReady = !!wizardData.videoUrlIos && !movUploading;
  const anyUploading = webmUploading || movUploading;

  const handleNext = () => {
    if (!webmReady) {
      return setWebmError('Please upload the transparent .webm file for Android first.');
    }
    if (!movReady) {
      return setMovError(
        'Please upload the side-by-side .mov file so iPhone visitors see the hologram with a transparent background.',
      );
    }
    setWizardStep(isFulfill ? 2 : 5);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          {isFulfill ? 'Upload processed hologram videos' : 'Upload your hologram video'}
        </h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {isFulfill ? (
            <>
              Download the user&apos;s green-screen MP4 above, convert it, then upload{' '}
              <strong>both</strong> transparent exports here. Their card image and QR placement
              are already saved — you do not need to reposition the QR.
            </>
          ) : (
            <>
              We need <strong>two</strong> transparent exports of the same clip so the hologram
              renders correctly on both Android and iPhone visitors.
            </>
          )}
        </p>
      </div>

      {/* Spec card */}
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Source video requirements
        </p>
        <div className="flex flex-wrap gap-2">
          <AspectBadge label="9:16 Vertical" recommended />
          <AspectBadge label={`Max ${MAX_DURATION_SEC} seconds`} />
          <AspectBadge label="Transparent background" />
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Run your green-screen clip through Transpify (or any equivalent tool) and export
          both the <code className="rounded bg-[var(--surface-3)] px-1 py-0.5">.webm</code> and
          the side-by-side <code className="rounded bg-[var(--surface-3)] px-1 py-0.5">.mov</code>.
          Drop each one into the matching slot below.
        </p>
      </div>

      {/* ── Slot 1: WebM (Android) ────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
        <FormatHeader
          icon={Smartphone}
          accent="bg-emerald-500/15 text-emerald-400"
          title="Android · transparent .webm"
          subtitle="VP9 + native alpha. Plays directly in HTML5 <video> on Android Chrome."
        />

        {webmUploading ? (
          <UploadProgress
            progress={uploadProgress.video}
            label="Uploading the WebM file…"
          />
        ) : (
          <FileDropZone
            accept={ACCEPTED_WEBM_TYPES}
            acceptLabel="WebM only (VP9 + alpha)"
            maxSizeMB={null}
            onFile={handleWebmFile}
            previewUrl={wizardData.videoPreview}
            previewType="video"
            onClear={handleWebmClear}
            error={webmError || (wizardError && !movError ? wizardError : '')}
            icon={VideoIcon}
            hint="Drop the .webm export here"
          />
        )}

        {webmReady && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            ✓ WebM uploaded — Android visitors will see a fully transparent hologram.
          </p>
        )}
      </div>

      {/* ── Slot 2: MOV (iOS side-by-side) ──────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
        <FormatHeader
          icon={Apple}
          accent="bg-sky-500/15 text-sky-400"
          title="iPhone / iPad · side-by-side .mov"
          subtitle="H.264 with RGB on the left and alpha mask on the right. Required — without it, iPhone visitors see a black background."
        />

        {movUploading ? (
          <UploadProgress
            progress={uploadProgress.videoIos}
            label="Uploading the iOS .mov file…"
          />
        ) : (
          <FileDropZone
            accept={ACCEPTED_MOV_TYPES}
            acceptLabel="MOV only (side-by-side alpha)"
            maxSizeMB={null}
            onFile={handleMovFile}
            previewUrl={wizardData.videoPreviewIos}
            previewType="video"
            onClear={handleMovClear}
            error={movError || (wizardError && !webmError ? wizardError : '')}
            icon={VideoIcon}
            hint="Drop the side-by-side .mov export here"
          />
        )}

        {movReady && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-sky-400">
            ✓ iOS .mov uploaded — iPhones will run the canvas + shader path.
          </p>
        )}
      </div>

      {/* Nav buttons — stacks on phones */}
      <div className={`flex flex-col gap-3 ${isFulfill ? 'sm:justify-end' : 'sm:flex-row sm:items-center sm:justify-between'}`}>
        {!isFulfill && (
          <button
            type="button"
            onClick={() => setWizardStep(3)}
            disabled={anyUploading}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-brand-500/50 disabled:opacity-50"
          >
            <ArrowLeft size={15} /> Back
          </button>
        )}

        <button
          type="button"
          onClick={handleNext}
          disabled={anyUploading || !webmReady || !movReady}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-glow hover:bg-brand-500 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {anyUploading ? (
            <><Loader2 size={15} className="animate-spin" /> Uploading…</>
          ) : (
            <>
              {isFulfill ? 'Next: Review & publish' : 'Next: Social Links'}
              <ArrowRight size={15} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Step3Video;
