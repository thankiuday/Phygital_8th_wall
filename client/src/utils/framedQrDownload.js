/**
 * Composes the same framed QR PNG as Step2DesignQr (canvas + optional frame chrome).
 * Keeps wizard download and campaign detail download visually identical.
 */

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

const blobToImage = (blob) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(img);
  };
  img.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('Could not decode QR image for download'));
  };
  img.src = objectUrl;
});

const canvasToBlob = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob) return reject(new Error('Could not generate image'));
    resolve(blob);
  }, 'image/png');
});

const triggerBlobDownload = (blob, filename) => {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
};

const safeBaseName = (name) => String(name || 'qr-code').replace(/[/\\?%*:|"<>]/g, '-').slice(0, 80);

/**
 * @param {object} opts
 * @param {{ (o?: object): void; getRawData?: (ext?: string) => Promise<Blob> }} opts.downloadApi - StyledQrPreview ref API
 * @param {string} [opts.fileBaseName] - without extension
 * @param {string} [opts.frame] - 'none' | 'bottom-bar' | 'bottom-arrow' | 'right-arrow'
 * @param {string} [opts.frameCaption]
 * @param {string} [opts.frameColor] - stroke + label fill (same rule as Step2 / QrFrame)
 * @param {number} [opts.qrPixelSize] - inner QR square (Step2 uses 224)
 */
export async function downloadFramedDynamicQrPng({
  downloadApi,
  fileBaseName = 'qr-code',
  frame = 'none',
  frameCaption = 'Scan me!',
  frameColor = '#000000',
  qrPixelSize = 224,
}) {
  if (!downloadApi) return;

  const base = safeBaseName(fileBaseName);
  if (!frame || frame === 'none') {
    downloadApi({ name: base, extension: 'png' });
    return;
  }

  try {
    const qrBlob = await downloadApi.getRawData?.('png');
    if (!qrBlob) {
      downloadApi({ name: base, extension: 'png' });
      return;
    }
    const qrImg = await blobToImage(qrBlob);
    const caption = (frameCaption || 'Scan me!').slice(0, 40);
    const captionW = 96;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      downloadApi({ name: base, extension: 'png' });
      return;
    }

    const qrSize = qrPixelSize;
    let width = qrSize;
    let height = qrSize;
    if (frame === 'bottom-bar') height = qrSize + 56;
    if (frame === 'bottom-arrow') height = qrSize + 64;
    if (frame === 'right-arrow') width = qrSize + captionW + 16;

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(qrImg, 0, 0, qrSize, qrSize);

    ctx.lineWidth = 6;
    ctx.strokeStyle = frameColor;
    roundedRect(ctx, 3, 3, qrSize - 6, qrSize - 6, 16);
    ctx.stroke();

    ctx.fillStyle = frameColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 24px Inter, Arial, sans-serif';

    if (frame === 'bottom-bar') {
      roundedRect(ctx, 0, qrSize + 12, qrSize, 44, 16);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(caption, qrSize / 2, qrSize + 34);
    } else if (frame === 'bottom-arrow') {
      ctx.beginPath();
      ctx.moveTo(qrSize / 2 - 12, qrSize + 2);
      ctx.lineTo(qrSize / 2 + 12, qrSize + 2);
      ctx.lineTo(qrSize / 2, qrSize + 14);
      ctx.closePath();
      ctx.fill();
      roundedRect(ctx, 0, qrSize + 28, qrSize, 36, 18);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(caption, qrSize / 2, qrSize + 46);
    } else if (frame === 'right-arrow') {
      ctx.beginPath();
      ctx.moveTo(qrSize + 2, qrSize / 2 - 12);
      ctx.lineTo(qrSize + 14, qrSize / 2);
      ctx.lineTo(qrSize + 2, qrSize / 2 + 12);
      ctx.closePath();
      ctx.fill();
      roundedRect(ctx, qrSize + 16, qrSize / 2 - 18, captionW, 36, 18);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(caption, qrSize + 16 + captionW / 2, qrSize / 2);
    }

    const framedBlob = await canvasToBlob(canvas);
    triggerBlobDownload(framedBlob, `${base}-framed.png`);
  } catch {
    downloadApi({ name: base, extension: 'png' });
  }
}
