import { Layers, ScanLine } from 'lucide-react';

/**
 * Confirm turning Image target OFF — explains Android surface vs iPhone marker.
 */
const ImageTargetOffConfirmDialog = ({ open, onCancel, onConfirm, busy = false }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center"
      role="presentation"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-target-off-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="image-target-off-title"
          className="text-base font-semibold text-[var(--text-primary)]"
        >
          Turn off Image target?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          This changes how visitors launch AR on each platform:
        </p>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/12 text-violet-400">
              <Layers size={16} aria-hidden />
            </span>
            <span>
              <strong className="font-medium text-[var(--text-primary)]">Android:</strong>
              {' '}
              visitors place the hologram on a flat surface (WebXR). No printed marker scan required.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/12 text-brand-400">
              <ScanLine size={16} aria-hidden />
            </span>
            <span>
              <strong className="font-medium text-[var(--text-primary)]">iPhone:</strong>
              {' '}
              visitors still scan your printed marker. iOS surface placement is coming soon — for now
              iPhone uses image tracking.
            </span>
          </li>
        </ul>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-[44px] rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="min-h-[44px] rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Turn off for Android'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageTargetOffConfirmDialog;
