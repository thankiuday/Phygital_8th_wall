import { useState } from 'react';
import { ArrowRight, Image as ImageIcon, Loader2, Clock } from 'lucide-react';
import FileDropZone from '../../../../components/ui/FileDropZone';
import UploadProgress from '../../../../components/ui/UploadProgress';
import useArServiceRequestStore from '../../../../store/useArServiceRequestStore';

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';

const validateImage = async (file) => {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return 'Only JPG, PNG, and WebP images are accepted.';
  }
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

const ServiceStepImage = ({ product }) => {
  const assetNoun = product?.assetNoun || 'card';
  const {
    wizardData,
    updateWizardData,
    setWizardStep,
    uploadImage,
    isUploading,
    uploadProgress,
    wizardError,
  } = useArServiceRequestStore();

  const [fileError, setFileError] = useState('');

  const handleFile = async (file) => {
    setFileError('');
    const err = await validateImage(file);
    if (err) return setFileError(err);
    const preview = URL.createObjectURL(file);
    updateWizardData({
      targetImageFile: file,
      targetImagePreview: preview,
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
      return setFileError(`Please select your ${assetNoun} image.`);
    }
    if (!wizardData.targetImageUrl) {
      const result = await uploadImage(wizardData.targetImageFile);
      if (!result.success) return;
    }
    setWizardStep(2);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Upload your {assetNoun} image</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Upload the photo of your {assetNoun} or print design. Our team will finish your holographic AR experience.
        </p>
        <p className="mt-2 flex items-start gap-2 rounded-lg border border-brand-500/20 bg-brand-500/5 px-3 py-2 text-xs text-[var(--text-secondary)]">
          <Clock size={14} className="mt-0.5 shrink-0 text-brand-400" />
          After you submit, our team configures your hologram within <strong className="text-[var(--text-primary)]">24 hours</strong>.
        </p>
      </div>

      <FileDropZone
        accept={ACCEPTED_TYPES}
        maxSizeMb={10}
        onFile={handleFile}
        onClear={handleClear}
        previewUrl={wizardData.targetImagePreview}
        label={`Drop your ${assetNoun} image here`}
        hint="JPG, PNG or WebP · min 300×200px"
        icon={ImageIcon}
      />

      {isUploading && <UploadProgress label="Uploading image…" progress={uploadProgress.image} />}
      {(fileError || wizardError) && (
        <p className="text-sm text-red-400">{fileError || wizardError}</p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleNext}
          disabled={isUploading}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-glow disabled:opacity-50"
        >
          {isUploading ? <Loader2 size={15} className="animate-spin" /> : null}
          Next: Place QR <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default ServiceStepImage;
