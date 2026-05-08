import React from 'react';
import {
  CARD_TEMPLATES,
  CARD_FONTS,
  CARD_LAYOUTS,
  CARD_CORNERS,
  CARD_SPACING,
} from '../../../components/card/cardTemplates';

const ColorRow = ({ label, value, onChange }) => (
  <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] px-3 py-2">
    <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-10 cursor-pointer rounded" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="form-input w-24 text-xs"
        maxLength={7}
      />
    </div>
  </label>
);

const Pill = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full border px-3 py-1 text-xs transition ${
      active
        ? 'border-brand-500 bg-brand-500/15 text-brand-300'
        : 'border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-brand-500/40'
    }`}
  >
    {label}
  </button>
);

const Step2Design = ({ draft, store, onContinue, onBack }) => {
  const d = draft.cardDesign;

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Design</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          Pick a template, then tweak colors, fonts, layout, and spacing. Changes update the preview live.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-[var(--border-color)] p-4">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Template</h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CARD_TEMPLATES.map((tpl) => {
            const active = d.template === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => store.applyTemplate(tpl.id)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  active ? 'border-brand-500 bg-brand-500/10' : 'border-[var(--border-color)] hover:border-brand-500/40'
                }`}
                title={tpl.accent}
              >
                <div
                  className="h-8 w-8 shrink-0 rounded-md"
                  style={{ background: `linear-gradient(135deg, ${tpl.colors.primary}, ${tpl.colors.secondary})` }}
                />
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{tpl.label}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    {tpl.font}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-[var(--border-color)] p-4 sm:grid-cols-3">
        <ColorRow label="Primary" value={d.colors?.primary || '#3b82f6'} onChange={(v) => store.patchDesign({ colors: { ...d.colors, primary: v } })} />
        <ColorRow label="Secondary" value={d.colors?.secondary || '#1d4ed8'} onChange={(v) => store.patchDesign({ colors: { ...d.colors, secondary: v } })} />
        <ColorRow label="Background" value={d.colors?.background || '#030712'} onChange={(v) => store.patchDesign({ colors: { ...d.colors, background: v } })} />
      </section>

      <section className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-[var(--border-color)] p-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Font</h4>
          <div className="flex flex-wrap gap-2">
            {CARD_FONTS.map((f) => (
              <Pill key={f} active={d.font === f} label={f} onClick={() => store.patchDesign({ font: f })} />
            ))}
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Layout</h4>
          <div className="flex flex-wrap gap-2">
            {CARD_LAYOUTS.map((l) => (
              <Pill key={l} active={d.layout === l} label={l.replace('-', ' ')} onClick={() => store.patchDesign({ layout: l })} />
            ))}
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Corners</h4>
          <div className="flex flex-wrap gap-2">
            {CARD_CORNERS.map((c) => (
              <Pill key={c} active={d.corners === c} label={c} onClick={() => store.patchDesign({ corners: c })} />
            ))}
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Spacing</h4>
          <div className="flex flex-wrap gap-2">
            {CARD_SPACING.map((s) => (
              <Pill key={s} active={d.spacing === s} label={s} onClick={() => store.patchDesign({ spacing: s })} />
            ))}
          </div>
        </div>
      </section>

      <div className="mt-8 flex items-center justify-between">
        <button type="button" onClick={onBack} className="rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)]">Back</button>
        <button type="button" onClick={onContinue} className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:bg-brand-400">Continue to Publish</button>
      </div>
    </div>
  );
};

export default Step2Design;
