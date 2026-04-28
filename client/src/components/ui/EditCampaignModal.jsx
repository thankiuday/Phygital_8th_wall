import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Check } from 'lucide-react';

/**
 * EditCampaignModal — inline modal to rename a campaign and toggle its status.
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
    if (trimmed.length > 80) { setError('Name must be 80 characters or fewer.'); return; }

    setSaving(true);
    setError('');

    const updates = {};
    if (trimmed !== campaign.campaignName) updates.campaignName = trimmed;
    if (status !== campaign.status)       updates.status = status;

    if (Object.keys(updates).length === 0) { onClose(); return; }

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
          className="flex max-h-[min(100dvh-2rem,42rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--surface-solid)] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
            <h2 id="edit-campaign-title" className="text-base font-semibold text-[var(--text-primary)]">Edit Campaign</h2>
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
            className="flex-1 space-y-5 overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-5"
          >
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
                maxLength={80}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                placeholder="My AR Card"
              />
              <p className="text-right text-xs text-[var(--text-muted)]">{name.length}/80</p>
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

            {/* Error */}
            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2.5 pt-1">
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
