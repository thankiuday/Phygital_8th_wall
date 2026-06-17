import { useEffect, useRef } from 'react';
import { bootEmbeddedSurfaceAr, teardownEmbeddedSurfaceAr } from '../../ar/launchSurfaceAr.js';
import '../../ar/surfaceArUi.css';

/**
 * Fullscreen host for embedded surface AR launched from the landing page.
 */
const SurfaceArHost = ({
  campaign,
  sessionId,
  sessionPromise,
  surfaceBackend,
  onClose,
  onError,
  onReady,
}) => {
  const bootedRef = useRef(false);

  useEffect(() => {
    const needsSession = surfaceBackend !== 'eighthwall-slam';
    if (!campaign || bootedRef.current) return undefined;
    if (needsSession && !sessionPromise) return undefined;

    bootedRef.current = true;

    let cancelled = false;

    (async () => {
      const experience = await bootEmbeddedSurfaceAr({
        campaign,
        sessionId,
        sessionPromise: needsSession ? sessionPromise : null,
        surfaceBackend,
        onError: (msg) => {
          if (!cancelled) onError?.(msg);
        },
      });
      if (!cancelled && experience) {
        onReady?.();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [campaign, sessionId, sessionPromise, surfaceBackend, onError, onReady]);

  useEffect(() => {
    const closeBtn = document.getElementById('surface-ar-close');
    const onCloseClick = () => onClose?.();
    closeBtn?.addEventListener('click', onCloseClick);
    return () => closeBtn?.removeEventListener('click', onCloseClick);
  }, [onClose]);

  useEffect(() => () => {
    teardownEmbeddedSurfaceAr();
    bootedRef.current = false;
  }, []);

  return null;
};

export default SurfaceArHost;
