import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import QRCodeStyling from 'qr-code-styling';

import { getCardSize } from './cardSizes';

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
 * QR code: generated client-side via qr-code-styling, themed (white/black/
 * neon) and positioned per `print.qrPosition`. `print.qrPlacement` controls
 * whether the scanner appears on front, back, or both faces.
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

const BusinessCardPrintPreview = ({
  content = {},
  design = {},
  print = {},
  face = 'front',
  mode = 'preview',
  previewWidth = 340,
  redirectSlug = null,
  cardSlug = null,
}) => {
  const sizeSpec = useMemo(() => getCardSize(print.cardSize), [print.cardSize]);
  const widthPx = sizeSpec.bleed.widthPx;
  const heightPx = sizeSpec.bleed.heightPx;
  const safeInset = sizeSpec.safe.insetPx;

  const colors = themeColors(print.theme);
  const accent = design?.colors?.primary || '#3b82f6';

  const qrRef = useRef(null);
  const [qrReady, setQrReady] = useState(false);
  const qrPlacement = print.qrPlacement || 'both';
  const showFrontQr = !!print.includeQr && (qrPlacement === 'front' || qrPlacement === 'both');
  const showBackQr = !!print.includeQr && (qrPlacement === 'back' || qrPlacement === 'both');

  // Build the QR target URL from the campaign's permanent short slug.
  // We use a stable preview slug while the wizard is still pre-save, so
  // the QR's payload length matches the post-save payload — preserving
  // the matrix density of the printed card.
  const qrUrl = useMemo(() => {
    const redirectBase =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_REDIRECT_BASE)
      || ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '').replace(/\/api\/?$/, '').replace(/\/$/, '')
      || (typeof window !== 'undefined' ? window.location.origin : '');
    const slug = redirectSlug || cardSlug || 'preview1';
    return `${redirectBase}/r/${slug}`;
  }, [redirectSlug, cardSlug]);

  // Theme the QR to match the card body.
  const qrColors = useMemo(() => {
    if (print.theme === 'black') return { dark: '#ffffff', light: '#0b0b0c' };
    if (print.theme === 'neon')  return { dark: '#a3e635', light: '#020617' };
    return { dark: '#0f172a', light: '#ffffff' };
  }, [print.theme]);

  // Re-paint QR when its inputs change. We attach to a stable ref and clear
  // the container before each append so we don't stack SVGs across updates.
  useLayoutEffect(() => {
    if (!qrRef.current) return;
    const shouldRenderQr = face === 'back' ? showBackQr : showFrontQr;
    if (!shouldRenderQr) {
      qrRef.current.innerHTML = '';
      setQrReady(true);
      return;
    }
    setQrReady(false);
    const qrSize = Math.round(Math.min(widthPx, heightPx) * 0.28);
    const qr = new QRCodeStyling({
      type: 'svg',
      width: qrSize,
      height: qrSize,
      data: qrUrl,
      qrOptions: { errorCorrectionLevel: 'H' },
      dotsOptions: { type: 'rounded', color: qrColors.dark },
      backgroundOptions: { color: qrColors.light },
      cornersSquareOptions: { type: 'extra-rounded', color: qrColors.dark },
      cornersDotOptions: { type: 'dot', color: qrColors.dark },
    });
    qrRef.current.innerHTML = '';
    qr.append(qrRef.current);
    let raf = 0;
    const waitForPaint = () => {
      const node = qrRef.current?.querySelector('svg,canvas');
      if (!node) {
        raf = requestAnimationFrame(waitForPaint);
        return;
      }
      if (node.tagName.toLowerCase() === 'canvas') {
        if (node.width > 0 && node.height > 0) {
          setQrReady(true);
          return;
        }
      } else if (node.querySelector('*')) {
        setQrReady(true);
        return;
      }
      raf = requestAnimationFrame(waitForPaint);
    };
    raf = requestAnimationFrame(waitForPaint);
    return () => cancelAnimationFrame(raf);
  }, [qrUrl, qrColors, widthPx, heightPx, face, print.qrPosition, print.includeQr, qrPlacement, showBackQr, showFrontQr]);

  // Position the QR according to `print.qrPosition`. Used for the front
  // face only when `includeQr` is on; the back always pins a small QR
  // bottom-right so a one-sided print is still scannable.
  const qrSize = Math.round(Math.min(widthPx, heightPx) * 0.28);
  const qrPad = Math.round(safeInset);
  const qrPositionStyle = (() => {
    const map = {
      'top-left':     { left: qrPad, top: qrPad },
      'top-right':    { right: qrPad, top: qrPad },
      'top-center':   { left: '50%', top: qrPad, transform: 'translateX(-50%)' },
      'bottom-left':  { left: qrPad, bottom: qrPad },
      'bottom-right': { right: qrPad, bottom: qrPad },
      'center':       { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' },
    };
    return map[print.qrPosition] || map['bottom-right'];
  })();

  const display = useMemo(() => {
    const fields = print.displayFields || ['name', 'jobTitle', 'company', 'phone', 'email', 'website'];
    const set = new Set(fields);
    return (k) => set.has(k);
  }, [print.displayFields]);

  const profileTransform = `translate(-50%, -50%) scale(${print.profileZoom || 1})`;

  /* ── Faces ─────────────────────────────────────────────────────────── */
  const FrontFace = () => (
    <>
      {/* Subtle accent watermark */}
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

      {/* Profile circular crop with zoom + crop X/Y */}
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
              backgroundPosition: `${print.profileCropX ?? 50}% ${print.profileCropY ?? 50}%`,
              transform: profileTransform,
            }}
          />
        </div>
      )}

      {/* Identity column (left side) */}
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
            }}>
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

      {/* QR on front based on placement setting */}
      {showFrontQr && (
        <div
          ref={qrRef}
          style={{
            position: 'absolute',
            width: qrSize,
            height: qrSize,
            padding: 6,
            borderRadius: 10,
            backgroundColor: print.theme === 'white' ? '#ffffff' : qrColors.light,
            ...qrPositionStyle,
          }}
        />
      )}
    </>
  );

  const BackFace = () => {
    const initial = (content.company || content.fullName || 'C').trim().charAt(0).toUpperCase();
    return (
      <>
        {/* Bold brand backdrop */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(135deg, ${accent} 0%, ${design?.colors?.secondary || accent} 100%)`,
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
          {/* Logo / company initial badge */}
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
            {initial}
          </div>

          {content.company && (
            <div style={{
              fontSize: heightPx * 0.085,
              fontWeight: 800,
              letterSpacing: 2,
              textTransform: 'uppercase',
              lineHeight: 1.1,
            }}>
              {content.company}
            </div>
          )}

          {(content.tagline || content.bio) && (
            <div style={{
              fontSize: heightPx * 0.04,
              maxWidth: '80%',
              opacity: 0.85,
              fontStyle: 'italic',
            }}>
              {content.tagline || (content.bio?.length > 100 ? `${content.bio.slice(0, 100)}…` : content.bio)}
            </div>
          )}
        </div>

        {/* QR on back based on placement setting */}
        {showBackQr && (
          <div
            ref={qrRef}
            style={{
              position: 'absolute',
              right: qrPad,
              bottom: qrPad,
              width: qrSize * 0.7,
              height: qrSize * 0.7,
              padding: 4,
              borderRadius: 8,
              backgroundColor: qrColors.light,
            }}
          />
        )}
      </>
    );
  };

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
        {face === 'back' ? <BackFace /> : <FrontFace />}
      </div>
    </div>
  );
};

export default BusinessCardPrintPreview;
