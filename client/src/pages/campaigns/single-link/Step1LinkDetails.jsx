import { useState } from 'react';
import { Sparkles, ArrowRight, QrCode } from 'lucide-react';
import FormInput from '../../../components/ui/FormInput';

/**
 * Normalize a URL string from the wizard input field.
 *
 * Mirrors the server-side `safeUrl` helper as closely as we can in the browser
 * (we can't do SSRF/IP checks on the client).  Returns the normalized URL
 * string on success or throws RangeError with a user-readable message.
 */
const normalizeUrl = (input) => {
  const trimmed = (input || '').trim();
  if (!trimmed) throw new RangeError('URL is required');

  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new RangeError('Please enter a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new RangeError('Only http:// and https:// URLs are supported');
  }
  return url.toString();
};

const Step1LinkDetails = ({
  campaignName,
  onCampaignNameChange,
  onRegenerateName,
  destinationUrl,
  onDestinationUrlChange,
  preciseGeoAnalytics,
  onPreciseGeoAnalyticsChange,
  onContinue,
}) => {
  const [nameError, setNameError] = useState('');
  const [urlError, setUrlError] = useState('');

  const handleBlurUrl = () => {
    if (!destinationUrl.trim()) return;
    try {
      const normalized = normalizeUrl(destinationUrl);
      onDestinationUrlChange(normalized);
      setUrlError('');
    } catch (err) {
      setUrlError(err.message);
    }
  };

  const handleContinue = () => {
    const trimmed = campaignName.trim();
    if (!trimmed) return setNameError('Campaign name is required');
    if (trimmed.length > 100) return setNameError('Name cannot exceed 100 characters');
    setNameError('');

    let normalized;
    try {
      normalized = normalizeUrl(destinationUrl);
    } catch (err) {
      return setUrlError(err.message);
    }

    onContinue({
      campaignName: trimmed,
      destinationUrl: normalized,
      preciseGeoAnalytics,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
          <QrCode size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Step 1: Enter Your Link</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Provide the campaign name and URL for your QR code.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <FormInput
          id="campaignName"
          label="Campaign Name"
          placeholder="e.g. Spring 2026 Single Link"
          value={campaignName}
          onChange={(e) => {
            onCampaignNameChange(e.target.value);
            if (nameError) setNameError('');
          }}
          error={nameError}
          required
          autoFocus
        />
        <button
          type="button"
          onClick={onRegenerateName}
          className="flex w-fit items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300"
        >
          <Sparkles size={12} />
          Re-generate name
        </button>
      </div>

      <FormInput
        id="destinationUrl"
        label="URL"
        placeholder="https://example.com or example.com"
        value={destinationUrl}
        onChange={(e) => {
          onDestinationUrlChange(e.target.value);
          if (urlError) setUrlError('');
        }}
        onBlur={handleBlurUrl}
        error={urlError}
        hint="The destination your QR code will redirect to. You can change this later."
        type="url"
        inputMode="url"
        autoComplete="url"
        spellCheck={false}
        required
      />

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-4 py-3">
        <input
          type="checkbox"
          checked={preciseGeoAnalytics}
          onChange={(e) => onPreciseGeoAnalyticsChange(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--border-color)] text-brand-600 focus:ring-brand-500"
        />
        <span className="text-left text-xs text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--text-primary)]">Precise location analytics (optional)</span>
          {' '}
          Encode a short landing page so visitors can opt in to one-time browser GPS for finer maps.
          Requires your deployed app URL (<code className="text-[var(--text-muted)]">CLIENT_URL</code> /{' '}
          <code className="text-[var(--text-muted)]">VITE_APP_URL</code>). Approximate IP geo is always collected when disabled.
        </span>
      </label>

      {preciseGeoAnalytics && (
        <p className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-4 py-2 text-xs text-[var(--text-muted)]">
          Until you publish, the QR preview uses a temporary /open/… link. After publishing, your live link becomes
          {' '}
          <span className="text-[var(--text-secondary)]">/open/your-handle/your-campaign-slug</span>
          {' '}
          (a number suffix may be added if that path is already used).
        </p>
      )}

      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">How it works</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-[var(--text-secondary)]">
          <li>Enter a campaign name and the URL the QR will redirect to.</li>
          <li>Click <strong>Continue to Design</strong> to customize the QR code.</li>
          <li>Pick a frame, pattern, corners, and add your logo if you like.</li>
          <li>Generate the campaign &mdash; you can still update the URL later.</li>
        </ol>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleContinue}
          className="flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-500 hover:shadow-glow-lg disabled:opacity-60"
          disabled={!campaignName.trim() || !destinationUrl.trim()}
        >
          Continue to Design <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default Step1LinkDetails;
