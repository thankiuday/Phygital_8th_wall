import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, CheckCircle2 } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * FileDropZone — drag-and-drop + click-to-browse file input.
 * Used by Step 2 (image) and Step 3 (video).
 */
const FileDropZone = ({
  accept,           // MIME types string, e.g. "image/jpeg,image/png,image/webp"
  acceptLabel,      // Human label, e.g. "JPG, PNG, WebP"
  maxSizeMB = 50,
  onFile,           // callback(File)
  previewUrl,       // string | null — shows preview when set
  previewType = 'image', // 'image' | 'video'
  onClear,
  error,
  icon: Icon = Upload,
  hint,
}) => {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sizeError, setSizeError] = useState('');

  const validate = (file) => {
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setSizeError(`File too large. Maximum size is ${maxSizeMB} MB.`);
      return false;
    }
    setSizeError('');
    return true;
  };

  const handleFile = (file) => {
    if (!file) return;
    if (!validate(file)) return;
    onFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const displayError = error || sizeError;

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence mode="wait">
        {previewUrl ? (
          /* ── Preview state ─────────────────────────────────── */
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="relative overflow-hidden rounded-xl border border-brand-500/30 bg-[var(--surface-2)]"
          >
            {previewType === 'video' ? (
              <video
                src={previewUrl}
                controls
                className="max-h-72 w-full rounded-xl object-contain"
              />
            ) : (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-64 w-full rounded-xl object-contain"
              />
            )}

            {/* Overlay — file selected badge */}
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-green-500/90 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              <CheckCircle2 size={12} />
              File selected
            </div>

            {/* Clear button */}
            <button
              type="button"
              onClick={onClear}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-opacity hover:bg-black/80"
              aria-label="Remove file"
            >
              <X size={14} />
            </button>
          </motion.div>
        ) : (
          /* ── Drop zone ─────────────────────────────────────── */
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-all duration-200',
              isDragging
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-[var(--border-color)] bg-[var(--surface-2)] hover:border-brand-500/50 hover:bg-brand-500/5',
              displayError && 'border-red-500/50 bg-red-500/5'
            )}
          >
            <div className={cn(
              'flex h-14 w-14 items-center justify-center rounded-2xl transition-colors',
              isDragging ? 'bg-brand-500/20 text-brand-400' : 'bg-[var(--surface-3)] text-[var(--text-muted)]'
            )}>
              <Icon size={26} />
            </div>

            <div className="text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {isDragging ? 'Drop to upload' : 'Drop file here, or '}
                {!isDragging && (
                  <span className="text-brand-400 underline underline-offset-2">browse</span>
                )}
              </p>
              {hint && <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>}
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {acceptLabel} · Max {maxSizeMB} MB
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {displayError && (
        <p className="flex items-center gap-1 text-xs text-red-400">
          <X size={12} /> {displayError}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
};

export default FileDropZone;
