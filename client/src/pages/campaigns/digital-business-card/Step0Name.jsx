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

      <div className="wizard-section space-y-3">
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
            className="wizard-btn-secondary px-3 text-xs"
            title="Regenerate name"
          >
            <RefreshCw size={14} />
            New
          </button>
        </div>
        <p className="wizard-subtext">3–80 characters.</p>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="wizard-btn-primary"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default Step0Name;
