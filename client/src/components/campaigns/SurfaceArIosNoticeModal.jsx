import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone } from 'lucide-react';

/**
 * Lightweight modal for surface-AR iOS availability notices.
 */
const SurfaceArIosNoticeModal = ({ open, title, body, confirmLabel = 'Got it', onConfirm }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onConfirm?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onConfirm]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onConfirm}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="surface-ios-notice-title"
        className="w-full max-w-sm rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
          <Smartphone size={22} aria-hidden />
        </div>
        <h2 id="surface-ios-notice-title" className="text-base font-semibold text-[var(--text-primary)]">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{body}</p>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-5 w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
        >
          {confirmLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default SurfaceArIosNoticeModal;
