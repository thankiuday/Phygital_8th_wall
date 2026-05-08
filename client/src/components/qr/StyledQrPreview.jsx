import { useEffect, useLayoutEffect, useRef } from 'react';
import QRCodeStyling from 'qr-code-styling';

/** Defaults merged before every create/update — avoids qr-code-styling crashes when `imageOptions` is missing after a logo is cleared. */
const DEFAULT_IMAGE_OPTIONS = {
  hideBackgroundDots: false,
  imageSize: 0.4,
  margin: 4,
};

const normalizeQrOptions = (options) => ({
  ...options,
  imageOptions: {
    ...DEFAULT_IMAGE_OPTIONS,
    ...(options.imageOptions || {}),
  },
});

/**
 * StyledQrPreview — thin React wrapper around `qr-code-styling`.
 *
 * Performance contract
 *  - One QRCodeStyling instance per mounted component.  Subsequent prop
 *    changes call `qr.update(options)` — never re-instantiate, never re-mount
 *    the SVG/canvas (the lib appends a fresh node each `append()` call).
 *  - Parents are expected to memoize `options` (see qrDesignModel.buildQrOptions
 *    + useDebouncedValue) so we don't spin needlessly during slider drags.
 *
 * Imperative export
 *  - Forwarding a download method via `downloadRef`: parent passes a ref that
 *    we attach `current.download(opts)` to.  Used by Step 2's "Download" CTA.
 */
const StyledQrPreview = ({ options, downloadRef, className = '' }) => {
  const containerRef = useRef(null);
  const qrRef = useRef(null);

  // useLayoutEffect ensures the canvas is mounted to a real DOM node before
  // the lib appends; useEffect would race the first paint on slow devices.
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const qr = new QRCodeStyling(normalizeQrOptions(options));
    qr.append(containerRef.current);
    qrRef.current = qr;

    if (downloadRef) {
      const downloadWithApi = (opts) =>
        qr.download(opts || { name: 'qr', extension: 'png' });
      downloadWithApi.getRawData = (extension = 'png') => qr.getRawData(extension);
      downloadRef.current = downloadWithApi;
    }

    return () => {
      // Strict-Mode and HMR-safe cleanup: the lib doesn't expose remove(), so
      // we just blow away the rendered child.
      if (containerRef.current) containerRef.current.innerHTML = '';
      qrRef.current = null;
      if (downloadRef) downloadRef.current = null;
    };
    // We deliberately depend on []: subsequent updates go through qr.update()
    // in the next effect, never through re-instantiation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (qrRef.current) qrRef.current.update(normalizeQrOptions(options));
  }, [options]);

  return <div ref={containerRef} className={className} aria-label="QR code preview" />;
};

export default StyledQrPreview;
