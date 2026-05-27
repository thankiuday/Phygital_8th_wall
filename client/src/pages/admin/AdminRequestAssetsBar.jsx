import { useState } from 'react';
import { Download, Image as ImageIcon, Loader2, QrCode, Video } from 'lucide-react';
import {
  resolveRequestImageUrl,
  resolveRequestVideoUrl,
  downloadGreenscreenVideo,
} from '../../utils/arServiceRequestMedia';

/**
 * Sticky summary of user-submitted assets during admin fulfill wizard.
 */
const AdminRequestAssetsBar = ({ request }) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadErr, setDownloadErr] = useState('');
  const [imgFailed, setImgFailed] = useState(false);

  if (!request) return null;

  const imageUrl = resolveRequestImageUrl(request);
  const videoUrl = resolveRequestVideoUrl(request);

  const onDownload = async () => {
    setDownloadErr('');
    setDownloading(true);
    try {
      await downloadGreenscreenVideo(request);
    } catch (err) {
      setDownloadErr(err.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        User-submitted assets
      </p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {imageUrl && (
          <div className="shrink-0 sm:w-36">
            <p className="mb-1 flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <ImageIcon size={10} /> Card
            </p>
            {!imgFailed ? (
              <img
                src={imageUrl}
                alt="Card"
                className="h-24 w-full rounded-lg border border-[var(--border-color)] object-contain bg-[var(--surface-1)] sm:h-28"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <p className="text-[10px] text-[var(--text-muted)]">Image unavailable</p>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          {request.qrPlacement && (
            <p className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <QrCode size={12} />
              QR marker:{' '}
              {request.qrPlacement.preset
                ? request.qrPlacement.preset.replace(/-/g, ' ')
                : 'custom position'}
              {' — applied automatically on publish'}
            </p>
          )}
          {videoUrl && (
            <>
              <p className="mb-2 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                <Video size={12} /> Green-screen MP4 — download, convert to WebM + .mov, upload in Video step
              </p>
              <button
                type="button"
                onClick={onDownload}
                disabled={downloading}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Download green-screen MP4
              </button>
              {downloadErr && <p className="mt-1 text-xs text-red-400">{downloadErr}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminRequestAssetsBar;
