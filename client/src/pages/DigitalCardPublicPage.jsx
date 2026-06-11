import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { MapPin } from 'lucide-react';

import { publicService } from '../services/publicService';
import BusinessCardLivePreview from '../components/card/BusinessCardLivePreview';
import BrandLockup from '../components/ui/BrandLockup';
import PublicQuickLinksMenu from '../components/hub/PublicQuickLinksMenu';
import PoweredByPhygitalFooter from '../components/hub/PoweredByPhygitalFooter';

const visitorHashKey = 'card-visitor-hash';
const GEO_CONSENT_VERSION = 'browser-geolocation-v1';

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
 *   • One `scan` on first paint (with optional browser GPS when enabled).
 *   • One `action` per call/email/whatsapp/website/social/etc tap.
 *   • One `session` on `pagehide` with the total dwell time.
 */
const DigitalCardPublicPage = () => {
  const { slug } = useParams();
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [geoPrompt, setGeoPrompt] = useState(false);
  const [geoStatus, setGeoStatus] = useState('');
  const sessionStartRef = useRef(Date.now());
  const scanRecordedRef = useRef(false);
  const visitorHash = useMemo(ensureVisitorHash, []);

  const recordScan = useCallback((extra = {}) => {
    if (scanRecordedRef.current) return;
    scanRecordedRef.current = true;
    publicService.recordCardScan(slug, {
      visitorHash,
      deviceType: detectDeviceType(),
      browser: detectBrowser(),
      ...extra,
    });
  }, [slug, visitorHash]);

  const finishGeoFlow = useCallback((coords = {}) => {
    setGeoPrompt(false);
    recordScan(coords);
  }, [recordScan]);

  const tryPreciseGeo = useCallback(() => {
    if (!window.isSecureContext) {
      setGeoStatus('Location needs HTTPS. Continuing with approximate location only.');
      finishGeoFlow();
      return;
    }
    if (!navigator.geolocation) {
      finishGeoFlow();
      return;
    }
    setGeoStatus('Waiting for permission…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        finishGeoFlow({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          consentVersion: GEO_CONSENT_VERSION,
        });
      },
      () => {
        finishGeoFlow();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [finishGeoFlow]);

  useEffect(() => {
    let cancelled = false;
    publicService
      .getCardMeta(slug)
      .then((data) => {
        if (cancelled) return;
        setState({ status: 'ready', data, error: null });
        if (data.preciseGeoAnalytics) {
          setGeoPrompt(true);
        } else {
          recordScan();
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const code = err?.response?.status;
        const msg = err?.response?.data?.message || 'Card not found';
        setState({ status: code === 404 ? 'not-found' : 'error', data: null, error: msg });
      });
    return () => { cancelled = true; };
  }, [slug, recordScan]);

  // pagehide beacon for total session dwell.
  useEffect(() => {
    const onUnload = () => {
      const ms = Date.now() - sessionStartRef.current;
      try {
        const blob = new Blob(
          [JSON.stringify({ visitorHash, sessionDurationMs: ms })],
          { type: 'application/json' }
        );
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1e293b,_#0f172a_45%,_#020617_100%)] px-3 py-6 sm:px-4 sm:py-10">

      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between">
        <BrandLockup variant="compact" className="[&_.brand-word]:brightness-110" />
        <PublicQuickLinksMenu theme="dark" />
      </div>

      <Helmet>
        <title>{cardContent?.fullName || campaignName} – Digital Business Card</title>
        <meta name="description" content={cardContent?.bio || campaignName} />
        <meta property="og:title" content={cardContent?.fullName || campaignName} />
        {cardContent?.profileImageUrl && (
          <meta property="og:image" content={cardContent.profileImageUrl} />
        )}
      </Helmet>

      <div className="mx-auto w-full max-w-3xl">
        {geoPrompt && (
          <div className="mb-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-slate-200">
            <div className="flex items-start gap-3">
              <MapPin size={18} className="mt-0.5 shrink-0 text-cyan-300" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">Share your location? (optional)</p>
                <p className="mt-1 text-xs text-slate-300">
                  Helps the card owner see where visitors open their card. You can skip — approximate location is still collected.
                </p>
                {geoStatus && <p className="mt-2 text-xs text-cyan-200">{geoStatus}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={tryPreciseGeo}
                    className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"
                  >
                    Share location
                  </button>
                  <button
                    type="button"
                    onClick={() => finishGeoFlow()}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
                  >
                    Skip
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {paused && (
          <div className="mb-3 rounded-md bg-amber-500/10 p-3 text-xs text-amber-300">
            This card is currently paused by its owner.
          </div>
        )}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-2 shadow-2xl backdrop-blur-sm sm:p-4">
          <BusinessCardLivePreview
            content={cardContent}
            design={cardDesign}
            mode="public"
            onAction={onAction}
          />
        </div>
        <PoweredByPhygitalFooter theme="dark" />
      </div>
    </div>
  );
};

export default DigitalCardPublicPage;
