/**
 * eighthWallDomHologram — iOS 8th Wall hologram as a surface-anchored overlay.
 *
 * Uses a dedicated display <video> (always visible) plus an optional canvas for
 * side-by-side alpha. Projects the SLAM anchor each frame with a safe default
 * layout so the hologram is never zero-sized.
 */

const PORTRAIT_ASPECT = 9 / 16;
const DEFAULT_HEIGHT_RATIO = 0.58;
const SIZE_GAIN = 1.22;
const SMOOTH_ALPHA = 0.24;

const cloneVideoForDisplay = (sourceVideo) => {
  const v = document.createElement('video');
  v.src = sourceVideo.src;
  v.loop = sourceVideo.loop;
  v.muted = sourceVideo.muted;
  v.playsInline = true;
  v.crossOrigin = sourceVideo.crossOrigin || 'anonymous';
  v.setAttribute('webkit-playsinline', 'true');
  v.disableRemotePlayback = true;
  v.preload = 'auto';
  v.className = 'ar-ew-dom-hologram-video';
  v.load();
  return v;
};

const getViewport = () => {
  const vv = window.visualViewport;
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
    offsetLeft: vv?.offsetLeft ?? 0,
    offsetTop: vv?.offsetTop ?? 0,
  };
};

const getCameraVerticalFovRad = (camera) => {
  if (camera?.fov) return (camera.fov * Math.PI) / 180;
  const e = camera?.projectionMatrix?.elements;
  if (e && e[5]) return 2 * Math.atan(1 / e[5]);
  return (60 * Math.PI) / 180;
};

const tryCompositeSideBySide = (ctx, maskCtx, maskCanvas, videoEl, canvas) => {
  if (!videoEl || videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false;
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh) return false;

  const hw = Math.floor(vw / 2);
  if (canvas.width !== hw || canvas.height !== vh) {
    canvas.width = hw;
    canvas.height = vh;
    maskCanvas.width = hw;
    maskCanvas.height = vh;
  }

  ctx.clearRect(0, 0, hw, vh);
  ctx.drawImage(videoEl, 0, 0, hw, vh, 0, 0, hw, vh);
  maskCtx.drawImage(videoEl, hw, 0, hw, vh, 0, 0, hw, vh);

  const rgb = ctx.getImageData(0, 0, hw, vh);
  const mask = maskCtx.getImageData(0, 0, hw, vh);
  const px = rgb.data;
  const mx = mask.data;
  for (let i = 0; i < px.length; i += 4) {
    px[i + 3] = mx[i];
  }
  ctx.putImageData(rgb, 0, 0);
  return true;
};

/**
 * @param {{
 *   domRoot: HTMLElement,
 *   sourceVideoEl: HTMLVideoElement,
 *   planeHeight: number,
 *   sideBySideAlpha?: boolean,
 * }} opts
 */
export const createEighthWallDomHologram = ({
  domRoot,
  sourceVideoEl,
  planeHeight,
  sideBySideAlpha = false,
}) => {
  const host = document.getElementById('surface-ar-shell') || domRoot;

  const wrap = document.createElement('div');
  wrap.id = 'ar-ew-dom-hologram';
  wrap.className = 'ar-ew-dom-hologram';
  wrap.setAttribute('aria-hidden', 'true');

  const inner = document.createElement('div');
  inner.className = 'ar-ew-dom-hologram-inner';

  const displayVideo = cloneVideoForDisplay(sourceVideoEl);
  if (sideBySideAlpha) {
    displayVideo.classList.add('ar-ew-dom-hologram-video-sbs');
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'ar-ew-dom-hologram-canvas';
  canvas.hidden = true;

  const ctx = canvas.getContext('2d', { alpha: true });
  const maskCanvas = document.createElement('canvas');
  const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });

  inner.appendChild(displayVideo);
  inner.appendChild(canvas);
  wrap.appendChild(inner);
  host.appendChild(wrap);

  sourceVideoEl.addEventListener('loadeddata', () => {
    if (displayVideo.src !== sourceVideoEl.src) {
      displayVideo.src = sourceVideoEl.src;
      displayVideo.load();
    }
  });

  let active = false;
  let hasLayout = false;
  let alphaCanvasReady = false;
  const smooth = { left: 0, top: 0, width: 0, height: 0 };

  const scratch = {
    bottom: null,
    top: null,
    localUp: null,
    quat: null,
    scale: null,
    pos: null,
    projectedBottom: null,
    projectedTop: null,
  };

  const syncDisplayVideo = () => {
    if (!sourceVideoEl || !displayVideo) return;
    if (displayVideo.src !== sourceVideoEl.src) {
      displayVideo.src = sourceVideoEl.src;
    }
    displayVideo.muted = sourceVideoEl.muted;
    if (
      sourceVideoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      && Math.abs(displayVideo.currentTime - sourceVideoEl.currentTime) > 0.15
    ) {
      try {
        displayVideo.currentTime = sourceVideoEl.currentTime;
      } catch {
        // ignore seek during startup
      }
    }
    if (!sourceVideoEl.paused && displayVideo.paused) {
      displayVideo.play().catch(() => {});
    }
  };

  const setAlphaMode = (useCanvas) => {
    alphaCanvasReady = useCanvas;
    canvas.hidden = !useCanvas;
    displayVideo.style.opacity = useCanvas ? '0' : '1';
  };

  const updateVideoFrame = () => {
    syncDisplayVideo();
    if (!sideBySideAlpha) {
      setAlphaMode(false);
      return;
    }
    try {
      if (tryCompositeSideBySide(ctx, maskCtx, maskCanvas, sourceVideoEl, canvas)) {
        setAlphaMode(true);
      } else {
        setAlphaMode(false);
      }
    } catch {
      setAlphaMode(false);
    }
  };

  const applyLayout = (bottomX, bottomY, heightPx, immediate = false) => {
    const vp = getViewport();
    let h = Math.max(vp.height * 0.38, heightPx * SIZE_GAIN);
    h = Math.min(vp.height * 0.9, h);
    let w = h * PORTRAIT_ASPECT;
    const maxW = vp.width * 0.94;
    if (w > maxW) {
      w = maxW;
      h = w / PORTRAIT_ASPECT;
    }

    const targetLeft = bottomX - w / 2;
    const targetTop = bottomY - h;

    if (!hasLayout || immediate) {
      smooth.left = targetLeft;
      smooth.top = targetTop;
      smooth.width = w;
      smooth.height = h;
      hasLayout = true;
    } else {
      smooth.left += (targetLeft - smooth.left) * SMOOTH_ALPHA;
      smooth.top += (targetTop - smooth.top) * SMOOTH_ALPHA;
      smooth.width += (w - smooth.width) * SMOOTH_ALPHA;
      smooth.height += (h - smooth.height) * SMOOTH_ALPHA;
    }

    wrap.style.width = `${smooth.width}px`;
    wrap.style.height = `${smooth.height}px`;
    wrap.style.left = `${smooth.left}px`;
    wrap.style.top = `${smooth.top}px`;
  };

  const applyDefaultLayout = (immediate = true) => {
    const vp = getViewport();
    const h = vp.height * DEFAULT_HEIGHT_RATIO;
    const x = vp.offsetLeft + vp.width * 0.5;
    const y = vp.offsetTop + vp.height * 0.66;
    applyLayout(x, y, h, immediate);
  };

  const applyTrackedLayout = (THREE, camera, anchorGroup) => {
    if (!THREE || !camera || !anchorGroup) return false;

    if (!scratch.bottom) {
      scratch.bottom = new THREE.Vector3();
      scratch.top = new THREE.Vector3();
      scratch.localUp = new THREE.Vector3(0, 1, 0);
      scratch.quat = new THREE.Quaternion();
      scratch.scale = new THREE.Vector3();
      scratch.pos = new THREE.Vector3();
      scratch.projectedBottom = new THREE.Vector3();
      scratch.projectedTop = new THREE.Vector3();
    }

    camera.updateMatrixWorld?.(true);
    anchorGroup.updateMatrixWorld?.(true);

    scratch.bottom.setFromMatrixPosition(anchorGroup.matrixWorld);
    anchorGroup.matrixWorld.decompose(scratch.pos, scratch.quat, scratch.scale);
    scratch.top
      .copy(scratch.localUp)
      .applyQuaternion(scratch.quat)
      .multiplyScalar(planeHeight)
      .add(scratch.bottom);

    scratch.projectedBottom.copy(scratch.bottom).project(camera);
    scratch.projectedTop.copy(scratch.top).project(camera);

    const vp = getViewport();
    const bottomX = vp.offsetLeft + (scratch.projectedBottom.x * 0.5 + 0.5) * vp.width;
    const bottomY = vp.offsetTop + (-scratch.projectedBottom.y * 0.5 + 0.5) * vp.height;
    const topY = vp.offsetTop + (-scratch.projectedTop.y * 0.5 + 0.5) * vp.height;

    let heightPx = Math.abs(bottomY - topY);
    if (!Number.isFinite(heightPx) || heightPx < 12) {
      const dist = camera.position.distanceTo(scratch.bottom);
      if (!Number.isFinite(dist) || dist < 0.08) {
        applyDefaultLayout(false);
        return false;
      }
      const vFov = getCameraVerticalFovRad(camera);
      heightPx = ((planeHeight / dist) / Math.tan(vFov / 2)) * vp.height;
    }

    if (scratch.projectedBottom.z > 1 && scratch.projectedTop.z > 1) {
      applyDefaultLayout(false);
      return false;
    }

    applyLayout(bottomX, bottomY, heightPx, !hasLayout);
    return true;
  };

  const reveal = () => {
    applyDefaultLayout(true);
    updateVideoFrame();
    wrap.classList.add('visible');
    displayVideo.play().catch(() => {});
    sourceVideoEl.play?.().catch(() => {});
  };

  return {
    root: wrap,
    getDisplayVideo: () => displayVideo,

    showAtScreen() {
      active = true;
      hasLayout = false;
      reveal();
    },

    show() {
      this.showAtScreen();
    },

    hide() {
      active = false;
      hasLayout = false;
      alphaCanvasReady = false;
      wrap.classList.remove('visible');
      displayVideo.pause();
    },

    syncFromSource() {
      if (!active) return;
      updateVideoFrame();
    },

    update(THREE, camera, anchorGroup) {
      if (!active) return;

      updateVideoFrame();

      if (THREE && camera && anchorGroup) {
        applyTrackedLayout(THREE, camera, anchorGroup);
      } else if (!hasLayout) {
        applyDefaultLayout(false);
      }

      wrap.classList.add('visible');
    },

    destroy() {
      active = false;
      hasLayout = false;
      displayVideo.pause();
      displayVideo.removeAttribute('src');
      displayVideo.load();
      wrap.remove();
    },
  };
};
