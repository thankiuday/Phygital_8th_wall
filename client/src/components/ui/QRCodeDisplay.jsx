import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Download, Share2, Copy, Check, Loader2, RefreshCw } from 'lucide-react';
import api from '../../services/api';

/**
 * QRCodeDisplay — renders the campaign QR code with download + share + copy-link actions.
 *
 * Polls GET /api/campaigns/:id/qr until the QR is ready (async generation may take ~2s).
 */
const QRCodeDisplay = ({ campaignId, campaignName, initialQrUrl = null, campaignActive = true }) => {
  const [qrUrl, setQrUrl] = useState(initialQrUrl);
  const [polling, setPolling] = useState(!initialQrUrl);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const arPageUrl = `${window.location.origin}/ar/${campaignId}`;

  /* ── Poll until QR is generated ───────────────────────────── */
  const fetchQR = useCallback(async () => {
    try {
      const res = await api.get(`/campaigns/${campaignId}/qr`);
      const { qrCodeUrl, ready } = res.data.data;
      if (ready && qrCodeUrl) {
        setQrUrl(qrCodeUrl);
        setPolling(false);
      }
    } catch {
      setError('Could not load QR code. Please refresh.');
      setPolling(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (qrUrl) return;
    let attempts = 0;
    const interval = setInterval(async () => {
      await fetchQR();
      attempts++;
      if (attempts >= 15) {  // give up after ~30s
        setPolling(false);
        setError('QR generation is taking longer than expected. Refresh to retry.');
        clearInterval(interval);
      }
    }, 2000);
    fetchQR(); // immediate first attempt
    return () => clearInterval(interval);
  }, [fetchQR, qrUrl]);

  /* ── Download QR as PNG ────────────────────────────────────── */
  const handleDownload = async () => {
    if (!qrUrl) return;
    const res = await fetch(qrUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${campaignName || 'qr-code'}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Copy AR link to clipboard ─────────────────────────────── */
  const handleCopy = async () => {
    await navigator.clipboard.writeText(arPageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Web Share API ─────────────────────────────────────────── */
  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: campaignName || 'AR Business Card',
        text: 'Scan this QR code to see my AR business card!',
        url: arPageUrl,
      });
    } else {
      handleCopy();
    }
  };

  return (
    <div className="flex flex-col items-center gap-5">
      {/* QR image container */}
      <div className="relative flex h-52 w-52 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-white p-3 shadow-[var(--shadow-md)]">
        {polling ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={32} className="animate-spin text-brand-500" />
            <p className="text-xs text-[var(--text-muted)]">Generating QR…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-center text-xs text-red-400">{error}</p>
            <button
              onClick={() => { setError(''); setPolling(true); fetchQR(); }}
              className="flex items-center gap-1 text-xs text-brand-400 hover:underline"
            >
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        ) : (
          <motion.img
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            src={qrUrl}
            alt={`QR code for ${campaignName}`}
            className="h-full w-full rounded-lg object-contain"
          />
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={handleDownload}
          disabled={!qrUrl}
          className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-brand-500/50 hover:text-brand-400 disabled:opacity-40"
        >
          <Download size={14} /> Download PNG
        </button>

        <button
          onClick={handleShare}
          disabled={!qrUrl}
          className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-brand-500/50 hover:text-brand-400 disabled:opacity-40"
        >
          <Share2 size={14} /> Share
        </button>
      </div>

      {/* Copy AR link */}
      <div className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2">
        <span className="flex-1 truncate text-xs text-[var(--text-muted)]">{arPageUrl}</span>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-3)]"
          aria-label="Copy link"
        >
          {copied ? (
            <Check size={14} className="text-green-400" />
          ) : (
            <Copy size={14} className="text-[var(--text-muted)]" />
          )}
        </button>
      </div>

      {!campaignActive && (
        <p className="text-center text-xs text-amber-500/90">
          Activate this campaign so the QR and link open the AR experience for everyone.
        </p>
      )}

      <p className="text-center text-xs text-[var(--text-muted)]">
        Print this QR on your business card or share the link. When scanned, it opens your AR experience instantly — no app download needed.
      </p>
    </div>
  );
};

export default QRCodeDisplay;
