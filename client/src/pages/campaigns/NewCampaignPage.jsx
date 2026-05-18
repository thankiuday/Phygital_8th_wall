import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../../store/useAuthStore';
import useCampaignStore from '../../store/useCampaignStore';
import WizardStepBar from '../../components/ui/WizardStepBar';
import { suggestArCampaignName } from '../../utils/suggestArCampaignName';

import Step1Name from './steps/Step1Name';
import Step2Image from './steps/Step2Image';
import Step3QrPlacement from './steps/Step3QrPlacement';
import Step3Video from './steps/Step3Video';
import Step5SocialLinks from './steps/Step5SocialLinks';
import Step4Review from './steps/Step4Review';

const STEPS = [
  { number: 1, shortLabel: 'Name',   label: 'Name' },
  { number: 2, shortLabel: 'Image',  label: 'Card Image' },
  { number: 3, shortLabel: 'QR',     label: 'Place QR' },
  { number: 4, shortLabel: 'Video',  label: 'Video' },
  { number: 5, shortLabel: 'Links',  label: 'Social Links' },
  { number: 6, shortLabel: 'Review', label: 'Review' },
];

const NewCampaignPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { wizardStep, resetWizard, updateWizardData } = useCampaignStore();

  useEffect(() => {
    resetWizard();
  }, [resetWizard]);

  useEffect(() => {
    if (!user) return;
    const { wizardData } = useCampaignStore.getState();
    if (wizardData.campaignName?.trim()) return;
    updateWizardData({ campaignName: suggestArCampaignName(user) });
  }, [user, updateWizardData]);

  const stepComponents = [
    <Step1Name key={1} />,
    <Step2Image key={2} />,
    <Step3QrPlacement key={3} />,
    <Step3Video key={4} />,
    <Step5SocialLinks key={5} />,
    <Step4Review key={6} onSuccess={() => navigate('/dashboard/campaigns')} />,
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Create AR Campaign</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Upload your card, place a QR, add video and links. Your holographic AR experience goes live on Review.
        </p>
      </div>

      <WizardStepBar steps={STEPS} currentStep={wizardStep} className="mb-8" />

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
