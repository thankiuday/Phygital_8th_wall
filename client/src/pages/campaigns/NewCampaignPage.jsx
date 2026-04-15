import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import useCampaignStore from '../../store/useCampaignStore';

// Steps
import Step1Name from './steps/Step1Name';
import Step2Image from './steps/Step2Image';
import Step3Video from './steps/Step3Video';
import Step4Review from './steps/Step4Review';

/* ── Step metadata ───────────────────────────────────────────────── */
const STEPS = [
  { number: 1, label: 'Name' },
  { number: 2, label: 'Card Image' },
  { number: 3, label: 'Video' },
  { number: 4, label: 'Review' },
];

/* ── Step indicator node ─────────────────────────────────────────── */
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
        className={`hidden text-xs font-medium sm:block ${
          active ? 'text-brand-400' : done ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'
        }`}
      >
        {step.label}
      </span>
    </div>
  );
};

/* ── Connector line between steps ───────────────────────────────── */
const StepConnector = ({ filled }) => (
  <div className="mb-4 h-0.5 flex-1 rounded-full transition-all duration-500 sm:mb-5"
    style={{ background: filled ? 'var(--brand)' : 'var(--border-color)' }}
  />
);

/* ── Main wizard page ────────────────────────────────────────────── */
const NewCampaignPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { wizardStep, wizardData, resetWizard, updateWizardData } = useCampaignStore();

  // Auto-seed campaign name from username on first load
  useEffect(() => {
    resetWizard();
    if (user?.name) {
      const firstName = user.name.split(' ')[0];
      updateWizardData({ campaignName: `${firstName}'s AR Card` });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stepComponents = [
    <Step1Name key={1} />,
    <Step2Image key={2} />,
    <Step3Video key={3} />,
    <Step4Review key={4} onSuccess={(campaign) => navigate(`/dashboard/campaigns`)} />,
  ];

  return (
    <div className="mx-auto max-w-2xl">
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Create AR Campaign</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Upload your business card + video. Your holographic AR experience will be live in minutes.
        </p>
      </div>

      {/* ── Step indicator ──────────────────────────────────────── */}
      <div className="mb-8 flex items-center">
        {STEPS.map((step, idx) => (
          <div key={step.number} className="flex flex-1 items-center">
            <StepNode step={step} currentStep={wizardStep} />
            {idx < STEPS.length - 1 && (
              <StepConnector filled={wizardStep > step.number} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step content — animated slide ───────────────────────── */}
      <div className="glass-card p-6 md:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={wizardStep}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {stepComponents[wizardStep - 1]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default NewCampaignPage;
