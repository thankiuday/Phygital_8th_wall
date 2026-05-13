import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ChevronDown,
  Frame as FrameIcon,
  Loader2,
  Palette,
  ImagePlus,
  Sparkles,
  Trash2,
  Eye,
  QrCode as QrCodeIcon,
  Download,
  X,
} from 'lucide-react';
import StyledQrPreview from '../../../components/qr/StyledQrPreview';
import QrFrame from '../../../components/qr/QrFrame';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import {
  buildQrOptions,
  buildQrDesignPayload,
  frameAccentFromDesign,
  FRAME_OPTIONS,
  DOT_TYPES,
  CORNER_SQUARE_TYPES,
  CORNER_DOT_TYPES,
} from '../../../components/qr/qrDesignModel';
import { downloadFramedDynamicQrPng } from '../../../utils/framedQrDownload';

/* ── Reusable accordion wrapper (inline — only used here) ─────────── */

const Accordion = ({ icon: Icon, title, subtitle, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
          {subtitle && (
            <p className="truncate text-xs text-[var(--text-muted)]">{subtitle}</p>
          )}
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <div className="border-t border-[var(--border-color)] p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Reusable mini selectable tile (e.g. for frame styles) ───────── */

const SelectTile = ({ label, sub, selected, onClick, ariaLabel }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    aria-label={ariaLabel}
    className={`relative min-h-[44px] rounded-xl border px-3 py-2 text-left transition-all ${
      selected
        ? 'border-brand-500 bg-brand-500/10 shadow-glow'
        : 'border-[var(--border-color)] bg-[var(--surface-2)] hover:border-brand-500/40'
    }`}
  >
    {sub && (
      <div className="text-xs font-bold text-[var(--text-primary)]">{sub}</div>
    )}
    <div className="break-words text-xs leading-tight text-[var(--text-secondary)]">{label}</div>
    {selected && (
      <span className="absolute right-2 top-2 inline-block h-2.5 w-2.5 rounded-full bg-brand-400 ring-2 ring-brand-400/30" />
    )}
  </button>
);

/* ── Color row (paired native picker + hex input) ────────────────── */

const ColorField = ({ label, value, onChange }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
    <div className="flex min-w-0 items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-12 cursor-pointer rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)]"
        aria-label={`${label} color picker`}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-base !w-auto min-w-0 flex-1 !py-2 font-mono text-xs"
        aria-label={`${label} hex value`}
        spellCheck={false}
      />
    </div>
  </div>
);

/* ── Logo upload pipeline ────────────────────────────────────────── */
/**
 * Read a File, decode it onto an offscreen canvas, downscale to ≤ 256 px on
 * the longer side, then re-export as WebP at q=0.85.  Keeps the persisted
 * `qrDesign.image` payload small — see qrDesignModel and the Zod schema.
 */
const readAndDownscaleLogo = (file) => new Promise((resolve, reject) => {
  if (!file.type.startsWith('image/')) return reject(new Error('Please select an image file'));
  if (file.size > 5 * 1024 * 1024) return reject(new Error('Logo file is too large (max 5 MB before downscale)'));

  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read file'));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('Could not decode image'));
    img.onload = () => {
      const TARGET = 256;
      const longest = Math.max(img.width, img.height);
      const scale = Math.min(1, TARGET / longest);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      // WebP keeps small icons crisp at smaller bytes than PNG.
      const dataUrl = canvas.toDataURL('image/webp', 0.85);
      if (dataUrl.length > 180_000) {
        return reject(new Error('Logo is too detailed — please pick a simpler image'));
      }
      resolve(dataUrl);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

const Step2DesignQr = ({
  design,
  onDesignChange,
  encodedData,
  onBack,
  onSubmit,
  isSubmitting,
  submitError,
}) => {
  const rootRef = useRef(null);
  const canPortal = typeof window !== 'undefined' && !!window.document?.body;
  const [previewMode, setPreviewMode] = useState('preview'); // 'preview' | 'qr'
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [logoError, setLogoError] = useState('');
  const downloadRef = useRef(null);

  useEffect(() => {
    // Step transition stays on the same route, so explicitly reset scroll
    // to the top of the wizard + scroll container when Step 2 mounts.
    rootRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const main = window.document.querySelector('main');
    if (main && typeof main.scrollTo === 'function') {
      main.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, []);

  // Debounce the design state so dragging the colour pickers doesn't thrash
  // the QR canvas (qr-code-styling re-renders on every update call).
  const debouncedDesign = useDebouncedValue(design, 150);

  // Memoize the options object so identity is stable when the design hasn't
  // actually changed — prevents redundant qr.update() calls.
  const qrOptions = useMemo(
    () => buildQrOptions(debouncedDesign, encodedData),
    [debouncedDesign, encodedData]
  );
  const previewQrOptions = useMemo(
    () => ({ ...qrOptions, width: 224, height: 224 }),
    [qrOptions]
  );

  const set = (patch) => onDesignChange({ ...design, ...patch });

  const handleLogoFile = async (file) => {
    setLogoError('');
    try {
      const dataUrl = await readAndDownscaleLogo(file);
      set({ logoDataUrl: dataUrl });
    } catch (err) {
      setLogoError(err.message);
    }
  };

  const handleSubmit = () => {
    onSubmit(buildQrDesignPayload(design));
  };

  const handleDownload = async () => {
    const downloadApi = downloadRef.current;
    if (!downloadApi) return;
    await downloadFramedDynamicQrPng({
      downloadApi,
      fileBaseName: 'qr',
      frame: design.frame,
      frameCaption: design.frameCaption,
      frameColor: frameAccentFromDesign(design),
      qrPixelSize: 224,
    });
  };

  const PreviewPanel = () => (
    <>
      <div className="glass-card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Live Preview</p>
          <div className="flex rounded-lg bg-[var(--surface-2)] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setPreviewMode('preview')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 ${
                previewMode === 'preview' ? 'bg-brand-600 text-white' : 'text-[var(--text-secondary)]'
              }`}
              aria-pressed={previewMode === 'preview'}
            >
              <Eye size={12} /> Preview
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('qr')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 ${
                previewMode === 'qr' ? 'bg-brand-600 text-white' : 'text-[var(--text-secondary)]'
              }`}
              aria-pressed={previewMode === 'qr'}
            >
              <QrCodeIcon size={12} /> QR code
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Preview your QR code design in real-time.
        </p>
      </div>

      {previewMode === 'preview' ? (
        <div className="flex max-w-full justify-center overflow-hidden rounded-3xl border border-[var(--border-color)] bg-white p-3 shadow-xl sm:p-6 dark:bg-zinc-900">
          <QrFrame
            variant={design.frame}
            caption={design.frameCaption}
            color={frameAccentFromDesign(design)}
            size={224}
          >
            <StyledQrPreview options={previewQrOptions} downloadRef={downloadRef} />
          </QrFrame>
        </div>
      ) : (
        <div className="flex max-w-full justify-center overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white p-3 sm:p-6">
          <StyledQrPreview options={previewQrOptions} downloadRef={downloadRef} />
        </div>
      )}
    </>
  );

  return (
    <div ref={rootRef} className="grid min-w-0 max-w-full gap-6 overflow-x-hidden lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* ── Left column: controls ────────────────────────────────── */}
      <div className="min-w-0 space-y-4 pb-20 lg:pb-0">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Step 2: Design the QR</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Customize the QR with frames, patterns, corners, and a logo. The preview updates as you tweak.
          </p>
        </div>

        <Accordion
          icon={FrameIcon}
          title="Frame"
          subtitle="Frames make your QR code stand out from the crowd."
          defaultOpen
        >
          <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Frame style</p>
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
            {FRAME_OPTIONS.map((f, i) => (
              <SelectTile
                key={f.value}
                sub={String(i + 1)}
                label={f.label}
                selected={design.frame === f.value}
                onClick={() => set({ frame: f.value })}
                ariaLabel={`Frame: ${f.label}`}
              />
            ))}
          </div>
          {design.frame !== 'none' && (
            <div className="mt-3">
              <label className="text-xs font-medium text-[var(--text-secondary)]" htmlFor="frameCaption">
                Frame caption
              </label>
              <input
                id="frameCaption"
                type="text"
                value={design.frameCaption}
                onChange={(e) => set({ frameCaption: e.target.value.slice(0, 40) })}
                className="input-base mt-1 !py-2 text-sm"
                maxLength={40}
              />
            </div>
          )}
        </Accordion>

        <Accordion
          icon={Palette}
          title="QR Code Pattern"
          subtitle="Choose a pattern for your QR code and pick its colors."
          defaultOpen
        >
          <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Pattern style</p>
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {DOT_TYPES.map((d) => (
              <SelectTile
                key={d.value}
                label={d.label}
                sub=""
                selected={design.dotsType === d.value}
                onClick={() => set({ dotsType: d.value })}
                ariaLabel={`Dots: ${d.label}`}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input
              id="dotsGradient"
              type="checkbox"
              checked={design.dotsUseGradient}
              onChange={(e) => set({ dotsUseGradient: e.target.checked })}
              className="h-4 w-4 rounded border-[var(--border-color)] bg-[var(--surface-2)]"
            />
            <label htmlFor="dotsGradient" className="text-xs text-[var(--text-secondary)]">
              Use a gradient pattern color
            </label>
          </div>

          {design.dotsUseGradient ? (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ColorField
                label="Gradient start"
                value={design.dotsGradientStart}
                onChange={(v) => set({ dotsGradientStart: v })}
              />
              <ColorField
                label="Gradient end"
                value={design.dotsGradientEnd}
                onChange={(v) => set({ dotsGradientEnd: v })}
              />
            </div>
          ) : (
            <div className="mt-3">
              <ColorField
                label="Pattern color"
                value={design.dotsColor}
                onChange={(v) => set({ dotsColor: v })}
              />
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            <input
              id="bgTransparent"
              type="checkbox"
              checked={design.backgroundTransparent}
              onChange={(e) => set({ backgroundTransparent: e.target.checked })}
              className="h-4 w-4 rounded border-[var(--border-color)] bg-[var(--surface-2)]"
            />
            <label htmlFor="bgTransparent" className="text-xs text-[var(--text-secondary)]">
              Transparent background
            </label>
          </div>
          {!design.backgroundTransparent && (
            <div className="mt-2">
              <ColorField
                label="Background color"
                value={design.backgroundColor}
                onChange={(v) => set({ backgroundColor: v })}
              />
            </div>
          )}
        </Accordion>

        <Accordion
          icon={Sparkles}
          title="Corners"
          subtitle="Style the three positioning eyes that anchor a QR scan."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--text-secondary)]">Outer shape</p>
              <div className="flex flex-wrap gap-2">
                {CORNER_SQUARE_TYPES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => set({ cornersSquareType: c.value })}
                    className={`rounded-lg border px-3 py-1.5 text-xs ${
                      design.cornersSquareType === c.value
                        ? 'border-brand-500 bg-brand-500/10 text-brand-300'
                        : 'border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-secondary)]'
                    }`}
                    aria-pressed={design.cornersSquareType === c.value}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <ColorField
                  label="Outer color"
                  value={design.cornersSquareColor}
                  onChange={(v) => set({ cornersSquareColor: v })}
                />
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--text-secondary)]">Inner dot</p>
              <div className="flex flex-wrap gap-2">
                {CORNER_DOT_TYPES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => set({ cornersDotType: c.value })}
                    className={`rounded-lg border px-3 py-1.5 text-xs ${
                      design.cornersDotType === c.value
                        ? 'border-brand-500 bg-brand-500/10 text-brand-300'
                        : 'border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-secondary)]'
                    }`}
                    aria-pressed={design.cornersDotType === c.value}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <ColorField
                  label="Inner color"
                  value={design.cornersDotColor}
                  onChange={(v) => set({ cornersDotColor: v })}
                />
              </div>
            </div>
          </div>
        </Accordion>

        <Accordion
          icon={ImagePlus}
          title="Logo (optional)"
          subtitle="Add a logo at the centre. PNG/JPEG/WebP, ≤ 5 MB pre-downscale."
        >
          {design.logoDataUrl ? (
            <div className="flex items-center gap-3">
              <img
                src={design.logoDataUrl}
                alt="Logo preview"
                className="h-14 w-14 rounded-lg border border-[var(--border-color)] bg-white object-contain p-1"
              />
              <button
                type="button"
                onClick={() => set({ logoDataUrl: '' })}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/15"
              >
                <Trash2 size={14} /> Remove logo
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--surface-2)] p-6 text-center transition-colors hover:border-brand-500/40">
              <ImagePlus size={20} className="mb-1 text-[var(--text-muted)]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">Upload logo</span>
              <span className="mt-0.5 text-xs text-[var(--text-muted)]">
                PNG, JPEG, or WebP (auto-downscaled to 256 px)
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoFile(f);
                  e.target.value = '';
                }}
              />
            </label>
          )}
          {logoError && (
            <p className="mt-2 text-xs text-red-400" role="alert">{logoError}</p>
          )}
        </Accordion>

        {submitError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
            {submitError}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <button
            type="button"
            onClick={onBack}
            className="hidden min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:border-brand-500/40 sm:flex sm:w-auto"
            disabled={isSubmitting}
          >
            <ArrowLeft size={15} /> Back
          </button>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleDownload}
              className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:border-brand-500/40 sm:w-auto"
              disabled={isSubmitting}
            >
              <Download size={15} /> Download preview
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-500 hover:shadow-glow-lg disabled:opacity-60 sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Sparkles size={15} /> Generate QR Code
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Right column: preview ────────────────────────────────── */}
      <div className="hidden space-y-4 lg:block">
        <PreviewPanel />
      </div>

      {/* Mobile sticky preview trigger + bottom drawer */}
      {canPortal && createPortal(
        <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-[var(--border-color)]/60 bg-[var(--surface-solid)]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-sm lg:hidden">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onBack}
              disabled={isSubmitting}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)]"
            >
              <ArrowLeft size={15} /> Back
            </button>
            <button
              type="button"
              onClick={() => setMobilePreviewOpen((v) => !v)}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-3 py-2.5 text-sm font-semibold text-white shadow-glow"
            >
              <Eye size={15} />
              {mobilePreviewOpen ? 'Hide Preview' : 'Live Preview'}
            </button>
          </div>
        </div>,
        window.document.body
      )}

      {mobilePreviewOpen && canPortal && createPortal(
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setMobilePreviewOpen(false)}
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-[2px] lg:hidden"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-[90] flex items-center justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] lg:hidden"
          >
            <div className="relative max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-[var(--border-color)] bg-[var(--surface-solid)] p-4 shadow-2xl">
              {/* centered close button */}
              <button
                type="button"
                onClick={() => setMobilePreviewOpen(false)}
                className="sticky left-1/2 top-0 z-10 mb-2 inline-flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-secondary)] shadow-sm"
                aria-label="Close preview"
              >
                <X size={16} />
              </button>
              <div className="space-y-4">
                <PreviewPanel />
              </div>
            </div>
          </motion.div>
        </>,
        window.document.body
      )}
    </div>
  );
};

export default Step2DesignQr;
