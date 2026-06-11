import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';

import { resolveCardImageUrl } from '../../utils/assetUrl';
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
  if (themeId === 'black') {
    return {
      bg: '#0b0b0c',
      fg: '#ffffff',
      muted: 'rgba(255,255,255,0.65)',
      qrFrame: '#0b0b0c',
      wash: 'rgba(255,255,255,0.08)',
    };
  }
  if (themeId === 'neon') {
    return {
      bg: '#020617',
      fg: '#a3e635',
      muted: 'rgba(163,230,53,0.65)',
      qrFrame: '#020617',
      wash: 'rgba(163,230,53,0.14)',
    };
  }
  return {
    bg: '#ffffff',
    fg: '#0f172a',
    muted: 'rgba(15,23,42,0.65)',
    qrFrame: '#ffffff',
    wash: 'rgba(15,23,42,0.06)',
  };
};

const fmt = {
  phone: (s) => (s ? String(s).trim() : ''),
  email: (s) => (s ? String(s).trim() : ''),
  url:   (s) => (s ? String(s).replace(/^https?:\/\//, '') : ''),
};

const CONTACT_FIELD_DEFS = [
  {
    key: 'tagline',
    label: 'Tagline',
    faces: ['front'],
    check: (content, display) => display('tagline') && !!content.tagline,
    value: (content) => String(content.tagline).trim(),
  },
  {
    key: 'phone',
    label: 'Phone',
    faces: ['front'],
    check: (content, display) => display('phone') && !!content.contact?.phone,
    value: (content) => fmt.phone(content.contact.phone),
  },
  {
    key: 'email',
    label: 'Email',
    faces: ['front'],
    check: (content, display) => display('email') && !!content.contact?.email,
    value: (content) => fmt.email(content.contact.email),
  },
  {
    key: 'address',
    label: 'Address',
    faces: ['front'],
    check: (content, display) => display('address') && !!(content.contact?.address || content.address),
    value: (content) => String(content.contact?.address || content.address).trim(),
  },
  {
    key: 'website',
    label: 'Website',
    faces: ['front'],
    check: (content, display) => display('website') && !!content.contact?.website,
    value: (content) => fmt.url(content.contact.website),
  },
];

const contactRowsForFace = (content, display, face) =>
  CONTACT_FIELD_DEFS
    .filter((def) => def.faces.includes(face) && def.check(content, display))
    .map((def) => ({ key: def.key, label: def.label, value: def.value(content) }));

function PrintAccentRule({ accent, heightPx, width = '100%' }) {
  return (
    <div
      style={{
        width,
        height: Math.max(2, Math.round(heightPx * 0.006)),
        background: `linear-gradient(90deg, ${accent} 0%, transparent 100%)`,
        opacity: 0.55,
        margin: `${heightPx * 0.018}px 0`,
      }}
    />
  );
}

function PrintContactList({ rows, colors, accent, heightPx }) {
  if (!rows.length) return null;
  const labelSize = heightPx * 0.028;
  const valueSize = heightPx * 0.036;
  const labelCol = Math.round(heightPx * 0.2);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: heightPx * 0.012, width: '100%' }}>
      {rows.map((row) => (
        <div
          key={row.key}
          style={{
            display: 'grid',
            gridTemplateColumns: `${labelCol}px 1fr`,
            gap: heightPx * 0.01,
            alignItems: 'start',
          }}
        >
          <div
            style={{
              fontSize: labelSize,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              color: accent,
              lineHeight: 1.3,
              paddingTop: 1,
            }}
          >
            {row.label}
          </div>
          <div
            style={{
              fontSize: valueSize,
              color: colors.muted,
              lineHeight: 1.35,
              wordBreak: 'break-word',
              fontStyle: row.key === 'tagline' ? 'italic' : 'normal',
            }}
          >
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function PrintProfilePhoto({
  profileImageSrc,
  profileCropX,
  profileCropY,
  profileZoom,
  sizePx,
  accent,
}) {
  if (!profileImageSrc) return null;
  const profileTransform = `translate(-50%, -50%) scale(${profileZoom || 1})`;
  return (
    <div
      style={{
        width: sizePx,
        height: sizePx,
        borderRadius: '50%',
        overflow: 'hidden',
        border: `${Math.max(2, Math.round(sizePx * 0.022))}px solid ${accent}`,
        boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '160%',
          height: '160%',
          backgroundImage: `url(${profileImageSrc})`,
          backgroundSize: 'cover',
          backgroundPosition: `${profileCropX ?? 50}% ${profileCropY ?? 50}%`,
          transform: profileTransform,
        }}
      />
    </div>
  );
}

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
  showFrontQr,
}) {
  const profileImageSrc = resolveCardImageUrl(content.profileImagePreview, content.profileImageUrl);
  const contactRows = contactRowsForFace(content, display, 'front');
  const hasIdentity = (display('name') && content.fullName)
    || (display('jobTitle') && content.jobTitle)
    || (display('company') && content.company);
  const photoSize = heightPx * (contactRows.length > 2 ? 0.46 : 0.52);
  const textMaxWidth = profileImageSrc ? '56%' : '100%';

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: colors.bg }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: Math.max(4, Math.round(widthPx * 0.012)),
          background: accent,
          opacity: 0.85,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -widthPx * 0.12,
          top: -heightPx * 0.35,
          width: widthPx * 0.55,
          height: heightPx,
          background: `linear-gradient(135deg, ${accent} 0%, transparent 70%)`,
          opacity: 0.1,
          transform: 'rotate(12deg)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: `${safeInset}px`,
          display: 'flex',
          alignItems: 'stretch',
          gap: heightPx * 0.03,
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            maxWidth: textMaxWidth,
            paddingLeft: Math.round(widthPx * 0.02),
          }}
        >
          {hasIdentity && (
            <div>
              {display('name') && content.fullName && (
                <div style={{
                  fontSize: heightPx * 0.1,
                  fontWeight: 800,
                  lineHeight: 1.05,
                  letterSpacing: -0.4,
                  color: colors.fg,
                }}
                >
                  {content.fullName}
                </div>
              )}
              {display('jobTitle') && content.jobTitle && (
                <div style={{ fontSize: heightPx * 0.048, marginTop: heightPx * 0.008, color: colors.muted }}>
                  {content.jobTitle}
                </div>
              )}
              {display('company') && content.company && (
                <div style={{
                  fontSize: heightPx * 0.04,
                  marginTop: heightPx * 0.006,
                  color: accent,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                }}
                >
                  {content.company}
                </div>
              )}
            </div>
          )}

          {contactRows.length > 0 && (
            <div style={{ marginTop: 'auto', paddingTop: heightPx * 0.02 }}>
              {hasIdentity && <PrintAccentRule accent={accent} heightPx={heightPx} />}
              <PrintContactList rows={contactRows} colors={colors} accent={accent} heightPx={heightPx} />
            </div>
          )}
        </div>

        {profileImageSrc && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <PrintProfilePhoto
              profileImageSrc={profileImageSrc}
              profileCropX={profileCropX}
              profileCropY={profileCropY}
              profileZoom={profileZoom}
              sizePx={photoSize}
              accent={accent}
            />
          </div>
        )}
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
            backgroundColor: colors.qrFrame,
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

/** Back face — minimal: company (optional), QR, scan prompt. All contact details live on the front. */
function PrintCardBackFace({
  qrBackRef,
  content,
  accent,
  designSecondary,
  colors,
  widthPx,
  heightPx,
  safeInset,
  showBackQr,
  backQrOuter,
  printTheme,
  display,
}) {
  const secondary = designSecondary || accent;
  const showCompany = display('company') && content.company;

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: colors.bg }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, ${accent} 0%, ${secondary} 100%)`,
          opacity: printTheme === 'white' ? 0.1 : 0.18,
        }}
      />
      <div style={{ position: 'absolute', inset: 0, background: colors.wash }} />

      <div
        style={{
          position: 'absolute',
          inset: `${safeInset}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: heightPx * 0.02,
          paddingLeft: Math.round(widthPx * 0.06),
          paddingRight: Math.round(widthPx * 0.06),
        }}
      >
        {showCompany && (
          <div
            style={{
              fontSize: heightPx * 0.052,
              fontWeight: 700,
              letterSpacing: 1.3,
              textTransform: 'uppercase',
              color: accent,
              lineHeight: 1.2,
              maxWidth: '100%',
              wordBreak: 'break-word',
            }}
          >
            {content.company}
          </div>
        )}

        {showBackQr && (
          <>
            <div
              ref={qrBackRef}
              style={{
                width: backQrOuter,
                height: backQrOuter,
                padding: 6,
                boxSizing: 'border-box',
                borderRadius: 10,
                backgroundColor: colors.qrFrame,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            />
            <div
              style={{
                fontSize: heightPx * 0.032,
                letterSpacing: 1,
                textTransform: 'uppercase',
                fontWeight: 600,
                color: colors.muted,
                lineHeight: 1.3,
              }}
            >
              Scan here
            </div>
          </>
        )}
      </div>
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
  const backQrOuter = Math.round(Math.min(widthPx, heightPx) * 0.34);

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
            background: colors.bg,
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
            showFrontQr={showFrontQr}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: colors.bg,
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
            widthPx={widthPx}
            heightPx={heightPx}
            safeInset={safeInset}
            showBackQr={showBackQr}
            backQrOuter={backQrOuter}
            printTheme={printMerged.theme}
            display={display}
          />
        </div>
      </div>
    </div>
  );
};

export default BusinessCardPrintPreview;
