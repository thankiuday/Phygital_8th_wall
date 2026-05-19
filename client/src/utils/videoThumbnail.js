/**
 * Capture a JPEG frame from a local video file for use as campaign thumbnailUrl.
 */
export const captureVideoThumbnail = (file, seekTimeSec = 0.5) =>
  new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No video file'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute('src');
      video.load();
    };

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 1;
      const t = Math.min(Math.max(seekTimeSec, 0.05), Math.max(duration - 0.05, 0.05));
      video.currentTime = t;
    };

    video.onseeked = () => {
      try {
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 360;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not supported');
        ctx.drawImage(video, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (blob) resolve(blob);
            else reject(new Error('Thumbnail encode failed'));
          },
          'image/jpeg',
          0.86
        );
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Could not read video for thumbnail'));
    };

    video.src = objectUrl;
  });
