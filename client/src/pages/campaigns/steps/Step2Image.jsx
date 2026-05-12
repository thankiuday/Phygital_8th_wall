import { useState } from 'react';
import { ArrowLeft, ArrowRight, Image as ImageIcon, Loader2 } from 'lucide-react';
import FileDropZone from '../../../components/ui/FileDropZone';
import UploadProgress from '../../../components/ui/UploadProgress';
import useCampaignStore from '../../../store/useCampaignStore';

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';
const MAX_SIZE_MB = 10;

/* ── Client-side image validation ────────────────────────────────── */
const validateImage = async (file) => {
  // Check type
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return 'Only JPG, PNG, and WebP images are accepted.';
  }
  // Check min dimensions (must be at least 300×200)
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      if (img.width < 300 || img.height < 200) {
        resolve('Image too small. Minimum 300×200 pixels.');
      } else {
        resolve(null);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); resolve(null); };
    img.src = URL.createObjectURL(file);
  });
};

const Step2Image = () => {
  const {
    wizardData,
    updateWizardData,
    setWizardStep,
    uploadImage,
    isUploading,
    uploadProgress,
    wizardError,
  } = useCampaignStore();

  const [fileError, setFileError] = useState('');

  const handleFile = async (file) => {
    setFileError('');
    const err = await validateImage(file);
    if (err) return setFileError(err);

    const preview = URL.createObjectURL(file);
    updateWizardData({
      targetImageFile: file,
      targetImagePreview: preview,
      // Clear any previously uploaded URL so a fresh upload runs
      targetImageUrl: null,
      targetImagePublicId: null,
    });
  };

  const handleClear = () => {
    if (wizardData.targetImagePreview) URL.revokeObjectURL(wizardData.targetImagePreview);
    updateWizardData({
      targetImageFile: null,
      targetImagePreview: null,
      targetImageUrl: null,
      targetImagePublicId: null,
    });
    setFileError('');
  };

  const handleNext = async () => {
    if (!wizardData.targetImageFile && !wizardData.targetImageUrl) {
      return setFileError('Please select your business card image.');
    }

    // Upload if not done yet
    if (!wizardData.targetImageUrl) {
      const result = await uploadImage(wizardData.targetImageFile);
      if (!result.success) return; // error shown via wizardError
    }

    setWizardStep(3);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Upload your business card</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          This image will be used as the AR marker. Point a phone camera at this card to trigger the hologram.
        </p>
      </div>

      {/* Tips */}
      <div className="rounded-xl border border-accent-500/20 bg-accent-500/5 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-400">
          Tips for best results
        </p>
        <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
          <li>• Use the <strong>front side</strong> of your printed business card.</li>
          <li>• Ensure it has <strong>rich visual detail</strong> — not just plain colour.</li>
          <li>• Minimum resolution: <strong>300 × 200 px</strong>.</li>
          <li>• Accepted formats: <strong>JPG, PNG, WebP</strong> · Max 10 MB.</li>
        </ul>
      </div>

      {/* Drop zone */}
      {!isUploading ? (
        <FileDropZone
          accept={ACCEPTED_TYPES}
          acceptLabel="JPG, PNG, WebP"
          maxSizeMB={MAX_SIZE_MB}
          onFile={handleFile}
          previewUrl={wizardData.targetImagePreview}
          previewType="image"
          onClear={handleClear}
          error={fileError || wizardError}
          icon={ImageIcon}
          hint="The image our AR engine will use as the physical target marker"
        />
      ) : (
        <UploadProgress
          progress={uploadProgress.image}
          label="Uploading card image to Cloudinary…"
        />
      )}

      {/* Uploaded indicator */}
      {wizardData.targetImageUrl && !isUploading && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-green-400">
          ✓ Image uploaded successfully
        </p>
      )}

      {/* Nav buttons — stacks on phones so the primary "Next" button is full
          width and easy to tap; restores side-by-side from sm: up. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setWizardStep(1)}
          disabled={isUploading}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-brand-500/50 disabled:opacity-50"
        >
          <ArrowLeft size={15} /> Back
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={isUploading || (!wizardData.targetImageFile && !wizardData.targetImageUrl)}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-glow hover:bg-brand-500 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? (
            <><Loader2 size={15} className="animate-spin" /> Uploading…</>
          ) : (
            <>Next: Upload Video <ArrowRight size={15} /></>
          )}
        </button>
      </div>
    </div>
  );
};

export default Step2Image;
