import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

import { publicService } from '../services/publicService';
import BusinessCardLivePreview from '../components/card/BusinessCardLivePreview';

const visitorHashKey = 'card-visitor-hash';

const ensureVisitorHash = () => {
  let h = localStorage.getItem(visitorHashKey);
  if (!h) {
    h = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(visitorHashKey, h);
  }
  return h;
};

const detectDeviceType = () => {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  if (/Mobi|Android/i.test(ua)) return 'mobile';
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  return 'desktop';
};

const detectBrowser = () => {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'chrome';
  if (/Edg\//.test(ua)) return 'edge';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Safari\//.test(ua)) return 'safari';
  return 'other';
};

/**
 * DigitalCardPublicPage — public hub for `/card/:slug`. Renders the shared
 * `BusinessCardLivePreview` in `mode="public"` and wires telemetry beacons:
 *
 *   • One `scan` on first paint.
 *   • One `action` per call/email/whatsapp/website/social/etc tap.
 *   • One `session` on `pagehide` with the total dwell time.
 */
const DigitalCardPublicPage = () => {
  const { slug } = useParams();
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const sessionStartRef = useRef(Date.now());
  const visitorHash = useMemo(ensureVisitorHash, []);

  useEffect(() => {
    let cancelled = false;
    publicService
      .getCardMeta(slug)
      .then((data) => {
        if (cancelled) return;
        setState({ status: 'ready', data, error: null });
        publicService.recordCardScan(slug, {
          visitorHash,
          deviceType: detectDeviceType(),
          browser: detectBrowser(),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        const code = err?.response?.status;
        const msg = err?.response?.data?.message || 'Card not found';
        setState({ status: code === 404 ? 'not-found' : 'error', data: null, error: msg });
      });
    return () => { cancelled = true; };
  }, [slug, visitorHash]);

  // pagehide beacon for total session dwell.
  useEffect(() => {
    const onUnload = () => {
      const ms = Date.now() - sessionStartRef.current;
      try {
        const blob = new Blob(
          [JSON.stringify({ visitorHash, sessionDurationMs: ms })],
          { type: 'application/json' }
        );
        // sendBeacon survives unload; fall back to fetch keepalive.
        if (navigator.sendBeacon) {
          navigator.sendBeacon(`/api/public/card/${slug}/session`, blob);
        } else {
          publicService.recordCardSession(slug, { visitorHash, sessionDurationMs: ms });
        }
      } catch {/* ignore */}
    };
    window.addEventListener('pagehide', onUnload);
    return () => window.removeEventListener('pagehide', onUnload);
  }, [slug, visitorHash]);

  const onAction = (action, target) => {
    publicService.recordCardAction(slug, { action, target, visitorHash });
  };

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-200">
        Loading…
      </div>
    );
  }

  if (state.status === 'not-found' || state.status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-center text-slate-200">
        <h1 className="mb-2 text-2xl font-bold">Card unavailable</h1>
        <p className="text-sm text-slate-400">{state.error}</p>
      </div>
    );
  }

  const { cardContent, cardDesign, paused, campaignName } = state.data;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 sm:py-12">
      <Helmet>
        <title>{cardContent?.fullName || campaignName} – Digital Business Card</title>
        <meta name="description" content={cardContent?.bio || campaignName} />
        <meta property="og:title" content={cardContent?.fullName || campaignName} />
        {cardContent?.profileImageUrl && (
          <meta property="og:image" content={cardContent.profileImageUrl} />
        )}
      </Helmet>

      <div className="mx-auto max-w-md">
        {paused && (
          <div className="mb-3 rounded-md bg-amber-500/10 p-3 text-xs text-amber-300">
            This card is currently paused by its owner.
          </div>
        )}
        <BusinessCardLivePreview
          content={cardContent}
          design={cardDesign}
          mode="public"
          onAction={onAction}
        />
        <p className="mt-3 text-center text-[11px] text-slate-500">
          Powered by Phygital8thWall
        </p>
      </div>
    </div>
  );
};

export default DigitalCardPublicPage;
