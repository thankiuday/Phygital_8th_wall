import { useState } from 'react';
import { ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { resolvePlaybackMediaUrl } from '../../utils/assetUrl';

/**
 * Portrait-friendly preview for the composited AR print marker (card/poster + QR).
 * Centers the image in a framed stage so business cards and posters display at
 * a readable size instead of being squashed into a short wide strip.
 */
const PrintCardPreview = ({ imageUrl, alt = 'Print-ready card with QR' }) => {
  const [status, setStatus] = useState('loading');
  const src = imageUrl ? resolvePlaybackMediaUrl(imageUrl) : null;

  if (!src) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--surface-2)] p-6 text-center">
        <p className="text-sm text-[var(--text-muted)]">No print image uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-[var(--border-color)] bg-gradient-to-b from-[var(--surface-3)] to-[var(--surface-2)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-4">
          <div className="relative flex min-h-[240px] items-center justify-center overflow-hidden rounded-xl bg-[#080d14] p-3 sm:min-h-[280px]">
            {status === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                <Loader2 size={22} className="animate-spin text-brand-400" />
                <span className="text-xs">Loading preview…</span>
              </div>
            )}
            {status === 'error' && (
              <div className="flex flex-col items-center gap-2 px-4 text-center text-[var(--text-muted)]">
                <AlertCircle size={22} className="text-amber-400" />
                <p className="text-sm">Could not load the print preview.</p>
                <p className="text-xs">Try refreshing, or download the file directly.</p>
              </div>
            )}
            <img
              src={src}
              alt={alt}
              className={`max-h-[min(28rem,62vh)] w-auto max-w-full object-contain transition-opacity duration-300 ${
                status === 'ok' ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setStatus('ok')}
              onError={() => setStatus('error')}
            />
          </div>
        </div>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-[var(--text-muted)]">
          <ImageIcon size={11} />
          Tap-friendly preview — download for full print resolution
        </p>
      </div>
    </div>
  );
};

export default PrintCardPreview;
