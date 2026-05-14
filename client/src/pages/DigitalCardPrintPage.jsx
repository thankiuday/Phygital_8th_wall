import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import publicApi from '../services/publicApi';
import { getCardSize } from '../components/card/cardSizes';
import BusinessCardPrintPreview, {
  mergeCardPrintSettings,
} from '../components/card/BusinessCardPrintPreview';

const EMPTY_PRINT = {};

/**
 * DigitalCardPrintPage — what Puppeteer screenshots.
 *
 * Contract:
 *   • The route is `/print/card/:id?size=us&face=front&token=…`.
 *   • Token is HMAC-signed by the server and verified client-side via
 *     `/public/card/print-token/verify`. Without a valid token we render an
 *     error page so direct URL access still cannot trigger renders.
 *   • Once content + QR + fonts are settled we paint
 *     `data-print-ready="1"` on `<html>` so Puppeteer's
 *     `waitForSelector('[data-print-ready="1"]')` resolves.
 *
 * The page delegates the actual visual to `BusinessCardPrintPreview` so the
 * Step 4 wizard preview and the rendered PNG are the same component, byte
 * for byte. One render = one face (the worker calls this page twice).
 */

const fetchPublicMeta = async (id) => {
  /** Avoid stale 304 / browser cache from serving card without `cardPrintSettings` / `redirectUrl` / `publicUrl`. */
  const res = await publicApi.get(`/public/card/${id}/meta`, {
    params: { _: Date.now() },
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  const body = res.data;
  const payload = body && typeof body === 'object' ? body.data : null;
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid card meta response');
  }
  return payload;
};

const verifyPrintToken = async (token, campaignId) => {
  if (!token) return false;
  try {
    const res = await publicApi.get('/public/card/print-token/verify', {
      params: { token, campaignId },
    });
    return !!res.data.data?.valid;
  } catch {
    return false;
  }
};

const DigitalCardPrintPage = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const size = params.get('size') || 'us';
  const face = params.get('face') === 'back' ? 'back' : 'front';
  const token = params.get('token') || '';
  const campaignId = params.get('campaignId') || id;

  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);

  const sizeSpec = useMemo(() => getCardSize(size), [size]);

  useEffect(() => {
    (async () => {
      const ok = await verifyPrintToken(token, campaignId);
      if (!ok) {
        setError('Invalid or expired print token');
        return;
      }
      try {
        const data = await fetchPublicMeta(id);
        setMeta(data);
      } catch (err) {
        setError(err?.response?.data?.message || 'Card not found');
      }
    })();
  }, [id, token, campaignId]);

  // Mark ready when fonts settle, QR flag + canvas (if QR enabled for this face),
  // profile images decoded, then layout flushes.
  useEffect(() => {
    if (!meta) return;
    let cancelled = false;

    const expectQrCanvas = () => {
      const merged = mergeCardPrintSettings(meta.cardPrintSettings);
      const includeQr = merged.includeQr !== false;
      const placement = merged.qrPlacement || 'back';
      const wantFront = placement === 'front' || placement === 'both';
      const wantBack = placement === 'back' || placement === 'both';
      return includeQr && (face === 'back' ? wantBack : wantFront);
    };

    const waitAllImages = () => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((res) => {
                img.addEventListener('load', res, { once: true });
                img.addEventListener('error', res, { once: true });
              })
        )
      );
    };

    const decodeImages = () =>
      Promise.all(
        Array.from(document.querySelectorAll('img')).map((img) =>
          typeof img.decode === 'function'
            ? img.decode().catch(() => {})
            : Promise.resolve()
        )
      );

    const waitForQrFlag = async () => {
      const t0 = Date.now();
      while (Date.now() - t0 < 15_000) {
        const qrReady = document.querySelector('[data-qr-ready="1"]');
        if (qrReady) return;
        await new Promise((res) => setTimeout(res, 40));
      }
    };

    /** After flag, ensure a canvas exists when this face should show a QR (Puppeteer must not snapshot an empty mount). */
    const waitForQrCanvasIfNeeded = async () => {
      if (!expectQrCanvas()) return;
      const t0 = Date.now();
      while (Date.now() - t0 < 10_000) {
        if (cancelled) return;
        const root = document.querySelector('[data-qr-ready="1"]');
        if (root?.querySelector('canvas')) return;
        await new Promise((res) => setTimeout(res, 40));
      }
    };

    const ready = async () => {
      try {
        await document.fonts?.ready;
      } catch {/* ignore */}
      await waitForQrFlag();
      await waitForQrCanvasIfNeeded();
      await waitAllImages();
      await decodeImages();
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      if (!cancelled) document.documentElement.setAttribute('data-print-ready', '1');
    };
    ready();
    return () => {
      cancelled = true;
      document.documentElement.removeAttribute('data-print-ready');
    };
  }, [meta, face]);

  if (error) {
    return <div style={{ padding: 40, fontFamily: 'system-ui' }}>Error: {error}</div>;
  }
  if (!meta) {
    return <div style={{ padding: 40, fontFamily: 'system-ui' }}>Preparing card…</div>;
  }

  // Pin the body to the bleed canvas so Puppeteer's clip is exact.
  return (
    <div
      style={{
        margin: 0,
        padding: 0,
        background: '#000',
        width: `${sizeSpec.bleed.widthPx}px`,
        height: `${sizeSpec.bleed.heightPx}px`,
      }}
    >
      <BusinessCardPrintPreview
        content={meta.cardContent || {}}
        design={meta.cardDesign || {}}
        print={meta.cardPrintSettings ?? EMPTY_PRINT}
        face={face}
        mode="print"
        redirectSlug={meta.redirectSlug}
        qrHubUrl={meta.publicUrl || null}
        qrPayloadUrl={meta.redirectUrl || null}
      />
    </div>
  );
};

export default DigitalCardPrintPage;
