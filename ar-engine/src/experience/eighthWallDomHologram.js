/**
 * eighthWallDomHologram — iOS 8th Wall hologram DOM fallback (WebGL is primary).
 */

import {
  estimateScreenHeightPx,
  getVisualViewport,
  normToScreen,
  projectPlaneScreenBounds,
  worldToScreen,
} from './eighthWallScreenProjection.js';

const DISPLAY_SCALE = 1.45;
const MAX_VIEWPORT_HEIGHT_RATIO = 0.94;
const POSITION_ALPHA = 0.09;
const SIZE_ALPHA = 0.07;
const MAX_POS_DELTA_PX = 16;
const MAX_SIZE_DELTA_PX = 12;
const HOLD_FRAMES_ON_MISS = 12;
const COMPOSITE_EVERY_N_FRAMES = 4;

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

const clampStep = (current, target, maxStep) => {
  const delta = target - current;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
};

const tryCompositeSideBySide = (ctx, maskCtx, videoEl, canvas) => {
  if (!videoEl || videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false;
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh) return false;

  const hw = Math.floor(vw / 2);
  if (canvas.width !== hw || canvas.height !== vh) {
    canvas.width = hw;
    canvas.height = vh;
    maskCtx.canvas.width = hw;
    maskCtx.canvas.height = vh;
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
 *   planeWidth: number,
 *   planeHeight: number,
 *   sideBySideAlpha?: boolean,
 * }} opts
 */
export const createEighthWallDomHologram = ({
  domRoot,
  sourceVideoEl,
  planeWidth,
  planeHeight,
  sideBySideAlpha = false,
}) => {
  const host = document.getElementById('ar-dom-overlay')
    || document.getElementById('surface-ar-shell')
    || domRoot;
  const planeAspect = planeWidth / planeHeight;

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
  let suspended = false;
  let hasLayout = false;
  let hasTapSeed = false;
  let compositeTick = 0;
  let displayPlayPromise = null;
  let missFrames = 0;
  let lastGoodLayout = null;
  const smooth = { left: 0, top: 0, width: 0, height: 0 };
  const scratch = {};

  const mirrorPlaybackState = () => {
    if (!sourceVideoEl || !displayVideo) return;
    displayVideo.muted = sourceVideoEl.muted;
    displayVideo.loop = sourceVideoEl.loop;
    if (displayVideo.src !== sourceVideoEl.src) {
      displayVideo.src = sourceVideoEl.src;
    }
    if (sourceVideoEl.paused) {
      displayPlayPromise = null;
      if (!displayVideo.paused) displayVideo.pause();
    } else if (displayVideo.paused && !displayPlayPromise) {
      displayPlayPromise = displayVideo.play()
        .catch(() => {})
        .finally(() => { displayPlayPromise = null; });
    }
  };

  const setAlphaMode = (useCanvas) => {
    canvas.hidden = !useCanvas;
    displayVideo.style.opacity = useCanvas ? '0' : '1';
  };

  const updateVideoFrame = (forceComposite = false) => {
    mirrorPlaybackState();
    if (!sideBySideAlpha) {
      setAlphaMode(false);
      return;
    }

    compositeTick += 1;
    if (!forceComposite && compositeTick % COMPOSITE_EVERY_N_FRAMES !== 0) {
      return;
    }

    try {
      if (tryCompositeSideBySide(ctx, maskCtx, sourceVideoEl, canvas)) {
        setAlphaMode(true);
      } else {
        setAlphaMode(false);
      }
    } catch {
      setAlphaMode(false);
    }
  };

  const applyLayout = (bottomX, bottomY, heightPx, immediate = false) => {
    const vp = getVisualViewport();
    let h = heightPx * DISPLAY_SCALE;
    if (hasLayout && lastGoodLayout) {
      h = Math.max(h, lastGoodLayout.heightPx * DISPLAY_SCALE * 0.85);
    }
    h = Math.min(vp.height * MAX_VIEWPORT_HEIGHT_RATIO, h);
    let w = h * planeAspect;
    const maxW = vp.width * 0.96;
    if (w > maxW) {
      w = maxW;
      h = w / planeAspect;
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
      let nextLeft = smooth.left + (targetLeft - smooth.left) * POSITION_ALPHA;
      let nextTop = smooth.top + (targetTop - smooth.top) * POSITION_ALPHA;
      let nextW = smooth.width + (w - smooth.width) * SIZE_ALPHA;
      let nextH = smooth.height + (h - smooth.height) * SIZE_ALPHA;

      nextLeft = clampStep(smooth.left, nextLeft, MAX_POS_DELTA_PX);
      nextTop = clampStep(smooth.top, nextTop, MAX_POS_DELTA_PX);
      nextW = clampStep(smooth.width, nextW, MAX_SIZE_DELTA_PX);
      nextH = clampStep(smooth.height, nextH, MAX_SIZE_DELTA_PX);

      smooth.left = nextLeft;
      smooth.top = nextTop;
      smooth.width = nextW;
      smooth.height = nextH;
    }

    wrap.style.width = `${smooth.width}px`;
    wrap.style.height = `${smooth.height}px`;
    wrap.style.left = `${smooth.left}px`;
    wrap.style.top = `${smooth.top}px`;
  };

  const seedFromTap = (tapNorm, THREE, camera, anchorGroup) => {
    if (!tapNorm) return false;

    const vp = getVisualViewport();
    const tap = normToScreen(tapNorm.normX, tapNorm.normY, vp);
    let heightPx = vp.height * 0.52;

    if (THREE && camera && anchorGroup) {
      if (!scratch.world) scratch.world = new THREE.Vector3();
      anchorGroup.updateMatrixWorld?.(true);
      scratch.world.setFromMatrixPosition(anchorGroup.matrixWorld);
      const estimated = estimateScreenHeightPx(planeHeight, camera, scratch.world, vp);
      if (Number.isFinite(estimated) && estimated >= 16) {
        heightPx = estimated;
      }
    }

    const layout = { bottomX: tap.x, bottomY: tap.y, heightPx };
    lastGoodLayout = layout;
    hasTapSeed = true;
    applyLayout(layout.bottomX, layout.bottomY, layout.heightPx, true);
    return true;
  };

  const holdLastLayout = (immediate = false) => {
    if (!lastGoodLayout) return false;
    applyLayout(
      lastGoodLayout.bottomX,
      lastGoodLayout.bottomY,
      lastGoodLayout.heightPx,
      immediate,
    );
    return true;
  };

  const applyTrackedLayout = (THREE, camera, planeMesh, anchorGroup) => {
    const root = planeMesh || anchorGroup;
    const bounds = projectPlaneScreenBounds(
      THREE,
      camera,
      root,
      planeWidth,
      planeHeight,
      scratch,
    );

    if (bounds) {
      missFrames = 0;
      lastGoodLayout = bounds;
      applyLayout(bounds.bottomX, bounds.bottomY, bounds.heightPx, !hasLayout);
      return true;
    }

    missFrames += 1;
    if (missFrames <= HOLD_FRAMES_ON_MISS) {
      return holdLastLayout(!hasLayout);
    }

    if (!scratch.world) scratch.world = new THREE.Vector3();
    if (!scratch.projected) scratch.projected = new THREE.Vector3();
    const vp = getVisualViewport();
    anchorGroup.updateMatrixWorld?.(true);
    scratch.world.setFromMatrixPosition(anchorGroup.matrixWorld);
    const heightPx = estimateScreenHeightPx(planeHeight, camera, scratch.world, vp);
    const screen = worldToScreen(camera, scratch.world, scratch.projected);
    if (screen && heightPx && heightPx >= 16) {
      missFrames = 0;
      lastGoodLayout = { bottomX: screen.x, bottomY: screen.y, heightPx };
      applyLayout(screen.x, screen.y, heightPx, !hasLayout);
      return true;
    }

    return holdLastLayout(!hasLayout);
  };

  const reveal = () => {
    updateVideoFrame(true);
    wrap.classList.add('visible');
    displayVideo.play().catch(() => {});
    sourceVideoEl.play?.().catch(() => {});
  };

  return {
    root: wrap,
    getDisplayVideo: () => displayVideo,
    get isActive() { return active && !suspended; },

    /** Suspend DOM updates while WebGL hologram is active. */
    suspendForWebGl() {
      suspended = true;
      wrap.classList.remove('visible');
      displayVideo.pause();
    },

    resumeFromWebGl() {
      suspended = false;
    },

    /**
     * @param {{
     *   tapNorm?: { normX: number, normY: number },
     *   THREE?: object,
     *   camera?: object,
     *   anchorGroup?: object,
     *   planeMesh?: object,
     * }} opts
     */
    showAtPlacement({ tapNorm, THREE, camera, anchorGroup, planeMesh } = {}) {
      active = true;
      suspended = false;
      hasLayout = false;
      hasTapSeed = false;
      missFrames = 0;
      lastGoodLayout = null;
      compositeTick = 0;

      if (tapNorm) {
        seedFromTap(tapNorm, THREE, camera, anchorGroup);
      } else if (!hasLayout && THREE && camera && (planeMesh || anchorGroup)) {
        applyTrackedLayout(THREE, camera, planeMesh, anchorGroup);
      }

      reveal();
    },

    showAtScreen() {
      this.showAtPlacement();
    },

    show() {
      this.showAtPlacement();
    },

    hide() {
      active = false;
      suspended = false;
      hasLayout = false;
      hasTapSeed = false;
      missFrames = 0;
      lastGoodLayout = null;
      wrap.classList.remove('visible');
      displayVideo.pause();
    },

    setPlaying(shouldPlay) {
      if (!active || suspended) return;
      if (shouldPlay) {
        try {
          displayVideo.currentTime = sourceVideoEl.currentTime;
        } catch {
          // ignore seek errors on iOS
        }
        sourceVideoEl.play().then(() => {
          displayVideo.play().catch(() => {});
          updateVideoFrame(true);
        }).catch(() => {});
      } else {
        sourceVideoEl.pause();
        displayVideo.pause();
        displayPlayPromise = null;
      }
    },

    syncFromSource() {
      if (!active || suspended) return;
      mirrorPlaybackState();
      updateVideoFrame(true);
    },

    update(THREE, camera, anchorGroup, planeMesh) {
      if (!active || suspended) return;

      updateVideoFrame();

      if (THREE && camera && (planeMesh || anchorGroup)) {
        applyTrackedLayout(THREE, camera, planeMesh, anchorGroup);
      } else if (!hasLayout && hasTapSeed) {
        holdLastLayout(true);
      }

      wrap.classList.add('visible');
    },

    destroy() {
      active = false;
      suspended = false;
      hasLayout = false;
      hasTapSeed = false;
      missFrames = 0;
      lastGoodLayout = null;
      displayVideo.pause();
      displayVideo.removeAttribute('src');
      displayVideo.load();
      wrap.remove();
    },
  };
};
