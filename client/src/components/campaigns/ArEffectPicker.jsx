import { Check } from 'lucide-react';
import { AR_EFFECT_OPTIONS } from '../../constants/arEffects';

/** CSS-only animated preview swatch per effect (no images, cheap to render). */
const EffectSwatch = ({ effect }) => (
  <div className="relative h-14 w-full overflow-hidden rounded-lg bg-[#060d18]">
    {effect === 'none' && (
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white/30">
        No effect
      </span>
    )}
    {effect === 'portal-rings' && (
      <>
        <span className="ar-fx-ring absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-400/70" />
        <span className="ar-fx-ring absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/60 [animation-direction:reverse]" />
      </>
    )}
    {effect === 'light-pillar' && (
      <>
        <span className="absolute bottom-1 left-1/2 h-1.5 w-8 -translate-x-1/2 rounded-full bg-cyan-400/50 blur-[2px]" />
        <span className="ar-fx-pillar absolute bottom-1 left-1/2 h-11 w-4 -translate-x-1/2 rounded-t-full bg-gradient-to-t from-cyan-400/60 to-transparent" />
      </>
    )}
    {effect === 'sparkles' && (
      <>
        <span className="absolute bottom-1 left-1/2 h-1.5 w-8 -translate-x-1/2 rounded-full bg-cyan-400/40 blur-[2px]" />
        <span className="ar-fx-spark absolute bottom-1 left-[38%] h-1 w-1 rounded-full bg-cyan-200" />
        <span className="ar-fx-spark absolute bottom-1 left-1/2 h-1 w-1 rounded-full bg-cyan-100 [animation-delay:0.5s]" />
        <span className="ar-fx-spark absolute bottom-1 left-[62%] h-1 w-1 rounded-full bg-cyan-200 [animation-delay:1s]" />
      </>
    )}
    {effect === 'energy-spiral' && (
      <>
        <span className="ar-fx-ring-x absolute bottom-1.5 left-1/2 h-2.5 w-9 -translate-x-1/2 rounded-[50%] border border-cyan-400/70" />
        <span className="ar-fx-ring-x absolute bottom-5 left-1/2 h-2 w-6 -translate-x-1/2 rounded-[50%] border border-cyan-300/50 [animation-delay:0.4s]" />
        <span className="ar-fx-ring-x absolute bottom-8 left-1/2 h-1.5 w-4 -translate-x-1/2 rounded-[50%] border border-cyan-200/40 [animation-delay:0.8s]" />
      </>
    )}
    {effect === 'pulse-glow' && (
      <>
        <span className="absolute bottom-1 left-1/2 h-2 w-9 -translate-x-1/2 rounded-full bg-cyan-400/60 blur-[3px]" />
        <span className="ar-fx-wave absolute bottom-0.5 left-1/2 h-3 w-6 -translate-x-1/2 rounded-[50%] border border-cyan-300/80" />
      </>
    )}
  </div>
);

/**
 * Grid of selectable hologram base effects for AR campaigns.
 */
const ArEffectPicker = ({ value = 'none', onChange }) => (
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
    {AR_EFFECT_OPTIONS.map((opt) => {
      const selected = value === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={selected}
          title={opt.description}
          className={`relative flex flex-col gap-1.5 rounded-xl border p-2 text-left transition ${
            selected
              ? 'border-brand-500/60 bg-brand-500/10 ring-1 ring-brand-500/30'
              : 'border-[var(--border-color)] bg-[var(--surface-2)] hover:border-[var(--border-color-hover)]'
          }`}
        >
          <EffectSwatch effect={opt.value} />
          <span className="flex items-center gap-1 text-xs font-medium text-[var(--text-primary)]">
            {selected && <Check size={12} className="shrink-0 text-brand-400" />}
            {opt.label}
          </span>
        </button>
      );
    })}
  </div>
);

export default ArEffectPicker;
