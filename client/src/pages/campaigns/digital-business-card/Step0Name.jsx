import React from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Step0Name — pre-step. The card needs a "name for the business card" the
 * user can later rename from the dashboard. We auto-generate something
 * unique on first mount to keep momentum, and let the user regenerate or
 * type their own. This is the only piece of data that's required before
 * the rest of the wizard can show meaningful previews.
 */
const Step0Name = ({
  campaignName,
  onCampaignNameChange,
  onRegenerateName,
  onContinue,
}) => {
  const trimmed = (campaignName || '').trim();
  const canContinue = trimmed.length >= 3 && trimmed.length <= 80;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Name your card</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          Just a label for your dashboard — your audience never sees this. You can rename it later.
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4">
        <label htmlFor="card-campaign-name" className="text-sm font-medium text-[var(--text-secondary)]">
          Card name
        </label>
        <div className="flex gap-2">
          <input
            id="card-campaign-name"
            type="text"
            value={campaignName}
            onChange={(e) => onCampaignNameChange(e.target.value)}
            className="form-input"
            placeholder="My Digital Business Card"
            maxLength={80}
            autoFocus
          />
          <button
            type="button"
            onClick={onRegenerateName}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
            title="Regenerate name"
          >
            <RefreshCw size={14} />
            New
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">3–80 characters.</p>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default Step0Name;
