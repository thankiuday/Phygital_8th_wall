import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../../store/useAuthStore';
import useCampaignStore from '../../store/useCampaignStore';
import WizardStepBar from '../../components/ui/WizardStepBar';

// Steps
import Step1Name from './steps/Step1Name';
import Step2Image from './steps/Step2Image';
import Step3Video from './steps/Step3Video';
import Step4Review from './steps/Step4Review';

const STEPS = [
  { number: 1, shortLabel: 'Name',   label: 'Name' },
  { number: 2, shortLabel: 'Image',  label: 'Card Image' },
  { number: 3, shortLabel: 'Video',  label: 'Video' },
  { number: 4, shortLabel: 'Review', label: 'Review' },
];

const NewCampaignPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { wizardStep, resetWizard, updateWizardData } = useCampaignStore();

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

      <WizardStepBar steps={STEPS} currentStep={wizardStep} className="mb-8" />

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
