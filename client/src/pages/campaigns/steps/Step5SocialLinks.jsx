import { useState } from 'react';
import { ArrowLeft, ArrowRight, Link2 } from 'lucide-react';
import useCampaignStore from '../../../store/useCampaignStore';
import MultiLinksEditor from '../multiple-links/MultiLinksEditor';
import { validateLinkRows } from '../multiple-links/multiLinkFormUtils';

const Step5SocialLinks = () => {
  const { wizardData, updateWizardData, setWizardStep } = useCampaignStore();
  const [linkError, setLinkError] = useState('');

  const handleNext = () => {
    const err = wizardData.linkRows?.length ? validateLinkRows(wizardData.linkRows) : null;
    if (err) {
      setLinkError(err);
      return;
    }
    setLinkError('');
    setWizardStep(6);
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
          <Link2 size={18} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Social links</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Add links visitors see on your profile hub after scanning. Optional — skip if you only need AR.
          </p>
        </div>
      </div>

      <MultiLinksEditor
        rows={wizardData.linkRows}
        onRowsChange={(rows) => updateWizardData({ linkRows: rows })}
        error={linkError}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setWizardStep(4)}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)]"
        >
          <ArrowLeft size={15} /> Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-glow"
        >
          Review Campaign <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default Step5SocialLinks;
