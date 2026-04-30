import { Check } from 'lucide-react';

/**
 * WizardStepBar — reusable step indicator used by every campaign wizard
 * (AR card, Single Link QR, future ones).
 *
 * Steps are described as `{ number, label, shortLabel }`.  `shortLabel` is
 * shown below 640 px so the bar never wraps; `label` is shown on sm+.
 *
 * Visual contract (matches the AR wizard's original look exactly):
 *   - 36 px circular nodes
 *   - Filled node when `currentStep > step.number` (done)
 *   - Highlighted ring when `currentStep === step.number` (active)
 *   - Hairline connector that turns brand-colored once the previous step is done
 */

const StepNode = ({ step, currentStep }) => {
  const done = currentStep > step.number;
  const active = currentStep === step.number;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300 ${
          done
            ? 'border-brand-500 bg-brand-500 text-white'
            : active
            ? 'border-brand-500 bg-brand-500/15 text-brand-400'
            : 'border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-muted)]'
        }`}
      >
        {done ? <Check size={14} /> : step.number}
      </div>
      <span
        className={`text-[11px] font-medium sm:text-xs ${
          active ? 'text-brand-400' : done ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'
        }`}
      >
        <span className="sm:hidden">{step.shortLabel || step.label}</span>
        <span className="hidden sm:inline">{step.label}</span>
      </span>
    </div>
  );
};

const StepConnector = ({ filled }) => (
  <div
    className="mb-7 h-0.5 flex-1 rounded-full transition-all duration-500 sm:mb-7"
    style={{ background: filled ? 'var(--brand)' : 'var(--border-color)' }}
  />
);

const WizardStepBar = ({ steps, currentStep, className = '' }) => (
  <div className={`flex items-center ${className}`}>
    {steps.map((step, idx) => (
      <div key={step.number} className="flex flex-1 items-center">
        <StepNode step={step} currentStep={currentStep} />
        {idx < steps.length - 1 && <StepConnector filled={currentStep > step.number} />}
      </div>
    ))}
  </div>
);

export default WizardStepBar;
