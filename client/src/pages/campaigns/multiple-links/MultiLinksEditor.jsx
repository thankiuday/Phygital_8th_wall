import { useMemo } from 'react';
import {
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
} from 'lucide-react';
import FormInput from '../../../components/ui/FormInput';
import { newRowKey } from './multiLinkFormUtils';

export const MULTI_LINK_PRESETS = [
  { kind: 'contact', label: 'Contact Number', Icon: Phone },
  { kind: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
  { kind: 'instagram', label: 'Instagram', Icon: AtSign },
  { kind: 'facebook', label: 'Facebook', Icon: Users },
  { kind: 'twitter', label: 'Twitter / X', Icon: Feather },
  { kind: 'linkedin', label: 'LinkedIn', Icon: Briefcase },
  { kind: 'website', label: 'Website', Icon: Globe },
  { kind: 'tiktok', label: 'TikTok', Icon: Music2 },
];

/**
 * Link list UI — presets, per-row fields, add custom. Controlled via rows / onRowsChange.
 *
 * Row shape: { key, linkId?, kind, label, value }
 */
const MultiLinksEditor = ({ rows, onRowsChange, error }) => {
  const kindsInUse = useMemo(() => new Set(rows.map((r) => r.kind)), [rows]);

  const addPreset = (preset) => {
    if (preset.kind !== 'custom' && kindsInUse.has(preset.kind)) return;
    onRowsChange([
      ...rows,
      { key: newRowKey(), kind: preset.kind, label: preset.label, value: '' },
    ]);
  };

  const addCustom = () => {
    onRowsChange([
      ...rows,
      { key: newRowKey(), kind: 'custom', label: '', value: '' },
    ]);
  };

  const updateRow = (key, patch) => {
    onRowsChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeRow = (key) => {
    onRowsChange(rows.filter((r) => r.key !== key));
  };

  const valuePlaceholderForKind = (kind) => {
    if (kind === 'contact') return '+1 555 123 4567';
    if (kind === 'whatsapp') return '+91 98765 43210';
    if (kind === 'instagram') return '@yourhandle or https://instagram.com/yourhandle';
    if (kind === 'facebook') return 'https://facebook.com/yourpage';
    if (kind === 'twitter') return '@yourhandle or https://x.com/yourhandle';
    if (kind === 'linkedin') return 'https://linkedin.com/in/yourprofile';
    if (kind === 'website') return 'https://example.com';
    if (kind === 'tiktok') return '@yourhandle or https://tiktok.com/@yourhandle';
    return 'https://example.com';
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">Social links</p>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Tap a platform to add it. You can add one entry per preset type.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MULTI_LINK_PRESETS.map(({ kind, label, Icon }) => {
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

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {rows.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-[var(--text-primary)]">Your links</p>
          {rows.map((row) => (
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
                    row.kind === 'website' || row.kind === 'custom'
                      ? 'https://example.com'
                      : valuePlaceholderForKind(row.kind)
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
    </div>
  );
};

export default MultiLinksEditor;
