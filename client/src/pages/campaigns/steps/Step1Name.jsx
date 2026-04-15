import { useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import FormInput from '../../../components/ui/FormInput';
import useCampaignStore from '../../../store/useCampaignStore';
import useAuthStore from '../../../store/useAuthStore';

const Step1Name = () => {
  const { wizardData, updateWizardData, setWizardStep } = useCampaignStore();
  const { user } = useAuthStore();
  const [error, setError] = useState('');

  const handleChange = (e) => {
    updateWizardData({ campaignName: e.target.value });
    if (error) setError('');
  };

  const regenerate = () => {
    const firstName = user?.name?.split(' ')[0] || 'My';
    updateWizardData({ campaignName: `${firstName}'s AR Card` });
    setError('');
  };

  const handleNext = () => {
    const name = wizardData.campaignName.trim();
    if (!name) return setError('Campaign name is required');
    if (name.length < 3) return setError('Name must be at least 3 characters');
    if (name.length > 100) return setError('Name cannot exceed 100 characters');
    setWizardStep(2);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Name your campaign</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          We&apos;ve auto-generated a name for you. Feel free to customise it.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <FormInput
          id="campaignName"
          label="Campaign Name"
          placeholder="e.g. John's AR Card"
          value={wizardData.campaignName}
          onChange={handleChange}
          error={error}
          required
          autoFocus
        />
        <button
          type="button"
          onClick={regenerate}
          className="flex w-fit items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300"
        >
          <Sparkles size={12} />
          Re-generate name
        </button>
      </div>

      {/* Preview card */}
      <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Preview</p>
        <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
          {wizardData.campaignName || 'Your Campaign Name'}
        </p>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          AR experience · {user?.email}
        </p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleNext}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-glow hover:bg-brand-500 hover:shadow-glow-lg"
        >
          Next: Upload Card Image <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default Step1Name;
