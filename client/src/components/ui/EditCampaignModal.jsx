import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Check } from 'lucide-react';
import MultiLinksEditor from '../../pages/campaigns/multiple-links/MultiLinksEditor';
import {
  campaignLinkItemsToRows,
  validateLinkRows,
  rowsToApiLinkItems,
} from '../../pages/campaigns/multiple-links/multiLinkFormUtils';

/**
 * EditCampaignModal — inline modal to rename a campaign, toggle status, and
 * for multiple-links-qr / links-video-qr: edit hub links + precise geo.
 *
 * Props:
 *   campaign    {object}    Campaign document to edit
 *   onSave      {function}  (id, updates) => Promise<{ success, message? }>
 *   onClose     {function}  Close the modal
 */
const EditCampaignModal = ({ campaign, onSave, onClose }) => {
  const [name, setName]       = useState(campaign.campaignName);
  const [status, setStatus]   = useState(campaign.status);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const inputRef              = useRef(null);

  const hasLinkItems =
    campaign.campaignType === 'multiple-links-qr'
    || campaign.campaignType === 'links-video-qr'
    || campaign.campaignType === 'links-doc-video-qr';
  const [linkRows, setLinkRows] = useState(() =>
    hasLinkItems ? campaignLinkItemsToRows(campaign.linkItems) : []
  );
  const [linkError, setLinkError] = useState('');
  const [preciseGeo, setPreciseGeo] = useState(!!campaign.preciseGeoAnalytics);

  useEffect(() => {
    setName(campaign.campaignName);
    setStatus(campaign.status);
    setError('');
    setLinkError('');
    if (
      campaign.campaignType === 'multiple-links-qr'
      || campaign.campaignType === 'links-video-qr'
      || campaign.campaignType === 'links-doc-video-qr'
    ) {
      setLinkRows(campaignLinkItemsToRows(campaign.linkItems));
      setPreciseGeo(!!campaign.preciseGeoAnalytics);
    } else {
      setLinkRows([]);
    }
  }, [
    campaign._id,
    campaign.campaignName,
    campaign.status,
    campaign.campaignType,
    campaign.linkItems,
    campaign.preciseGeoAnalytics,
  ]);

  // Auto-focus and select-all on open
  useEffect(() => {
    inputRef.current?.select();
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Campaign name cannot be empty.'); return; }
    if (trimmed.length > 100) { setError('Name must be 100 characters or fewer.'); return; }

    if (hasLinkItems) {
      const lerr = validateLinkRows(linkRows);
      if (lerr) {
        setLinkError(lerr);
        return;
      }
    }

    setSaving(true);
    setError('');
    setLinkError('');

    const updates = {};
    if (trimmed !== campaign.campaignName) updates.campaignName = trimmed;
    if (status !== campaign.status)       updates.status = status;

    if (hasLinkItems) {
      updates.linkItems = rowsToApiLinkItems(linkRows);
      if (preciseGeo !== !!campaign.preciseGeoAnalytics) {
        updates.preciseGeoAnalytics = preciseGeo;
      }
    }

    if (Object.keys(updates).length === 0) {
      setSaving(false);
      onClose();
      return;
    }

    const result = await onSave(campaign._id, updates);
    setSaving(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.message || 'Save failed. Please try again.');
    }
  };

  const STATUS_OPTIONS = [
    { value: 'active', label: 'Active', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
    { value: 'paused', label: 'Paused', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  ];

  const panelMaxW = hasLinkItems ? 'max-w-lg' : 'max-w-md';

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center"
        onClick={onClose}
      >
        {/* Panel — capped to viewport height with internal scroll so the
            Save button stays reachable when the keyboard is up on phones. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-campaign-title"
          className={`flex max-h-[min(100dvh-2rem,46rem)] w-full ${panelMaxW} flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--surface-solid)] shadow-2xl`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
            <h2 id="edit-campaign-title" className="text-base font-semibold text-[var(--text-primary)]">
              {hasLinkItems ? 'Edit campaign & links' : 'Edit Campaign'}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
            >
              <X size={18} />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 space-y-5 overflow-y-auto px-6 pt-5">
              {/* Campaign name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[var(--text-secondary)]">
                  Campaign Name
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(''); }}
                  maxLength={100}
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                  placeholder="My AR Card"
                />
                <p className="text-right text-xs text-[var(--text-muted)]">{name.length}/100</p>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[var(--text-secondary)]">Status</label>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatus(opt.value)}
                      className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border py-2 text-sm font-semibold transition-all ${
                        status === opt.value
                          ? `${opt.bg} ${opt.color}`
                          : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--border-color-hover)]'
                      }`}
                    >
                      {status === opt.value && <Check size={14} />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {hasLinkItems && (
                <>
                  <div className="border-t border-[var(--border-color)] pt-5">
                    <p className="mb-3 text-xs font-medium text-[var(--text-secondary)]">
                      Hub links — edit, remove, or add destinations. Saved links keep their analytics IDs when possible.
                    </p>
                    <MultiLinksEditor
                      rows={linkRows}
                      onRowsChange={(next) => {
                        setLinkError('');
                        setLinkRows(next);
                      }}
                      error={linkError}
                    />
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-4">
                    <input
                      type="checkbox"
                      checked={preciseGeo}
                      onChange={(e) => setPreciseGeo(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-[var(--border-color)]"
                    />
                    <div>
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        Precise location (optional)
                      </span>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        QR targets the location bridge so visitors can opt in to GPS for analytics.
                      </p>
                    </div>
                  </label>
                </>
              )}

              {/* Error */}
              {error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex shrink-0 gap-2.5 border-t border-[var(--border-color)] px-6 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-[var(--border-color)] py-2.5 text-sm font-semibold text-[var(--text-muted)] transition-colors hover:border-[var(--border-color-hover)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-500 disabled:opacity-60"
              >
                {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save Changes'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EditCampaignModal;
