import React from 'react';
import {
  CARD_TEMPLATES,
  CARD_FONTS,
  CARD_LAYOUTS,
  CARD_CORNERS,
  CARD_SPACING,
} from '../../../components/card/cardTemplates';

const ColorRow = ({ label, value, onChange }) => (
  <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)]/55 px-3 py-2.5">
    <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="form-input h-10 w-12 cursor-pointer p-1" />
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
    className={`rounded-full border px-3 py-1.5 text-xs transition ${
      active
        ? 'border-brand-500 bg-brand-500/15 text-brand-300 shadow-glow'
        : 'border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-brand-500/40 hover:text-[var(--text-primary)]'
    }`}
  >
    {label}
  </button>
);

const Step2Design = ({ draft, store, onContinue, onBack }) => {
  const d = draft.cardDesign;

  return (
    <div className="min-w-0 overflow-x-hidden">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Design</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          Pick a template, then tweak colors, fonts, layout, and spacing. Changes update the preview live.
        </p>
      </div>

      <section className="wizard-section space-y-3">
        <h4 className="wizard-section-title">Template</h4>
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

      <section className="wizard-section mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ColorRow label="Primary" value={d.colors?.primary || '#3b82f6'} onChange={(v) => store.patchDesign({ colors: { ...d.colors, primary: v } })} />
        <ColorRow label="Secondary" value={d.colors?.secondary || '#1d4ed8'} onChange={(v) => store.patchDesign({ colors: { ...d.colors, secondary: v } })} />
        <ColorRow label="Background" value={d.colors?.background || '#030712'} onChange={(v) => store.patchDesign({ colors: { ...d.colors, background: v } })} />
      </section>

      <section className="wizard-section mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <button type="button" onClick={onBack} className="wizard-btn-secondary">Back</button>
        <button type="button" onClick={onContinue} className="wizard-btn-primary">Continue to Publish</button>
      </div>
    </div>
  );
};

export default Step2Design;
