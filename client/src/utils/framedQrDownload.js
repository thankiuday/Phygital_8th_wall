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

/** Aligned with server `qrDesign.frameCaption` (Zod max 40). */
const MAX_CAPTION_LEN = 40;

/**
 * Greedy word-wrap for canvas measureText; breaks long tokens to fit maxWidth.
 * @returns {string[]}
 */
const wrapCaptionLines = (ctx, text, maxWidth) => {
  const raw = String(text || '').trim() || 'Scan me!';
  const words = raw.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';

  const pushLine = (s) => {
    if (s) lines.push(s);
  };

  const breakLongWord = (word) => {
    let chunk = '';
    for (let i = 0; i < word.length; i += 1) {
      const ch = word[i];
      const test = chunk + ch;
      if (ctx.measureText(test).width <= maxWidth) {
        chunk = test;
      } else {
        if (chunk) pushLine(chunk);
        chunk = ch;
      }
    }
    return chunk;
  };

  for (const word of words) {
    if (ctx.measureText(word).width > maxWidth) {
      pushLine(line);
      line = breakLongWord(word);
      continue;
    }
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      pushLine(line);
      line = word;
    }
  }
  pushLine(line);
  return lines.length ? lines : [''];
};

/**
 * @returns {{ fontSize: number, lineHeight: number, lines: string[], widest: number }}
 */
const fitBottomCaptionLayout = (ctx, caption, maxLineWidth, fontsToTry, maxLines) => {
  const capped = String(caption || '').trim().slice(0, MAX_CAPTION_LEN) || 'Scan me!';
  for (const fontSize of fontsToTry) {
    ctx.font = `700 ${fontSize}px Inter, Arial, sans-serif`;
    const lines = wrapCaptionLines(ctx, capped, maxLineWidth);
    if (lines.length <= maxLines) {
      const lineHeight = Math.round(fontSize * 1.22);
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
      return { fontSize, lineHeight, lines, widest };
    }
  }
  const fontSize = fontsToTry[fontsToTry.length - 1];
  ctx.font = `700 ${fontSize}px Inter, Arial, sans-serif`;
  const lines = wrapCaptionLines(ctx, capped, maxLineWidth);
  const lineHeight = Math.round(fontSize * 1.22);
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
  return { fontSize, lineHeight, lines, widest };
};

const fitRightCaptionLayout = (ctx, caption, maxLineWidth, fontsToTry) => {
  const capped = String(caption || '').trim().slice(0, MAX_CAPTION_LEN) || 'Scan me!';
  for (const fontSize of fontsToTry) {
    ctx.font = `700 ${fontSize}px Inter, Arial, sans-serif`;
    const lines = wrapCaptionLines(ctx, capped, maxLineWidth);
    if (lines.length <= 5) {
      const lineHeight = Math.round(fontSize * 1.22);
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
      return { fontSize, lineHeight, lines, widest };
    }
  }
  const fontSize = fontsToTry[fontsToTry.length - 1];
  ctx.font = `700 ${fontSize}px Inter, Arial, sans-serif`;
  const lines = wrapCaptionLines(ctx, capped, maxLineWidth);
  const lineHeight = Math.round(fontSize * 1.22);
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
  return { fontSize, lineHeight, lines, widest };
};

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
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      downloadApi({ name: base, extension: 'png' });
      return;
    }

    const qrSize = qrPixelSize;
    const padX = 12;
    const fontsToTry = [24, 20, 17, 14];
    const bottomTextMaxW = Math.max(48, qrSize - padX * 2);

    let width = qrSize;
    let height = qrSize;
    let layout;
    let pillW = 96;
    let pillH = 36;

    if (frame === 'bottom-bar') {
      layout = fitBottomCaptionLayout(ctx, frameCaption, bottomTextMaxW, fontsToTry, 4);
      const barPadV = 12;
      const minBarH = 44;
      const barHeight = Math.max(minBarH, barPadV + layout.lines.length * layout.lineHeight + barPadV);
      const gap = 12;
      height = qrSize + gap + barHeight;
    } else if (frame === 'bottom-arrow') {
      layout = fitBottomCaptionLayout(ctx, frameCaption, bottomTextMaxW, fontsToTry, 4);
      const barPadV = 10;
      const minBarH = 36;
      const barHeight = Math.max(minBarH, barPadV + layout.lines.length * layout.lineHeight + barPadV);
      height = qrSize + 2 + 12 + 8 + barHeight;
    } else if (frame === 'right-arrow') {
      const maxLineW = 220;
      layout = fitRightCaptionLayout(ctx, frameCaption, maxLineW, fontsToTry);
      const pillPadX = 20;
      const pillPadY = 10;
      pillW = Math.max(96, Math.ceil(layout.widest) + pillPadX * 2);
      pillH = Math.max(36, Math.ceil(layout.lines.length * layout.lineHeight) + pillPadY * 2);
      width = qrSize + 14 + pillW;
      height = Math.max(qrSize, pillH);
    }

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
    ctx.font = `700 ${layout.fontSize}px Inter, Arial, sans-serif`;

    if (frame === 'bottom-bar') {
      const gap = 12;
      const barY = qrSize + gap;
      const barHeight = height - barY;
      roundedRect(ctx, 0, barY, qrSize, barHeight, 16);
      ctx.fill();
      const { lines, lineHeight } = layout;
      const blockTop = barY + (barHeight - lines.length * lineHeight) / 2;
      ctx.fillStyle = '#ffffff';
      lines.forEach((ln, i) => {
        ctx.fillText(ln, qrSize / 2, blockTop + lineHeight / 2 + i * lineHeight);
      });
    } else if (frame === 'bottom-arrow') {
      ctx.fillStyle = frameColor;
      ctx.beginPath();
      ctx.moveTo(qrSize / 2 - 12, qrSize + 2);
      ctx.lineTo(qrSize / 2 + 12, qrSize + 2);
      ctx.lineTo(qrSize / 2, qrSize + 14);
      ctx.closePath();
      ctx.fill();
      const barY = qrSize + 2 + 12 + 8;
      const barHeight = height - barY;
      roundedRect(ctx, 0, barY, qrSize, barHeight, 18);
      ctx.fill();
      const { lines, lineHeight } = layout;
      const blockTop = barY + (barHeight - lines.length * lineHeight) / 2;
      ctx.fillStyle = '#ffffff';
      lines.forEach((ln, i) => {
        ctx.fillText(ln, qrSize / 2, blockTop + lineHeight / 2 + i * lineHeight);
      });
    } else if (frame === 'right-arrow') {
      const pillX = qrSize + 16;
      const pillY = height / 2 - pillH / 2;
      ctx.fillStyle = frameColor;
      ctx.beginPath();
      ctx.moveTo(qrSize + 2, qrSize / 2 - 12);
      ctx.lineTo(qrSize + 14, qrSize / 2);
      ctx.lineTo(qrSize + 2, qrSize / 2 + 12);
      ctx.closePath();
      ctx.fill();
      roundedRect(ctx, pillX, pillY, pillW, pillH, 18);
      ctx.fill();
      const { lines, lineHeight } = layout;
      const cx = pillX + pillW / 2;
      const blockTop = pillY + (pillH - lines.length * lineHeight) / 2;
      ctx.fillStyle = '#ffffff';
      lines.forEach((ln, i) => {
        ctx.fillText(ln, cx, blockTop + lineHeight / 2 + i * lineHeight);
      });
    }

    const framedBlob = await canvasToBlob(canvas);
    triggerBlobDownload(framedBlob, `${base}-framed.png`);
  } catch {
    downloadApi({ name: base, extension: 'png' });
  }
}
