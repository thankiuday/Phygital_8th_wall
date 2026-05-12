import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import publicApi from '../services/publicApi';
import { getCardSize } from '../components/card/cardSizes';
import BusinessCardPrintPreview from '../components/card/BusinessCardPrintPreview';

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
  const res = await publicApi.get(`/public/card/${id}/meta`);
  return res.data.data;
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

  // Mark ready when fonts + images settle. The preview component paints its
  // own QR; we just wait until everything is laid out before signalling.
  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    const ready = async () => {
      try { await document.fonts?.ready; } catch {/* ignore */}
      const imgs = Array.from(document.querySelectorAll('img'));
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((res) => {
                img.addEventListener('load', res, { once: true });
                img.addEventListener('error', res, { once: true });
              })
        )
      );
      // Wait until QR SVG is mounted by the preview component.
      const waitForQr = async () => {
        const t0 = Date.now();
        while (Date.now() - t0 < 10_000) {
          const qrReady = document.querySelector('[data-qr-ready="1"]');
          if (qrReady) return;
          await new Promise((res) => setTimeout(res, 50));
        }
      };
      await waitForQr();
      // 2 RAFs so QR-styling SVG flushes + any lingering layout settles.
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      if (!cancelled) document.documentElement.setAttribute('data-print-ready', '1');
    };
    ready();
    return () => { cancelled = true; };
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
        print={meta.cardPrintSettings || {}}
        face={face}
        mode="print"
        redirectSlug={meta.redirectSlug}
        cardSlug={meta.cardSlug}
      />
    </div>
  );
};

export default DigitalCardPrintPage;
