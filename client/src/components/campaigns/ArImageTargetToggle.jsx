import { useState } from 'react';
import { Layers, ScanLine } from 'lucide-react';

/**
 * Toggle for AR campaigns: image marker required vs surface-only placement.
 *
 * @param {boolean} value — true = requires printed image target
 * @param {(next: boolean) => void | Promise<void>} onChange
 * @param {boolean} [disabled]
 * @param {boolean} [canDisableImageTarget] — false when no targetImageUrl (surface off blocked)
 * @param {'card' | 'settings'} [variant]
 */
const ArImageTargetToggle = ({
  value,
  onChange,
  disabled = false,
  canDisableImageTarget = true,
  variant = 'card',
}) => {
  const [busy, setBusy] = useState(false);
  const on = value !== false;
  const surfaceOffBlocked = on && !canDisableImageTarget;

  const handleToggle = async (e) => {
    e.stopPropagation();
    if (disabled || busy) return;
    const next = !on;
    if (next === false && !canDisableImageTarget) return;
    setBusy(true);
    try {
      await onChange(next);
    } finally {
      setBusy(false);
    }
  };

  const Icon = on ? ScanLine : Layers;
  const helper = on
    ? (surfaceOffBlocked ? 'Marker required for iPhone' : 'Required')
    : 'Surface on Android';

  const offDescription =
    'Android: place on a flat surface with no printed marker. iPhone: scans your printed marker.';

  if (variant === 'settings') {
    return (
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)]/60 p-3.5">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/12 text-brand-400">
          <Icon size={18} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--text-primary)]">Image target required</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
            {on
              ? 'Visitors must point their camera at your printed card or poster before the hologram plays.'
              : offDescription}
          </p>
          {surfaceOffBlocked && (
            <p className="mt-1.5 text-xs leading-relaxed text-amber-300/90">
              Upload a print marker before you can turn this off — iPhone still uses image tracking.
            </p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={on ? 'Image target required' : 'Surface mode only'}
          disabled={disabled || busy || surfaceOffBlocked}
          onClick={handleToggle}
          className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
            on
              ? 'border-brand-500/50 bg-brand-500/30'
              : 'border-[var(--border-color)] bg-[var(--surface-3)]'
          } ${disabled || busy || surfaceOffBlocked ? 'opacity-50' : ''}`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
              on ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </label>
    );
  }

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-color)]/80 bg-[var(--surface-2)]/50 px-3 py-2.5"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-500/10 text-brand-400">
          <Icon size={14} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--text-primary)]">Image target</p>
          <p className="text-[10px] text-[var(--text-muted)]">{helper}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={on ? 'Image target required' : 'Surface mode only'}
        disabled={disabled || busy || surfaceOffBlocked}
        onClick={handleToggle}
        className={`relative inline-flex h-7 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border px-1 transition-colors ${
          on
            ? 'border-brand-500/50 bg-brand-500/25'
            : 'border-[var(--border-color)] bg-[var(--surface-3)]'
        } ${disabled || busy || surfaceOffBlocked ? 'opacity-50' : ''}`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            on ? 'translate-x-2.5' : '-translate-x-2.5'
          }`}
        />
      </button>
    </div>
  );
};

export default ArImageTargetToggle;
