import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import useCampaignStore from '../../../store/useCampaignStore';
import { FRAME_OPTIONS } from '../../../components/qr/qrDesignModel';
import {
  compositeQrOnCardImage,
  getArQrPreviewUrl,
  QR_PLACEMENT_PRESETS,
} from '../../../utils/compositeQrOnCardImage';

const PRESET_BUTTONS = [
  { id: 'top-left', label: 'Top left' },
  { id: 'top-center', label: 'Top center' },
  { id: 'top-right', label: 'Top right' },
  { id: 'bottom-left', label: 'Bottom left' },
  { id: 'bottom-right', label: 'Bottom right' },
  { id: 'center', label: 'Center' },
];

const Step3QrPlacement = () => {
  const { wizardData, updateWizardData, setWizardStep } = useCampaignStore();
  const [previewUrl, setPreviewUrl] = useState(wizardData.compositedPreviewUrl || '');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const canvasWrapRef = useRef(null);
  const previewRevokeRef = useRef(null);

  const imageSrc = wizardData.targetImagePreview || wizardData.targetImageUrl;

  const refreshPreview = useCallback(async () => {
    if (!imageSrc) return;
    setBusy(true);
    try {
      const blob = await compositeQrOnCardImage({
        imageSrc,
        qrDataString: getArQrPreviewUrl(),
        placement: wizardData.qrPlacement,
        qrDesign: wizardData.qrDesign,
      });
      const prevStored = useCampaignStore.getState().wizardData.compositedPreviewUrl;
      if (previewRevokeRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(previewRevokeRef.current);
      }
      if (prevStored?.startsWith('blob:') && prevStored !== previewRevokeRef.current) {
        URL.revokeObjectURL(prevStored);
      }
      const url = URL.createObjectURL(blob);
      previewRevokeRef.current = url;
      setPreviewUrl(url);
      updateWizardData({ compositedPreviewUrl: url });
    } catch {
      setPreviewUrl(imageSrc);
    } finally {
      setBusy(false);
    }
  }, [imageSrc, wizardData.qrPlacement, wizardData.qrDesign, updateWizardData]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      refreshPreview();
    }, 150);
    return () => window.clearTimeout(t);
  }, [refreshPreview]);

  // Do not revoke blob URLs on unmount — the same URL is kept in wizard state for Review.

  const applyPreset = (id) => {
    const p = QR_PLACEMENT_PRESETS[id];
    if (!p) return;
    updateWizardData({
      qrPlacement: { ...wizardData.qrPlacement, ...p, preset: id },
    });
  };

  const pointerToPlacement = (clientX, clientY) => {
    const el = canvasWrapRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    return { x, y };
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    setDragging(true);
    const p = pointerToPlacement(e.clientX, e.clientY);
    if (p) {
      updateWizardData({
        qrPlacement: { ...wizardData.qrPlacement, ...p, preset: undefined },
      });
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const p = pointerToPlacement(e.clientX, e.clientY);
    if (p) {
      updateWizardData({
        qrPlacement: { ...wizardData.qrPlacement, ...p, preset: undefined },
      });
    }
  };

  const onPointerUp = (e) => {
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Place QR on your card</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Drag the code on your card or pick a corner. We render a high-contrast, print-ready QR with a
          white quiet zone so it scans on dark backgrounds. The final code links to your AR page when you publish on Review.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
        <div className="order-2 flex flex-col gap-4 lg:order-1">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Frame style
            </p>
            <div className="flex flex-wrap gap-2">
              {FRAME_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => updateWizardData({
                    qrDesign: { ...wizardData.qrDesign, frame: f.value },
                  })}
                  className={`min-h-[44px] rounded-full border px-3 py-2 text-xs font-medium ${
                    wizardData.qrDesign?.frame === f.value
                      ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                      : 'border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-secondary)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              Frame caption
            </span>
            <input
              type="text"
              maxLength={40}
              value={wizardData.qrDesign?.frameCaption || ''}
              onChange={(e) => updateWizardData({
                qrDesign: { ...wizardData.qrDesign, frameCaption: e.target.value },
              })}
              className="form-input min-h-[44px] w-full"
            />
          </label>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Position
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PRESET_BUTTONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`min-h-[44px] rounded-lg border px-2 py-2 text-xs ${
                    wizardData.qrPlacement?.preset === p.id
                      ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                      : 'border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-secondary)]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 flex justify-between text-xs font-medium text-[var(--text-secondary)]">
              <span>QR size</span>
              <span>{Math.round((wizardData.qrPlacement?.scale ?? 0.22) * 100)}%</span>
            </span>
            <input
              type="range"
              min="0.18"
              max="0.42"
              step="0.01"
              value={wizardData.qrPlacement?.scale ?? 0.22}
              onChange={(e) => updateWizardData({
                qrPlacement: {
                  ...wizardData.qrPlacement,
                  scale: parseFloat(e.target.value),
                  preset: undefined,
                },
              })}
              className="form-input w-full"
            />
          </label>
        </div>

        <div className="order-1 lg:order-2">
          <div
            ref={canvasWrapRef}
            className="relative mx-auto w-full max-w-lg touch-none overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)]"
            style={{ maxHeight: 'min(70vh, 600px)' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Card with QR preview"
                className="block h-auto w-full select-none"
                draggable={false}
              />
            ) : (
              <div className="flex aspect-[1.6] items-center justify-center text-sm text-[var(--text-muted)]">
                Upload a card image first
              </div>
            )}
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Loader2 className="animate-spin text-white" size={28} />
              </div>
            )}
          </div>
          <p className="mt-2 text-center text-[11px] text-[var(--text-muted)] lg:text-left">
            Tap and drag on the preview to fine-tune placement
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setWizardStep(2)}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)]"
        >
          <ArrowLeft size={15} /> Back
        </button>
        <button
          type="button"
          onClick={() => setWizardStep(4)}
          disabled={!wizardData.targetImageUrl}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-glow disabled:opacity-50"
        >
          Next: Upload Video <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default Step3QrPlacement;


