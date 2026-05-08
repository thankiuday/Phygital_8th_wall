import { useLayoutEffect, useMemo, useRef, useState } from 'react';

/**
 * QrFrame — pure-SVG decorative frame around the QR canvas.
 *
 * `qr-code-styling` doesn't render frames itself; we wrap the QR with our own
 * SVG so we can offer the four styles from the screenshot ("Bottom Bar",
 * "Bottom Arrow", "Right Arrow", "None").
 *
 * The component is layout-only: children are positioned over the QR slot and
 * the frame chrome (border, label rectangle, arrow) is drawn around them.
 *
 * Props
 *   variant   — one of 'none' | 'bottom-bar' | 'bottom-arrow' | 'right-arrow'
 *   caption   — text shown inside the label rect (e.g. "Scan me!")
 *   children  — typically the <StyledQrPreview /> canvas/svg
 *   color     — frame stroke + label background colour
 *   size      — preferred render size in px (default 256)
 */

const QR_BOX_SIZE_DEFAULT = 256;
const FRAME_STROKE = 6;

const QrFrame = ({
  variant = 'none',
  caption = 'Scan me!',
  color = '#000000',
  size = QR_BOX_SIZE_DEFAULT,
  children,
}) => {
  const hostRef = useRef(null);
  const [hostWidth, setHostWidth] = useState(0);

  const layout = useMemo(() => {
    if (variant === 'bottom-bar') return { width: size, height: size + 56 };
    if (variant === 'bottom-arrow') return { width: size, height: size + 64 };
    if (variant === 'right-arrow') return { width: size + 96 + 16, height: size };
    return { width: size, height: size };
  }, [size, variant]);

  useLayoutEffect(() => {
    const node = hostRef.current;
    if (!node) return undefined;
    const update = () => setHostWidth(node.clientWidth || 0);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const scale = hostWidth > 0 ? Math.min(1, hostWidth / layout.width) : 1;

  if (variant === 'none') {
    return (
      <div ref={hostRef} className="w-full">
        <div style={{ width: layout.width, height: layout.height }}>{children}</div>
      </div>
    );
  }

  // Layouts beyond 'none' add chrome around the QR; the QR itself remains
  // exactly `size × size` so the encoded payload stays scannable.
  return (
    <div ref={hostRef} className="w-full">
      <div style={{ width: layout.width, height: layout.height * scale }}>
        <div
          className="relative origin-top-left"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `scale(${scale})`,
          }}
        >
          {variant === 'bottom-bar' && (
            <>
              <div
                className="absolute left-0 top-0 relative"
                style={{
                  width: size,
                  height: size,
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ width: size, height: size }}>
                  {children}
                </div>
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{ border: `${FRAME_STROKE}px solid ${color}`, boxSizing: 'border-box' }}
                />
              </div>
              <div
                className="absolute bottom-0 flex w-full items-center justify-center rounded-2xl text-white"
                style={{
                  background: color,
                  height: 44,
                  left: 0,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                }}
              >
                {caption}
              </div>
            </>
          )}

          {variant === 'bottom-arrow' && (
            <>
              <div
                className="absolute left-0 top-0 relative"
                style={{
                  width: size,
                  height: size,
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ width: size, height: size }}>
                  {children}
                </div>
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{ border: `${FRAME_STROKE}px solid ${color}`, boxSizing: 'border-box' }}
                />
              </div>
              {/* Pointer triangle joining the QR to the caption pill */}
              <svg
                className="absolute"
                style={{ top: size + 2, left: size / 2 - 12 }}
                width="24"
                height="12"
                viewBox="0 0 24 12"
              >
                <polygon points="0,0 24,0 12,12" fill={color} />
              </svg>
              <div
                className="absolute bottom-0 flex w-full items-center justify-center rounded-full text-white"
                style={{
                  background: color,
                  height: 36,
                  left: 0,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                }}
              >
                {caption}
              </div>
            </>
          )}

          {variant === 'right-arrow' && (
            <>
              <div
                className="absolute left-0 top-0 relative"
                style={{
                  width: size,
                  height: size,
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ width: size, height: size }}>
                  {children}
                </div>
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{ border: `${FRAME_STROKE}px solid ${color}`, boxSizing: 'border-box' }}
                />
              </div>
              <svg
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: size + 2 }}
                width="12"
                height="24"
                viewBox="0 0 12 24"
              >
                <polygon points="0,0 12,12 0,24" fill={color} />
              </svg>
              <div
                className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full text-white"
                style={{
                  background: color,
                  width: 96,
                  height: 36,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                }}
              >
                {caption}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QrFrame;
