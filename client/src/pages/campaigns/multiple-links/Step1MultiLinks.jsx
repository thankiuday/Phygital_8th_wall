import { useState } from 'react';
import { ArrowRight, QrCode } from 'lucide-react';
import FormInput from '../../../components/ui/FormInput';
import MultiLinksEditor from './MultiLinksEditor';
import { validateLinkRows, rowsToApiLinkItems } from './multiLinkFormUtils';

const Step1MultiLinks = ({
  campaignName,
  onCampaignNameChange,
  onRegenerateName,
  linkRows,
  onLinkRowsChange,
  preciseGeoAnalytics,
  onPreciseGeoAnalyticsChange,
  onContinue,
}) => {
  const [nameError, setNameError] = useState('');
  const [linkError, setLinkError] = useState('');

  const handleContinue = () => {
    const trimmed = campaignName.trim();
    if (!trimmed) {
      setLinkError('');
      return setNameError('Campaign name is required');
    }
    if (trimmed.length > 100) {
      setLinkError('');
      return setNameError('Name cannot exceed 100 characters');
    }
    setNameError('');

    const err = validateLinkRows(linkRows);
    if (err) {
      setLinkError(err);
      return;
    }

    setLinkError('');
    onContinue({
      campaignName: trimmed,
      linkItems: rowsToApiLinkItems(linkRows),
      preciseGeoAnalytics,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
          <QrCode size={18} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Step 1: Enter your links
          </h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Name your campaign and add the destinations visitors will see on your link page.
          </p>
        </div>
      </div>

      <FormInput
        label="Campaign name"
        placeholder="e.g. Spring Launch Link Hub"
        value={campaignName}
        onChange={(e) => {
          if (nameError) setNameError('');
          onCampaignNameChange(e.target.value);
        }}
        error={nameError}
        maxLength={100}
        required
        hint={
          <button
            type="button"
            onClick={onRegenerateName}
            className="text-xs font-medium text-brand-400 hover:text-brand-300"
          >
            Regenerate name
          </button>
        }
      />

      <MultiLinksEditor
        rows={linkRows}
        onRowsChange={(next) => {
          setLinkError('');
          onLinkRowsChange(next);
        }}
        error={linkError}
      />

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-4">
        <input
          type="checkbox"
          checked={preciseGeoAnalytics}
          onChange={(e) => onPreciseGeoAnalyticsChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-[var(--border-color)]"
        />
        <div>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Precise location (optional)
          </span>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Ask visitors for browser location after scan for richer analytics (same as single-link QR).
          </p>
        </div>
      </label>

      {preciseGeoAnalytics && (
        <p className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-4 py-2 text-xs text-[var(--text-muted)]">
          Until you publish, the QR preview uses a temporary /open/… link. After publishing, your live link becomes
          {' '}
          <span className="text-[var(--text-secondary)]">/open/your-handle/your-campaign-slug</span>
          {' '}
          (a number suffix may be added if that path is already used).
        </p>
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={!campaignName.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-accent-600 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-95"
      >
        Continue to design
        <ArrowRight size={16} />
      </button>
    </div>
  );
};

export default Step1MultiLinks;
