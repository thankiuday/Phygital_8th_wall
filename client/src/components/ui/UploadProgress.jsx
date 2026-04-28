import { motion, useReducedMotion } from 'framer-motion';
import { Cloud, CheckCircle2 } from 'lucide-react';

/**
 * UploadProgress — animated progress bar shown during Cloudinary upload.
 *
 * Honours prefers-reduced-motion: the bar still moves to the new width
 * (otherwise users wouldn't see progress) but the easing animation is
 * collapsed to an instant snap, and the cloud icon stops pulsing.
 */
const UploadProgress = ({ progress = 0, label = 'Uploading…' }) => {
  const done = progress >= 100;
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={done ? 'Upload complete' : `${label} ${progress}%`}
      className="flex flex-col gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-4"
    >
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          {done ? (
            <CheckCircle2 size={15} className="text-green-400" />
          ) : (
            <Cloud
              size={15}
              className={`text-brand-400 ${prefersReducedMotion ? '' : 'animate-pulse'}`}
            />
          )}
          {done ? 'Upload complete!' : label}
        </div>
        <span className="font-mono text-xs font-bold text-brand-400">{progress}%</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
        <motion.div
          className="h-full rounded-full bg-gradient-brand"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ ease: 'easeOut', duration: prefersReducedMotion ? 0 : 0.3 }}
        />
      </div>
    </div>
  );
};

export default UploadProgress;
