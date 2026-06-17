import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { campaignService } from '../../services/campaignService';
import useAuthStore from '../../store/useAuthStore';
import { resolveCardImageUrl } from '../../utils/assetUrl';

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Optional circular logo upload for custom link rows.
 */
const LinkLogoUpload = ({ row, onChange }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const previewSrc = resolveCardImageUrl(row.logoPreview, row.logoUrl);

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be 2 MB or smaller.');
      return;
    }

    const objectURL = URL.createObjectURL(file);
    onChange({ logoPreview: objectURL });
    setUploading(true);
    try {
      const up = await campaignService.uploadToCloudinary(file, 'image', undefined, {
        draft: !isAuthenticated,
      });
      onChange({
        logoPreview: null,
        logoUrl: up.url,
        logoPublicId: up.publicId,
      });
    } catch {
      setError('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const clearLogo = () => {
    onChange({ logoUrl: null, logoPublicId: null, logoPreview: null });
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-[var(--text-secondary)]">Link icon (optional)</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-color)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:border-brand-500/50"
          aria-label={previewSrc ? 'Change link icon' : 'Upload link icon'}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : previewSrc ? (
            <img src={previewSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-4 w-4" aria-hidden />
          )}
        </button>
        {previewSrc && !uploading && (
          <button
            type="button"
            onClick={clearLogo}
            className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-red-400"
          >
            <X size={14} aria-hidden />
            Remove
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>
      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default LinkLogoUpload;
