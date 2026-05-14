import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';

import { DEFAULT_CARD_SIZE, getCardSize } from './cardSizes';

/** Merge so Puppeteer / public meta can omit fields without disabling the QR. */
const defaultPrintSettings = () => ({
  cardSize: DEFAULT_CARD_SIZE,
  theme: 'white',
  qrPosition: 'bottom-right',
  qrPlacement: 'back',
  includeQr: true,
  displayFields: ['name', 'jobTitle', 'company', 'phone', 'email', 'website'],
  profileZoom: 1,
  profileCropX: 50,
  profileCropY: 50,
});

/** Spreading `...print` would overwrite defaults with `undefined` from persisted partials. */
export const mergeCardPrintSettings = (partial) => {
  const defaults = defaultPrintSettings();
  if (!partial || typeof partial !== 'object') return defaults;
  const out = { ...defaults };
  for (const key of Object.keys(partial)) {
    const v = partial[key];
    if (v !== undefined) out[key] = v;
  }
  return out;
};

/**
 * BusinessCardPrintPreview — single source of truth for the printable card.
 *
 * Two render modes:
 *   • mode="preview" (default) — used in the wizard right-side column.
 *     The card is rendered at its real bleed pixel dimensions then
 *     CSS-scaled down to fit `previewWidth` (defaults to 340px). This
 *     preserves true proportions / safe areas / typography rhythm so
 *     what the user sees is exactly what gets exported.
 *   • mode="print" — used by `/print/card/:slug` for Puppeteer.
 *     No outer scale; the screenshot clips to the bleed canvas.
 *
 * The same component renders either face (`face="front"` or `face="back"`),
 * so the UI tab on Step 4 and the print-page query string both flip the
 * exact same component — never two divergent implementations.
 *
 * QR code: generated client-side via `qrcode` (`toCanvas` into the mount) so
 * headless screenshots see real pixels — avoids async PNG data-URL + <img>
 * decode races with Puppeteer's `data-print-ready` handshake. Placement
 * (front / back / both) controls where the code appears on the card.
 */
const themeColors = (themeId) => {
  if (themeId === 'black') return { bg: '#0b0b0c', fg: '#ffffff', muted: 'rgba(255,255,255,0.65)' };
  if (themeId === 'neon')  return { bg: '#020617', fg: '#a3e635', muted: 'rgba(163,230,53,0.65)' };
  return { bg: '#ffffff', fg: '#0f172a', muted: 'rgba(15,23,42,0.65)' };
};

const fmt = {
  phone: (s) => (s ? String(s).trim() : ''),
  email: (s) => (s ? String(s).trim() : ''),
  url:   (s) => (s ? String(s).replace(/^https?:\/\//, '') : ''),
};

/** Stable identity: avoids remounting QR mounts on parent state churn and keeps styles live. */
function PrintCardFrontFace({
  qrFrontRef,
  content,
  accent,
  colors,
  widthPx,
  heightPx,
  safeInset,
  profileCropX,
  profileCropY,
  profileZoom,
  display,
  frontQrOuter,
  qrPositionStyle,
  printTheme,
  qrLight,
  showFrontQr,
}) {
  const profileTransform = `translate(-50%, -50%) scale(${profileZoom || 1})`;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          right: -widthPx * 0.18,
          top: -heightPx * 0.4,
          width: widthPx * 0.7,
          height: heightPx * 1.2,
          background: `linear-gradient(135deg, ${accent} 0%, transparent 60%)`,
          opacity: 0.18,
          transform: 'rotate(15deg)',
          pointerEvents: 'none',
        }}
      />

      {content.profileImageUrl && (
        <div
          style={{
            position: 'absolute',
            right: safeInset,
            bottom: safeInset,
            width: heightPx * 0.55,
            height: heightPx * 0.55,
            borderRadius: '50%',
            overflow: 'hidden',
            border: `${Math.round(heightPx * 0.012)}px solid ${accent}`,
            boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '160%',
              height: '160%',
              backgroundImage: `url(${content.profileImagePreview || content.profileImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: `${profileCropX ?? 50}% ${profileCropY ?? 50}%`,
              transform: profileTransform,
            }}
          />
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          inset: `${safeInset}px`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          maxWidth: '62%',
        }}
      >
        <div>
          {display('name') && content.fullName && (
            <div style={{ fontSize: heightPx * 0.11, fontWeight: 800, lineHeight: 1.05, letterSpacing: -0.5 }}>
              {content.fullName}
            </div>
          )}
          {display('jobTitle') && content.jobTitle && (
            <div style={{ fontSize: heightPx * 0.055, marginTop: 4, opacity: 0.85 }}>
              {content.jobTitle}
            </div>
          )}
          {display('company') && content.company && (
            <div style={{
              fontSize: heightPx * 0.045,
              marginTop: 2,
              color: accent,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
            }}
            >
              {content.company}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: heightPx * 0.012, fontSize: heightPx * 0.04, color: colors.muted }}>
          {display('tagline') && content.tagline && (
            <div style={{ color: colors.fg, fontStyle: 'italic' }}>{content.tagline}</div>
          )}
          {display('phone')   && content.contact?.phone   && <div>{fmt.phone(content.contact.phone)}</div>}
          {display('email')   && content.contact?.email   && <div>{fmt.email(content.contact.email)}</div>}
          {display('website') && content.contact?.website && <div>{fmt.url(content.contact.website)}</div>}
          {display('address') && content.contact?.address && <div>{content.contact.address}</div>}
        </div>
      </div>

      {showFrontQr && (
        <div
          ref={qrFrontRef}
          style={{
            position: 'absolute',
            width: frontQrOuter,
            height: frontQrOuter,
            padding: 6,
            boxSizing: 'border-box',
            borderRadius: 10,
            backgroundColor: printTheme === 'white' ? '#ffffff' : qrLight,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
            ...qrPositionStyle,
          }}
        />
      )}
    </>
  );
}

function PrintCardBackFace({
  qrBackRef,
  content,
  accent,
  designSecondary,
  colors,
  heightPx,
  safeInset,
  showBackQr,
  backQrOuter,
  qrPositionStyle,
  qrLight,
}) {
  const backInitial = (content.company || content.fullName || 'C').trim().charAt(0).toUpperCase();
  const secondary = designSecondary || accent;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, ${accent} 0%, ${secondary} 100%)`,
          opacity: 0.18,
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: `${safeInset}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: heightPx * 0.04,
        }}
      >
        <div
          style={{
            width: heightPx * 0.4,
            height: heightPx * 0.4,
            borderRadius: '50%',
            background: accent,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: heightPx * 0.22,
            fontWeight: 800,
            boxShadow: '0 8px 18px rgba(0,0,0,0.18)',
          }}
        >
          {backInitial}
        </div>

        {content.company && (
          <div style={{
            fontSize: heightPx * 0.085,
            fontWeight: 800,
            letterSpacing: 2,
            textTransform: 'uppercase',
            lineHeight: 1.1,
            color: colors.fg,
          }}
          >
            {content.company}
          </div>
        )}

        {(content.tagline || content.bio) && (
          <div style={{
            fontSize: heightPx * 0.04,
            maxWidth: '80%',
            opacity: 0.85,
            fontStyle: 'italic',
            color: colors.fg,
          }}
          >
            {content.tagline || (content.bio?.length > 100 ? `${content.bio.slice(0, 100)}…` : content.bio)}
          </div>
        )}
      </div>

      {showBackQr && (
        <div
          ref={qrBackRef}
          style={{
            position: 'absolute',
            width: backQrOuter,
            height: backQrOuter,
            padding: 4,
            boxSizing: 'border-box',
            borderRadius: 8,
            backgroundColor: qrLight,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
            ...qrPositionStyle,
          }}
        />
      )}
    </>
  );
}

const BusinessCardPrintPreview = ({
  content = {},
  design = {},
  print = {},
  face = 'front',
  mode = 'preview',
  previewWidth = 340,
  /** Public hub URL (`/card/:slug`) when available — preferred for printed QR. */
  qrHubUrl = null,
  /** Full tracked URL for the QR (from GET /campaigns/:id/qr). */
  qrPayloadUrl = null,
  /** Opaque short slug for `/r/:slug` — never use vanity `cardSlug` here. */
  redirectSlug = null,
}) => {
  const printMerged = useMemo(() => mergeCardPrintSettings(print), [print]);
  const sizeSpec = useMemo(() => getCardSize(printMerged.cardSize), [printMerged.cardSize]);
  const widthPx = sizeSpec.bleed.widthPx;
  const heightPx = sizeSpec.bleed.heightPx;
  const safeInset = sizeSpec.safe.insetPx;

  const colors = themeColors(printMerged.theme);
  const accent = design?.colors?.primary || '#3b82f6';

  const qrFrontRef = useRef(null);
  const qrBackRef = useRef(null);
  const [qrReady, setQrReady] = useState(false);
  const qrPlacement = printMerged.qrPlacement || 'back';
  const showFrontQr = !!printMerged.includeQr && (qrPlacement === 'front' || qrPlacement === 'both');
  const showBackQr = !!printMerged.includeQr && (qrPlacement === 'back' || qrPlacement === 'both');

  // Encode friendly hub first, then tracked short link, then `/r/` preview fallback.
  const qrDataString = useMemo(() => {
    if (qrHubUrl) return qrHubUrl;
    if (qrPayloadUrl) return qrPayloadUrl;
    const redirectBase =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_REDIRECT_BASE)
      || ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '').replace(/\/api\/?$/, '').replace(/\/$/, '')
      || (typeof window !== 'undefined' ? window.location.origin : '');
    const slug = redirectSlug || 'preview1';
    return `${redirectBase}/r/${slug}`;
  }, [qrHubUrl, qrPayloadUrl, redirectSlug]);

  // Theme the QR to match the card body.
  const qrColors = useMemo(() => {
    if (printMerged.theme === 'black') return { dark: '#ffffff', light: '#0b0b0c' };
    if (printMerged.theme === 'neon')  return { dark: '#a3e635', light: '#020617' };
    return { dark: '#0f172a', light: '#ffffff' };
  }, [printMerged.theme]);

  /** Outer box for the QR mount (inner drawable = outer − padding, see effect). */
  const baseQrSize = Math.round(Math.min(widthPx, heightPx) * 0.28);
  const frontQrOuter = baseQrSize;
  const backQrOuter = Math.round(baseQrSize * 0.7);

  // Paint after refs attach (useEffect + rAF retries). Do not set data-qr-ready from
  // a timer without a real canvas — that caused empty QR in Puppeteer PNGs.
  useEffect(() => {
    const shouldFaceQr = face === 'back' ? showBackQr : showFrontQr;

    const clearBothMounts = () => {
      if (qrFrontRef.current) qrFrontRef.current.innerHTML = '';
      if (qrBackRef.current) qrBackRef.current.innerHTML = '';
    };

    if (!shouldFaceQr) {
      clearBothMounts();
      setQrReady(true);
      return undefined;
    }

    setQrReady(false);
    let cancelled = false;
    let attempt = 0;
    const MAX_REF_ATTEMPTS = 20;

    const pad = face === 'back' ? 8 : 12;
    const outer = face === 'back' ? backQrOuter : frontQrOuter;
    const drawSize = Math.max(48, outer - pad);

    const paint = () => {
      clearBothMounts();
      const target = face === 'back' ? qrBackRef.current : qrFrontRef.current;
      if (cancelled || !target?.isConnected) return;

      const canvas = document.createElement('canvas');
      QRCode.toCanvas(
        canvas,
        qrDataString,
        {
          width: drawSize,
          margin: 1,
          color: {
            dark: qrColors.dark,
            light: qrColors.light,
          },
          errorCorrectionLevel: 'H',
        },
        (err) => {
          if (cancelled) return;
          if (!target.isConnected) return;
          if (err) {
            if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
              // eslint-disable-next-line no-console
              console.warn('BusinessCardPrintPreview QR render failed', err);
            }
            setQrReady(true);
            return;
          }
          canvas.style.display = 'block';
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          canvas.style.objectFit = 'contain';
          target.appendChild(canvas);
          setQrReady(true);
        }
      );
    };

    const tryPaint = () => {
      if (cancelled) return;
      const el = face === 'back' ? qrBackRef.current : qrFrontRef.current;
      if (!el) {
        attempt += 1;
        if (attempt < MAX_REF_ATTEMPTS) {
          requestAnimationFrame(tryPaint);
          return;
        }
        if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
          // eslint-disable-next-line no-console
          console.warn('BusinessCardPrintPreview: QR mount ref missing after retries');
        }
        setQrReady(true);
        return;
      }
      paint();
    };

    requestAnimationFrame(tryPaint);

    return () => {
      cancelled = true;
    };
  }, [qrDataString, qrColors, face, printMerged.qrPosition, printMerged.includeQr, qrPlacement, showBackQr, showFrontQr, frontQrOuter, backQrOuter]);

  // Position the QR on the card (`print.qrPosition`) for whichever face shows it.
  const qrPad = Math.round(safeInset);
  const qrPositionStyle = useMemo(() => {
    const map = {
      'top-left':     { left: qrPad, top: qrPad },
      'top-right':    { right: qrPad, top: qrPad },
      'top-center':   { left: '50%', top: qrPad, transform: 'translateX(-50%)' },
      'bottom-left':  { left: qrPad, bottom: qrPad },
      'bottom-right': { right: qrPad, bottom: qrPad },
      'center':       { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' },
    };
    return map[printMerged.qrPosition] || map['bottom-right'];
  }, [printMerged.qrPosition, qrPad]);

  const display = useMemo(() => {
    const fields = printMerged.displayFields || ['name', 'jobTitle', 'company', 'phone', 'email', 'website'];
    const set = new Set(fields);
    return (k) => set.has(k);
  }, [printMerged.displayFields]);

  /* ── Wrapper ───────────────────────────────────────────────────────── */
  const isPrint = mode === 'print';
  const scale = isPrint ? 1 : Math.min(1, previewWidth / widthPx);

  return (
    <div
      style={{
        // Reserve scaled box height so surrounding flow is correct in preview.
        width: isPrint ? `${widthPx}px` : `${widthPx * scale}px`,
        height: isPrint ? `${heightPx}px` : `${heightPx * scale}px`,
      }}
    >
      <div
        data-qr-ready={qrReady ? '1' : '0'}
        style={{
          width: `${widthPx}px`,
          height: `${heightPx}px`,
          background: colors.bg,
          color: colors.fg,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: `${design?.font || 'Inter'}, system-ui, sans-serif`,
          transform: isPrint ? 'none' : `scale(${scale})`,
          transformOrigin: 'top left',
          borderRadius: isPrint ? 0 : 12,
          boxShadow: isPrint ? 'none' : '0 14px 36px rgba(2,6,23,0.45)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility: face === 'front' ? 'visible' : 'hidden',
            pointerEvents: face === 'front' ? 'auto' : 'none',
          }}
        >
          <PrintCardFrontFace
            qrFrontRef={qrFrontRef}
            content={content}
            accent={accent}
            colors={colors}
            widthPx={widthPx}
            heightPx={heightPx}
            safeInset={safeInset}
            profileCropX={printMerged.profileCropX}
            profileCropY={printMerged.profileCropY}
            profileZoom={printMerged.profileZoom}
            display={display}
            frontQrOuter={frontQrOuter}
            qrPositionStyle={qrPositionStyle}
            printTheme={printMerged.theme}
            qrLight={qrColors.light}
            showFrontQr={showFrontQr}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility: face === 'back' ? 'visible' : 'hidden',
            pointerEvents: face === 'back' ? 'auto' : 'none',
          }}
        >
          <PrintCardBackFace
            qrBackRef={qrBackRef}
            content={content}
            accent={accent}
            designSecondary={design?.colors?.secondary}
            colors={colors}
            heightPx={heightPx}
            safeInset={safeInset}
            showBackQr={showBackQr}
            backQrOuter={backQrOuter}
            qrPositionStyle={qrPositionStyle}
            qrLight={qrColors.light}
          />
        </div>
      </div>
    </div>
  );
};

export default BusinessCardPrintPreview;
