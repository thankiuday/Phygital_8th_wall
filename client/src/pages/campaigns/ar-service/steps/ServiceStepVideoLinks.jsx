import { useState } from 'react';
import { ArrowLeft, ArrowRight, Video, Link2, Loader2 } from 'lucide-react';
import FileDropZone from '../../../../components/ui/FileDropZone';
import UploadProgress from '../../../../components/ui/UploadProgress';
import MultiLinksEditor from '../../multiple-links/MultiLinksEditor';
import { validateLinkRows } from '../../multiple-links/multiLinkFormUtils';
import useArServiceRequestStore from '../../../../store/useArServiceRequestStore';
import { AR_VIDEO_MAX_DURATION_SEC, arVideoDurationHint } from '../../../../constants/arVideoLimits';

const ACCEPTED_MP4 = 'video/mp4,.mp4';
const MAX_DURATION_SEC = AR_VIDEO_MAX_DURATION_SEC;

const validateMp4 = (file) =>
  new Promise((resolve) => {
    const typeOk = file.type === 'video/mp4';
    const extOk = /\.mp4$/i.test(file.name || '');
    if (!typeOk && !extOk) {
      return resolve('Please upload a green-screen video as MP4.');
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

const ServiceStepVideoLinks = () => {
  const {
    wizardData,
    updateWizardData,
    setWizardStep,
    uploadGreenscreenVideo,
    isUploading,
    uploadProgress,
    wizardError,
  } = useArServiceRequestStore();

  const [fileError, setFileError] = useState('');
  const [linkError, setLinkError] = useState('');

  const handleFile = async (file) => {
    setFileError('');
    const err = await validateMp4(file);
    if (err) return setFileError(err);
    const preview = URL.createObjectURL(file);
    updateWizardData({
      greenscreenVideoFile: file,
      greenscreenVideoPreview: preview,
      greenscreenVideoUrl: null,
      greenscreenVideoPublicId: null,
    });
  };

  const handleClear = () => {
    if (wizardData.greenscreenVideoPreview) URL.revokeObjectURL(wizardData.greenscreenVideoPreview);
    updateWizardData({
      greenscreenVideoFile: null,
      greenscreenVideoPreview: null,
      greenscreenVideoUrl: null,
      greenscreenVideoPublicId: null,
    });
    setFileError('');
  };

  const handleNext = async () => {
    setLinkError('');
    const linkErr = wizardData.linkRows?.length ? validateLinkRows(wizardData.linkRows) : null;
    if (linkErr) return setLinkError(linkErr);

    if (!wizardData.greenscreenVideoFile && !wizardData.greenscreenVideoUrl) {
      return setFileError('Please upload your green-screen video.');
    }
    if (!wizardData.greenscreenVideoUrl) {
      const result = await uploadGreenscreenVideo(wizardData.greenscreenVideoFile);
      if (!result.success) return;
    }
    setWizardStep(4);
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Green-screen video</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Upload your hologram footage recorded on a green screen as <strong>MP4</strong>. Our team will process it for Android and iPhone.
        </p>
      </div>

      <FileDropZone
        accept={ACCEPTED_MP4}
        maxSizeMb={200}
        onFile={handleFile}
        onClear={handleClear}
        previewUrl={wizardData.greenscreenVideoPreview}
        previewType="video"
        label="Drop green-screen MP4 here"
        hint={`MP4 only · ${arVideoDurationHint()}`}
        icon={Video}
      />
      {isUploading && <UploadProgress label="Uploading video…" progress={uploadProgress.video} />}
      {fileError && <p className="text-sm text-red-400">{fileError}</p>}

      <div className="border-t border-[var(--border-color)] pt-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
            <Link2 size={18} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Social links</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Optional links for your profile hub after scanning.</p>
          </div>
        </div>
        <MultiLinksEditor
          rows={wizardData.linkRows}
          onRowsChange={(rows) => updateWizardData({ linkRows: rows })}
          error={linkError}
        />
      </div>

      {wizardError && <p className="text-sm text-red-400">{wizardError}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={() => setWizardStep(2)} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2.5 text-sm">
          <ArrowLeft size={15} /> Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={isUploading}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isUploading ? <Loader2 size={15} className="animate-spin" /> : null}
          Review &amp; submit <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default ServiceStepVideoLinks;
