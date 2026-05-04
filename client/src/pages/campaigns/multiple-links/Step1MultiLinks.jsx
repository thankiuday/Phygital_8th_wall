import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Phone,
  MessageCircle,
  AtSign,
  Users,
  Feather,
  Briefcase,
  Globe,
  Music2,
  Plus,
  Trash2,
  QrCode,
} from 'lucide-react';
import FormInput from '../../../components/ui/FormInput';

const PRESETS = [
  { kind: 'contact', label: 'Contact Number', Icon: Phone },
  { kind: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
  { kind: 'instagram', label: 'Instagram', Icon: AtSign },
  { kind: 'facebook', label: 'Facebook', Icon: Users },
  { kind: 'twitter', label: 'Twitter / X', Icon: Feather },
  { kind: 'linkedin', label: 'LinkedIn', Icon: Briefcase },
  { kind: 'website', label: 'Website', Icon: Globe },
  { kind: 'tiktok', label: 'TikTok', Icon: Music2 },
];

let rowKey = 0;
const nextKey = () => `row-${++rowKey}`;

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

  const kindsInUse = useMemo(() => new Set(linkRows.map((r) => r.kind)), [linkRows]);

  const addPreset = (preset) => {
    if (preset.kind !== 'custom' && kindsInUse.has(preset.kind)) return;
    onLinkRowsChange([
      ...linkRows,
      { key: nextKey(), kind: preset.kind, label: preset.label, value: '' },
    ]);
  };

  const addCustom = () => {
    onLinkRowsChange([
      ...linkRows,
      { key: nextKey(), kind: 'custom', label: '', value: '' },
    ]);
  };

  const updateRow = (key, patch) => {
    onLinkRowsChange(
      linkRows.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  };

  const removeRow = (key) => {
    onLinkRowsChange(linkRows.filter((r) => r.key !== key));
  };

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

    if (linkRows.length === 0) {
      return setLinkError('Add at least one link to continue.');
    }

    for (const row of linkRows) {
      if (!row.value.trim()) {
        return setLinkError(`Enter a value for “${row.label || row.kind}”.`);
      }
      if (row.kind === 'custom') {
        if (!row.label.trim()) return setLinkError('Each custom link needs a label.');
      }
    }

    const linkItems = linkRows.map((r) => ({
      kind: r.kind,
      label: (r.kind === 'custom' ? r.label.trim() : r.label).slice(0, 80),
      value: r.value.trim().slice(0, 500),
    }));

    setLinkError('');
    onContinue({
      campaignName: trimmed,
      linkItems,
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
        value={campaignName}
        onChange={(e) => onCampaignNameChange(e.target.value)}
        error={nameError}
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

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">Social links</p>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Tap a platform to add it. You can add one entry per preset type.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESETS.map(({ kind, label, Icon }) => {
            const active = kindsInUse.has(kind);
            return (
              <button
                key={kind}
                type="button"
                onClick={() => addPreset({ kind, label })}
                disabled={active}
                className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3 text-center transition-colors ${
                  active
                    ? 'cursor-not-allowed border-brand-500/40 bg-brand-500/10 text-brand-300'
                    : 'border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-brand-500/50 hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon size={20} className="shrink-0" />
                <span className="text-xs font-medium leading-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {linkError && (
        <p className="text-sm text-red-400" role="alert">
          {linkError}
        </p>
      )}

      {linkRows.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-[var(--text-primary)]">Your links</p>
          {linkRows.map((row) => (
            <div
              key={row.key}
              className="flex flex-col gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-3 sm:flex-row sm:items-end"
            >
              <div className="min-w-0 flex-1 space-y-2">
                {row.kind === 'custom' && (
                  <FormInput
                    label="Button label"
                    value={row.label}
                    onChange={(e) => updateRow(row.key, { label: e.target.value })}
                    placeholder="e.g. My portfolio"
                  />
                )}
                <FormInput
                  label={
                    row.kind === 'contact'
                      ? 'Phone number'
                      : row.kind === 'whatsapp'
                        ? 'WhatsApp number'
                        : row.kind === 'website' || row.kind === 'custom'
                          ? 'URL'
                          : row.kind === 'linkedin'
                            ? 'Profile URL or handle'
                            : 'Username or URL'
                  }
                  value={row.value}
                  onChange={(e) => updateRow(row.key, { value: e.target.value })}
                  placeholder={
                    row.kind === 'instagram'
                      ? 'username'
                      : row.kind === 'website' || row.kind === 'custom'
                        ? 'https://…'
                        : ''
                  }
                />
                <p className="text-xs text-[var(--text-muted)]">{row.label}</p>
              </div>
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"
                aria-label="Remove link"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addCustom}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-color)] py-3 text-sm font-medium text-[var(--text-secondary)] hover:border-brand-500/50 hover:text-brand-400"
      >
        <Plus size={16} />
        Add custom link
      </button>

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

      <button
        type="button"
        onClick={handleContinue}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-accent-600 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-95"
      >
        Continue to design
        <ArrowRight size={16} />
      </button>
    </div>
  );
};

export default Step1MultiLinks;
