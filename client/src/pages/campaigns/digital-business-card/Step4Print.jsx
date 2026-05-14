import React, { useEffect, useState } from 'react';
import { Download, Loader2, Printer, ExternalLink } from 'lucide-react';

import { campaignService } from '../../../services/campaignService';
import { CARD_SIZES, CARD_SIZE_IDS, getCardSize } from '../../../components/card/cardSizes';
import {
  QR_THEMES,
  QR_POSITIONS,
  DISPLAY_FIELDS,
} from '../../../components/card/cardTemplates';

/**
 * Step4Print — print configuration + double-sided PNG download.
 *
 * The right-side preview lives in the wizard parent, which swaps in the
 * `BusinessCardPrintPreview` component on this step (with Front/Back tabs).
 * This page renders the controls only; the live mockup never duplicates here.
 *
 * On "Generate & download PNGs" we trigger one round-trip that asks the server to
 * render both front and back. The client then polls each face's job id
 * (when BullMQ is on) or receives both URLs immediately (direct-render).
 * When both faces succeed, downloads start automatically (staggered). The manual
 * "Download Card" button remains for grabbing the files again.
 */

const initialJob = () => ({ status: 'idle', url: null, public_id: null, jobId: null, filename: null });
const QR_PLACEMENTS = [
  { id: 'front', label: 'Front only' },
  { id: 'back', label: 'Back only' },
  { id: 'both', label: 'Front + Back' },
];

// Hydrate from persisted `draft.lastRender` so re-opening the wizard shows
// the previously generated download links without forcing a re-render.
const hydrateFace = (snap) => {
  if (!snap || !snap.url) return initialJob();
  return {
    status: 'ready',
    url: snap.url,
    public_id: snap.public_id || null,
    jobId: snap.jobId || null,
    filename: snap.filename || null,
  };
};

const Step4Print = ({ draft, store, onBack, onFinish }) => {
  const p = draft.cardPrintSettings;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [front, setFront] = useState(() => hydrateFace(draft.lastRender?.front));
  const [back, setBack]   = useState(() => hydrateFace(draft.lastRender?.back));

  // Stop any in-flight render polls when the wizard step unmounts so we
  // don't leak intervals across navigation.
  useEffect(() => {
    const handles = [];
    const register = (h) => { if (h) handles.push(h); };
    window.__cardRenderPollHandles__ = register;
    return () => {
      handles.forEach((h) => clearInterval(h));
      delete window.__cardRenderPollHandles__;
    };
  }, []);

  const sizeSpec = getCardSize(p.cardSize);

  const toggleDisplay = (id) => {
    const next = (p.displayFields || []).includes(id)
      ? p.displayFields.filter((d) => d !== id)
      : [...(p.displayFields || []), id];
    store.patchPrint({ displayFields: next });
  };

  // Poll a single face's job until it resolves or the user navigates away.
  const pollFace = (face, jobId, expectedFilename) =>
    new Promise((resolve) => {
      const setter = face === 'front' ? setFront : setBack;
      const handle = setInterval(async () => {
        try {
          const s = await campaignService.getCardRenderStatus(jobId);
          if (s.status === 'ready') {
            clearInterval(handle);
            const next = {
              status: 'ready',
              url: s.url,
              public_id: s.public_id,
              jobId,
              filename: expectedFilename,
              face,
            };
            setter(next);
            resolve(next);
          } else if (s.status === 'failed') {
            clearInterval(handle);
            setter({ ...initialJob(), status: 'failed', face });
            resolve({ status: 'failed', face, reason: s.reason });
          }
        } catch {/* keep polling */}
      }, 2000);
      if (typeof window.__cardRenderPollHandles__ === 'function') {
        window.__cardRenderPollHandles__(handle);
      }
    });

  const startRender = async () => {
    if (!draft.savedCampaignId) {
      setError('Please save your card on the Publish step first.');
      return;
    }
    setBusy(true);
    setError('');
    setFront(initialJob());
    setBack(initialJob());
    try {
      // Persist the print preferences before rendering, so the server pulls
      // the right size / QR / display settings into the deterministic hash.
      await campaignService.updateCampaign(draft.savedCampaignId, {
        cardPrintSettings: p,
      });
      const result = await campaignService.renderCardImage(draft.savedCampaignId, { size: p.cardSize });

      // Direct-render path returns both faces ready in the same response.
      // Queued path returns { jobId } per face and the client polls each.
      const { front: fr, back: bk } = result;
      const settled = { front: null, back: null };
      const promises = [];

      if (fr?.status === 'ready') {
        const next = { ...fr, status: 'ready', face: 'front' };
        setFront(next);
        settled.front = next;
      } else if (fr?.jobId) {
        setFront({ ...fr, status: 'pending', face: 'front' });
        promises.push(pollFace('front', fr.jobId, fr.filename).then((r) => { settled.front = r; }));
      }
      if (bk?.status === 'ready') {
        const next = { ...bk, status: 'ready', face: 'back' };
        setBack(next);
        settled.back = next;
      } else if (bk?.jobId) {
        setBack({ ...bk, status: 'pending', face: 'back' });
        promises.push(pollFace('back', bk.jobId, bk.filename).then((r) => { settled.back = r; }));
      }
      if (promises.length) await Promise.all(promises);

      // Persist the latest renders on the draft so re-opening the wizard
      // shows the cached download links without triggering a fresh job.
      store.setLastRender({
        front: settled.front
          ? { url: settled.front.url, public_id: settled.front.public_id, filename: settled.front.filename }
          : null,
        back: settled.back
          ? { url: settled.back.url, public_id: settled.back.public_id, filename: settled.back.filename }
          : null,
      });

      const autoFrontReady = settled.front?.status === 'ready' && settled.front?.url;
      const autoBackReady = settled.back?.status === 'ready' && settled.back?.url;
      if (autoFrontReady && autoBackReady) {
        triggerDownload(settled.front.url, settled.front.filename || `card-${p.cardSize}-front.png`);
        setTimeout(() => {
          triggerDownload(settled.back.url, settled.back.filename || `card-${p.cardSize}-back.png`);
        }, 350);
      }

      setBusy(false);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to render card. Please try again.');
      setBusy(false);
    }
  };

  // Trigger a real `download` by clicking a programmatic anchor. We do front
  // first then back, with a tiny stagger so the second download isn't
  // de-duped by the browser when the URL is identical.
  const triggerDownload = (url, filename) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'card.png';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadBoth = () => {
    if (front.url) triggerDownload(front.url, front.filename || `card-${p.cardSize}-front.png`);
    if (back.url)  setTimeout(() => triggerDownload(back.url, back.filename || `card-${p.cardSize}-back.png`), 350);
  };

  const ready = front.status === 'ready' && back.status === 'ready';
  const pending = front.status === 'pending' || back.status === 'pending';

  return (
    <div className="min-w-0 overflow-x-hidden">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Print</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          Download front and back as separate print-ready PNGs (300 DPI, with bleed and a safe area inset).
        </p>
      </div>

      <section className="wizard-section space-y-3">
        <h4 className="wizard-section-title">Card Size</h4>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CARD_SIZE_IDS.map((id) => {
            const spec = CARD_SIZES[id];
            const active = p.cardSize === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => store.patchPrint({ cardSize: id })}
                className={`rounded-lg border p-3 text-left ${active ? 'border-brand-500 bg-brand-500/10' : 'border-[var(--border-color)] hover:border-brand-500/40'}`}
              >
                <div className="text-sm font-semibold text-[var(--text-primary)]">{spec.label}</div>
                <div className="text-xs text-[var(--text-muted)]">
                  Trim {spec.trim.widthIn}″ × {spec.trim.heightIn}″ · Bleed {spec.bleed.widthPx}×{spec.bleed.heightPx}px @ 300 DPI
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="wizard-section mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">QR Code</h4>
          <label className="mb-2 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={!!p.includeQr}
              onChange={(e) => store.patchPrint({ includeQr: e.target.checked })}
            />
            Include QR on printed card
          </label>
          <div className="mb-2 flex flex-wrap gap-2">
            {QR_PLACEMENTS.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => store.patchPrint({ qrPlacement: q.id })}
                className={`rounded-full border px-3 py-1 text-xs ${
                  (p.qrPlacement || 'back') === q.id
                    ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                    : 'border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-secondary)]'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
          <div className="mb-2 flex flex-wrap gap-2">
            {QR_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => store.patchPrint({ theme: t.id })}
                className={`rounded-full border px-3 py-1 text-xs ${p.theme === t.id ? 'border-brand-500 bg-brand-500/15 text-brand-300' : 'border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-secondary)]'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {QR_POSITIONS.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => store.patchPrint({ qrPosition: q.id })}
                className={`rounded-md border p-2 text-xs ${p.qrPosition === q.id ? 'border-brand-500 bg-brand-500/15 text-brand-300' : 'border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-secondary)]'}`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Display Information</h4>
          <p className="mb-2 text-xs text-[var(--text-muted)]">Pick which fields print on the physical card.</p>
          <div className="grid grid-cols-2 gap-2">
            {DISPLAY_FIELDS.map((f) => (
              <label key={f.id} className="flex items-center gap-2 rounded-md border border-[var(--border-color)] bg-[var(--surface-2)] px-2 py-1.5 text-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={(p.displayFields || []).includes(f.id)}
                  onChange={() => toggleDisplay(f.id)}
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="wizard-section mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="block text-xs font-medium text-[var(--text-secondary)]">Profile zoom</span>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.05"
            value={p.profileZoom}
            onChange={(e) => store.patchPrint({ profileZoom: parseFloat(e.target.value) })}
            className="form-input w-full"
          />
          <span className="block text-xs text-[var(--text-muted)]">{p.profileZoom.toFixed(2)}×</span>
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-[var(--text-secondary)]">Crop X</span>
          <input
            type="range"
            min="0"
            max="100"
            value={p.profileCropX}
            onChange={(e) => store.patchPrint({ profileCropX: Number(e.target.value) })}
            className="form-input w-full"
          />
          <span className="block text-xs text-[var(--text-muted)]">{p.profileCropX}%</span>
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-[var(--text-secondary)]">Crop Y</span>
          <input
            type="range"
            min="0"
            max="100"
            value={p.profileCropY}
            onChange={(e) => store.patchPrint({ profileCropY: Number(e.target.value) })}
            className="form-input w-full"
          />
          <span className="block text-xs text-[var(--text-muted)]">{p.profileCropY}%</span>
        </label>
      </section>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={startRender}
          disabled={busy || pending}
          className="wizard-btn-primary px-4 py-2 disabled:opacity-50"
        >
          {busy || pending ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
          {ready ? 'Re-render & download' : 'Generate & download PNGs'}
        </button>

        {ready && (
          <button
            type="button"
            onClick={downloadBoth}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/25"
          >
            <Download size={14} />
            Download Card (Front + Back)
          </button>
        )}

        {ready && front.url && (
          <a
            href={front.url}
            target="_blank"
            rel="noopener noreferrer"
            className="wizard-btn-secondary px-4 py-2"
          >
            <ExternalLink size={14} />
            View Front
          </a>
        )}
        {ready && back.url && (
          <a
            href={back.url}
            target="_blank"
            rel="noopener noreferrer"
            className="wizard-btn-secondary px-4 py-2"
          >
            <ExternalLink size={14} />
            View Back
          </a>
        )}
      </div>

      {pending && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Rendering both faces in the background — this usually finishes in a few seconds.
        </p>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button type="button" onClick={onBack} className="wizard-btn-secondary">Back</button>
        <button type="button" onClick={onFinish} className="wizard-btn-primary bg-emerald-500 hover:brightness-110">
          Done — go to dashboard
        </button>
      </div>
    </div>
  );
};

export default Step4Print;
