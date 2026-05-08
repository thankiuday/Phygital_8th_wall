import React, { useEffect, useMemo, useState } from 'react';
import { Globe, Lock, Check, X, Loader2, Save } from 'lucide-react';
import StyledQrPreview from '../../../components/qr/StyledQrPreview';
import api from '../../../services/api';
import { campaignService } from '../../../services/campaignService';

const slugifyFor = (raw) =>
  String(raw || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

const resolveClientBase = () => {
  const fromEnv = import.meta.env.VITE_APP_URL && String(import.meta.env.VITE_APP_URL).replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return typeof window !== 'undefined' ? window.location.origin : '';
};

const resolveRedirectBase = () => {
  if (import.meta.env.VITE_REDIRECT_BASE) return String(import.meta.env.VITE_REDIRECT_BASE).replace(/\/$/, '');
  if (import.meta.env.VITE_API_URL) return String(import.meta.env.VITE_API_URL).replace(/\/api\/?$/, '').replace(/\/$/, '');
  return typeof window !== 'undefined' ? window.location.origin : '';
};

/**
 * Normalize client draft -> server Zod schema shape.
 * The editor keeps a few UI-friendly keys (e.g. `videoUrl`, `links`, heading
 * `text`) that the strict API schema rejects.
 */
const normalizeCardContentForApi = (content = {}) => {
  const {
    profileImagePreview,
    bannerImagePreview,
    address,
    ...restContent
  } = content;

  const sections = Array.isArray(content.sections)
    ? content.sections.map((sec) => {
        if (!sec || typeof sec !== 'object') return sec;
        if (sec.type === 'video') {
          return {
            ...sec,
            // API expects `url` for uploaded videos.
            url: sec.url || sec.videoUrl || undefined,
            videoUrl: undefined,
          };
        }
        if (sec.type === 'links') {
          // API enum is `customLinks`.
          return { ...sec, type: 'customLinks' };
        }
        if (sec.type === 'heading') {
          // API expects heading `title`.
          return { ...sec, title: sec.title || sec.text || '', text: undefined };
        }
        return sec;
      })
    : [];
  return {
    ...restContent,
    // UI keeps address at top-level; API expects it under contact.
    contact: {
      ...(restContent.contact || {}),
      ...(address ? { address } : {}),
    },
    sections,
  };
};

/**
 * Step3Publish — visibility, custom URL availability check, and Save.
 *
 * Save flow
 *   1. POST /api/campaigns/digital-business-card with the entire draft.
 *   2. Server returns the persisted campaign (with allocated cardSlug + redirectSlug).
 *   3. We GET /api/campaigns/:id/qr to surface the redirectUrl + publicUrl,
 *      then store both in the draft so Step 4 can render them.
 */
const Step3Publish = ({ draft, store, onContinue, onBack }) => {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const seedSlug = useMemo(() => slugifyFor(draft.cardContent?.fullName || draft.campaignName), [draft.cardContent?.fullName, draft.campaignName]);

  // Initial value for the slug input — uses the saved one if we already
  // saved, otherwise the typed value, otherwise a slugified seed from name.
  useEffect(() => {
    if (!draft.cardSlug && seedSlug) store.setSlug(seedSlug);
  }, [seedSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced availability lookup
  useEffect(() => {
    const slug = (draft.cardSlug || '').trim();
    if (!slug) {
      store.setSlugAvailability({ state: 'idle', available: null, lastChecked: '' });
      return;
    }
    if (!/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/.test(slug)) {
      store.setSlugAvailability({ state: 'invalid', available: false, lastChecked: slug });
      return;
    }
    store.setSlugAvailability({ state: 'checking', available: null, lastChecked: slug });
    const handle = setTimeout(async () => {
      try {
        const data = await campaignService.checkCardSlugAvailability(slug, draft.savedCampaignId);
        store.setSlugAvailability({
          state: data.available ? 'available' : 'taken',
          available: !!data.available,
          lastChecked: slug,
        });
      } catch {
        store.setSlugAvailability({ state: 'idle', available: null, lastChecked: slug });
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [draft.cardSlug, draft.savedCampaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  const clientBase = useMemo(resolveClientBase, []);
  const redirectBase = useMemo(resolveRedirectBase, []);

  const friendlyUrl = `${clientBase}/card/${draft.cardSlug || 'your-name'}`;

  // QR preview encodes the immutable redirect (so reprints still work).
  const placeholderRedirectUrl = `${redirectBase}/r/preview1`;
  const qrTargetUrl = draft.qrUrl || placeholderRedirectUrl;

  const qrOptions = useMemo(() => ({
    width: 220,
    height: 220,
    data: qrTargetUrl,
    margin: 4,
    qrOptions: { errorCorrectionLevel: 'H' },
    dotsOptions: { type: 'rounded', color: '#0f172a' },
    backgroundOptions: { color: '#ffffff' },
    cornersSquareOptions: { type: 'extra-rounded', color: '#0f172a' },
    cornersDotOptions: { type: 'dot', color: '#0f172a' },
  }), [qrTargetUrl]);

  const slugStatus = draft.cardSlugAvailability?.state || 'idle';
  const canSave = !!draft.cardContent?.fullName?.trim() && (slugStatus === 'available' || slugStatus === 'idle' || draft.savedCampaignId);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError('');
    try {
      let savedCampaign;
      if (draft.savedCampaignId) {
        savedCampaign = await campaignService.updateCampaign(draft.savedCampaignId, {
          campaignName: draft.campaignName,
          cardSlug: draft.cardSlug || undefined,
          visibility: draft.visibility,
          cardContent: normalizeCardContentForApi(draft.cardContent),
          cardDesign: draft.cardDesign,
          cardPrintSettings: draft.cardPrintSettings,
        });
      } else {
        savedCampaign = await campaignService.createDigitalBusinessCardCampaign({
          campaignName: draft.campaignName,
          cardSlug: draft.cardSlug,
          visibility: draft.visibility,
          cardContent: normalizeCardContentForApi(draft.cardContent),
          cardDesign: draft.cardDesign,
          cardPrintSettings: draft.cardPrintSettings,
          qrDesign: draft.qrDesign,
        });
      }

      // Pull the friendly + tracked URLs in one round trip so Step 4 can
      // surface the printed QR and the public preview without re-fetching.
      const qr = await api
        .get(`/campaigns/${savedCampaign._id}/qr`)
        .then((r) => r.data.data)
        .catch(() => null);

      store.setSavedCampaign({
        campaignId: savedCampaign._id,
        cardSlug: savedCampaign.cardSlug || draft.cardSlug,
        qrUrl: qr?.redirectUrl || null,
        publicUrl: qr?.publicUrl || null,
      });
    } catch (err) {
      const message =
        err?.response?.data?.errors?.[0]?.message
        || err?.response?.data?.message
        || 'Failed to save card. Please try again.';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Publish</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          Visibility, custom URL, and a printed QR. Saving creates your shareable link.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-[var(--border-color)] p-4">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Visibility</h4>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => store.setVisibility('public')}
            className={`flex items-start gap-3 rounded-lg border p-3 text-left ${
              draft.visibility === 'public'
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-[var(--border-color)] hover:border-brand-500/40'
            }`}
          >
            <Globe className="mt-0.5 text-brand-300" size={18} />
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">Public</div>
              <div className="text-xs text-[var(--text-muted)]">Anyone with the link can view.</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => store.setVisibility('private')}
            className={`flex items-start gap-3 rounded-lg border p-3 text-left ${
              draft.visibility === 'private'
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-[var(--border-color)] hover:border-brand-500/40'
            }`}
          >
            <Lock className="mt-0.5 text-brand-300" size={18} />
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">Private</div>
              <div className="text-xs text-[var(--text-muted)]">Only you can view.</div>
            </div>
          </button>
        </div>
      </section>

      <section className="mt-4 space-y-2 rounded-xl border border-[var(--border-color)] p-4">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Custom URL</h4>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{clientBase}/card/</span>
          <input
            type="text"
            className="form-input flex-1"
            placeholder="your-name"
            value={draft.cardSlug || ''}
            onChange={(e) => store.setSlug(e.target.value.toLowerCase())}
            maxLength={60}
          />
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-color)]">
            {slugStatus === 'checking' && <Loader2 size={14} className="animate-spin text-brand-300" />}
            {slugStatus === 'available' && <Check size={14} className="text-emerald-400" />}
            {(slugStatus === 'taken' || slugStatus === 'invalid') && <X size={14} className="text-red-400" />}
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          {slugStatus === 'invalid' && 'Use 3–60 lowercase letters, numbers, or hyphens.'}
          {slugStatus === 'taken' && 'That URL is taken — try another.'}
          {slugStatus === 'available' && 'This URL is available.'}
          {slugStatus === 'checking' && 'Checking availability…'}
          {slugStatus === 'idle' && 'Friendly URL — printed QR uses a permanent short code so you can always rename without reprinting.'}
        </p>
        <div className="text-xs text-[var(--text-secondary)]">Public URL preview: <span className="font-mono">{friendlyUrl}</span></div>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-[var(--border-color)] p-4 sm:grid-cols-[1fr_auto]">
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">QR Code</h4>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Encodes a permanent short URL. Editing your card never invalidates the printed QR.
          </p>
          {saveError && <p className="mt-2 text-xs text-red-400">{saveError}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-glow hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {draft.savedCampaignId ? 'Save changes' : 'Save Card'}
            </button>
            {draft.savedCampaignId && (
              <a
                href={draft.publicUrl || friendlyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
              >
                Open public page
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center rounded-lg bg-white p-3">
          <StyledQrPreview options={qrOptions} />
        </div>
      </section>

      <div className="mt-8 flex items-center justify-between">
        <button type="button" onClick={onBack} className="rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)]">Back</button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!draft.savedCampaignId}
          className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue to Print
        </button>
      </div>
    </div>
  );
};

export default Step3Publish;
