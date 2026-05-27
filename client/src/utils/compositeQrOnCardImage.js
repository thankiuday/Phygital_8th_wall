/**
 * Full-resolution composite: user card image + framed QR at a normalized position.
 * Used by the AR wizard (preview + final upload after campaign create).
 */

import QRCode from 'qrcode';

/** Render QR at N× final size, then draw with smoothing off for crisp modules. */
const QR_SUPERSAMPLE = 4;

const roundedRect = (ctx, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

/**
 * Load image with EXIF orientation applied (phone photos often store landscape pixels
 * but display as portrait — without this, QR placement coords drift from what the user saw).
 */
const loadOrientedImageSource = async (src) => {
  try {
    const res = await fetch(src, { mode: 'cors', credentials: 'same-origin' });
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return {
        draw: (ctx, dx, dy, dw, dh) => ctx.drawImage(bitmap, dx, dy, dw, dh),
        width: bitmap.width,
        height: bitmap.height,
        release: () => {
          if (typeof bitmap.close === 'function') bitmap.close();
        },
      };
    }
  } catch {
    /* fall through to <img> */
  }

  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not load card image'));
    el.src = src;
  });

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  return {
    draw: (ctx, dx, dy, dw, dh) => ctx.drawImage(img, dx, dy, dw, dh),
    width: w,
    height: h,
    release: () => {},
  };
};

const canvasToBlob = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not export image'))),
      'image/png',
      1
    );
  });

/** Draw without bilinear blur — critical for scannable QR modules. */
const drawImageCrisp = (ctx, img, dx, dy, dw, dh) => {
  const prevSmooth = ctx.imageSmoothingEnabled;
  const prevQuality = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = false;
  if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'low';
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.imageSmoothingEnabled = prevSmooth;
  if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = prevQuality;
};

/** Corner presets — center of QR box in normalized coordinates. */
export const QR_PLACEMENT_PRESETS = {
  'top-left': { x: 0.18, y: 0.18 },
  'top-right': { x: 0.82, y: 0.18 },
  'top-center': { x: 0.5, y: 0.18 },
  'bottom-left': { x: 0.18, y: 0.82 },
  'bottom-right': { x: 0.82, y: 0.82 },
  center: { x: 0.5, y: 0.5 },
};

export const getArQrPreviewUrl = () => {
  const base =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLIENT_URL)
    || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${String(base).replace(/\/$/, '')}/ar/preview`;
};

export const buildArExperienceUrl = (campaignId) => {
  const base =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLIENT_URL)
    || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${String(base).replace(/\/$/, '')}/ar/${campaignId}`;
};

/**
 * Target QR square size in output pixels — enforces a print-readable minimum.
 */
export const resolveQrOuterPx = (imageWidth, imageHeight, scale = 0.22) => {
  const minDim = Math.min(imageWidth, imageHeight);
  const fromScale = Math.round(minDim * scale);
  const floor = Math.min(
    Math.round(minDim * 0.38),
    Math.max(200, Math.round(minDim * 0.22))
  );
  const cap = Math.round(minDim * 0.45);
  return Math.max(Math.min(fromScale, cap), Math.min(floor, cap));
};

/** Bounding box of framed QR chrome (for quiet-zone plate). */
const getFramedQrBounds = (frame, qrOuter) => {
  let width = qrOuter;
  let height = qrOuter;
  const pillW = 120;
  const pillH = 40;

  if (frame === 'bottom-bar') {
    height = qrOuter + 12 + 44;
  } else if (frame === 'bottom-arrow') {
    height = qrOuter + 2 + 12 + 8 + 40;
  } else if (frame === 'right-arrow') {
    width = qrOuter + 14 + pillW;
    height = Math.max(qrOuter, pillH);
  }

  return { width, height };
};

const renderQrCanvas = async (qrDataString, qrOuter) => {
  const renderSize = Math.max(320, qrOuter * QR_SUPERSAMPLE);
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, qrDataString, {
    width: renderSize,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#ffffff' },
  });
  return qrCanvas;
};

const drawQuietZonePlate = (ctx, x, y, width, height, pad = 12) => {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, x - pad, y - pad, width + pad * 2, height + pad * 2, 14);
  ctx.fill();
  ctx.restore();
};

const drawFramedQr = (ctx, qrImg, frame, caption, frameColor, destX, destY, qrOuter) => {
  let width = qrOuter;
  let height = qrOuter;
  let layout;
  let pillW = 96;
  let pillH = 36;

  if (frame === 'bottom-bar') {
    layout = { fontSize: 18, lineHeight: 22, lines: [caption], widest: qrOuter / 2 };
    const barHeight = 44;
    height = qrOuter + 12 + barHeight;
  } else if (frame === 'bottom-arrow') {
    layout = { fontSize: 16, lineHeight: 20, lines: [caption], widest: qrOuter / 2 };
    height = qrOuter + 2 + 12 + 8 + 40;
  } else if (frame === 'right-arrow') {
    layout = { fontSize: 16, lineHeight: 20, lines: [caption], widest: 80 };
    pillW = 120;
    pillH = 40;
    width = qrOuter + 14 + pillW;
    height = Math.max(qrOuter, pillH);
  }

  const ox = destX - width / 2;
  const oy = destY - height / 2;

  drawImageCrisp(ctx, qrImg, ox, oy, qrOuter, qrOuter);
  ctx.lineWidth = 6;
  ctx.strokeStyle = frameColor;
  roundedRect(ctx, ox + 3, oy + 3, qrOuter - 6, qrOuter - 6, 16);
  ctx.stroke();

  ctx.fillStyle = frameColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${layout.fontSize}px Inter, Arial, sans-serif`;

  if (frame === 'bottom-bar') {
    const gap = 12;
    const barY = oy + qrOuter + gap;
    const barHeight = height - qrOuter - gap;
    roundedRect(ctx, ox, barY, qrOuter, barHeight, 16);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(caption, ox + qrOuter / 2, barY + barHeight / 2);
  } else if (frame === 'bottom-arrow') {
    ctx.fillStyle = frameColor;
    ctx.beginPath();
    ctx.moveTo(ox + qrOuter / 2 - 12, oy + qrOuter + 2);
    ctx.lineTo(ox + qrOuter / 2 + 12, oy + qrOuter + 2);
    ctx.lineTo(ox + qrOuter / 2, oy + qrOuter + 14);
    ctx.closePath();
    ctx.fill();
    const barY = oy + qrOuter + 2 + 12 + 8;
    roundedRect(ctx, ox, barY, qrOuter, height - (barY - oy), 18);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(caption, ox + qrOuter / 2, barY + 20);
  } else if (frame === 'right-arrow') {
    ctx.fillStyle = frameColor;
    ctx.beginPath();
    ctx.moveTo(ox + qrOuter + 2, oy + qrOuter / 2 - 12);
    ctx.lineTo(ox + qrOuter + 14, oy + qrOuter / 2);
    ctx.lineTo(ox + qrOuter + 2, oy + qrOuter / 2 + 12);
    ctx.closePath();
    ctx.fill();
    const pillX = ox + qrOuter + 16;
    const pillY = oy + qrOuter / 2 - pillH / 2;
    roundedRect(ctx, pillX, pillY, pillW, pillH, 18);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(caption, pillX + pillW / 2, pillY + pillH / 2);
  }
};

/**
 * @param {object} opts
 * @param {string} opts.imageSrc — URL or object URL of the raw card
 * @param {string} opts.qrDataString
 * @param {{ x: number, y: number, scale?: number }} opts.placement — center 0–1
 * @param {{ frame?: string, frameCaption?: string }} [opts.qrDesign]
 * @returns {Promise<Blob>}
 */
export async function compositeQrOnCardImage({
  imageSrc,
  qrDataString,
  placement,
  qrDesign = {},
}) {
  const source = await loadOrientedImageSource(imageSrc);
  const w = source.width;
  const h = source.height;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  try {
    source.draw(ctx, 0, 0, w, h);

    const qrOuter = resolveQrOuterPx(w, h, placement?.scale ?? 0.22);
    const qrCanvas = await renderQrCanvas(qrDataString, qrOuter);

    const frame = qrDesign.frame || 'bottom-bar';
    const caption = (qrDesign.frameCaption || 'Scan me!').slice(0, 40);
    const frameColor = '#0f172a';

    const cx = (placement?.x ?? 0.82) * w;
    const cy = (placement?.y ?? 0.82) * h;

    const bounds = getFramedQrBounds(frame === 'none' ? 'none' : frame, qrOuter);
    const boxW = frame === 'none' ? qrOuter : bounds.width;
    const boxH = frame === 'none' ? qrOuter : bounds.height;
    const boxOx = cx - boxW / 2;
    const boxOy = cy - boxH / 2;

    drawQuietZonePlate(ctx, boxOx, boxOy, boxW, boxH, 14);

    if (frame === 'none') {
      const half = qrOuter / 2;
      drawImageCrisp(ctx, qrCanvas, cx - half, cy - half, qrOuter, qrOuter);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      roundedRect(ctx, cx - half + 2, cy - half + 2, qrOuter - 4, qrOuter - 4, 12);
      ctx.stroke();
    } else {
      drawFramedQr(ctx, qrCanvas, frame, caption, frameColor, cx, cy, qrOuter);
    }

    const blob = await canvasToBlob(canvas);
    source.release();
    return blob;
  } catch (err) {
    source.release();
    throw err;
  }
}

/**
 * @param {Blob} blob
 * @param {string} [filename]
 */
export function downloadImageBlob(blob, filename = 'ar-business-card.png') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
