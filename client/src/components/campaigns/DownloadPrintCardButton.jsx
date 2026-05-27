import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { downloadCompositedCardImage } from '../../utils/downloadCampaignCardImage';
import { isArMediaType, getArMediaProduct } from '../../constants/arMediaProducts';

/**
 * Download print-ready marker PNG (with composited QR) for AR media campaigns.
 */
const DownloadPrintCardButton = ({
  campaign,
  className = '',
  variant = 'primary',
  onAfterClick,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!isArMediaType(campaign?.campaignType) || !campaign?.targetImageUrl) {
    return null;
  }

  const product = getArMediaProduct(campaign.campaignType);
  const downloadLabel = `Download ${product.printAssetLabel} (with QR)`;

  const onDownload = async () => {
    setError('');
    setBusy(true);
    try {
      await downloadCompositedCardImage(campaign);
      onAfterClick?.();
    } catch (err) {
      setError(err.message || 'Download failed');
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'menu') {
    return (
      <>
        <button
          type="button"
          onClick={onDownload}
          disabled={busy}
          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-3)] disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {downloadLabel}
        </button>
        {error && <p className="px-4 pb-2 text-xs text-red-400">{error}</p>}
      </>
    );
  }

  const base =
    variant === 'secondary'
      ? 'border border-[var(--border-color)] bg-transparent text-[var(--text-secondary)] hover:border-brand-500/50 hover:text-brand-400'
      : 'bg-brand-600 text-white hover:bg-brand-500';

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onDownload}
        disabled={busy}
        className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${base}`}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        {downloadLabel}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
};

export default DownloadPrintCardButton;
