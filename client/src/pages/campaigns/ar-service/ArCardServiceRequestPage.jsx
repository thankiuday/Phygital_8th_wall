import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import WizardStepBar from '../../../components/ui/WizardStepBar';
import useArServiceRequestStore from '../../../store/useArServiceRequestStore';
import { getArMediaProduct } from '../../../constants/arMediaProducts';
import ServiceStepImage from './steps/ServiceStepImage';
import ServiceStepQrPlacement from './steps/ServiceStepQrPlacement';
import ServiceStepVideoLinks from './steps/ServiceStepVideoLinks';
import ServiceStepSubmit from './steps/ServiceStepSubmit';

const ArCardServiceRequestPage = ({ productKey = 'ar-card' }) => {
  const navigate = useNavigate();
  const product = getArMediaProduct(productKey);
  const { wizardStep, resetWizard, setRequestKind } = useArServiceRequestStore();

  const steps = useMemo(
    () => [
      { number: 1, shortLabel: 'Image', label: product.imageStepLabel },
      { number: 2, shortLabel: 'QR', label: product.qrStepLabel },
      { number: 3, shortLabel: 'Video', label: 'Video & Links' },
      { number: 4, shortLabel: 'Submit', label: 'Submit' },
    ],
    [product.imageStepLabel, product.qrStepLabel]
  );

  useEffect(() => {
    setRequestKind(product.requestKind);
    resetWizard();
  }, [product.requestKind, resetWizard, setRequestKind]);

  const stepComponents = [
    <ServiceStepImage key={1} product={product} />,
    <ServiceStepQrPlacement key={2} product={product} />,
    <ServiceStepVideoLinks key={3} product={product} />,
    <ServiceStepSubmit key={4} product={product} onDone={() => navigate('/dashboard/campaigns', { state: { tab: 'ar-requests' } })} />,
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">{product.slaTitle}</h2>
        <p className="text-sm text-[var(--text-secondary)]">{product.slaDescription}</p>
      </div>

      <WizardStepBar steps={steps} currentStep={wizardStep} className="mb-8" />

      <div className="glass-card p-6 md:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={wizardStep}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
          >
            {stepComponents[wizardStep - 1]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ArCardServiceRequestPage;
