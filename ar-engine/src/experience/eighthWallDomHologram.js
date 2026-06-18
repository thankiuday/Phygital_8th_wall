/**
 * eighthWallDomHologram — iOS 8th Wall hologram as a surface-anchored overlay.
 */

const DEFAULT_HEIGHT_RATIO = 0.72;
/** Extra scale so DOM size matches Android WebXR perceived size on phone. */
const DISPLAY_SCALE = 1.55;
const MIN_VIEWPORT_HEIGHT_RATIO = 0.58;
const MAX_VIEWPORT_HEIGHT_RATIO = 0.94;
const POSITION_ALPHA = 0.11;
const SIZE_ALPHA = 0.08;
const MAX_POS_DELTA_PX = 20;
const MAX_SIZE_DELTA_PX = 14;
const HOLD_FRAMES_ON_MISS = 10;
const COMPOSITE_EVERY_N_FRAMES = 2;

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
  const host = document.getElementById('surface-ar-shell') || domRoot;
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
  let hasLayout = false;
  let compositeTick = 0;
  let displayPlayPromise = null;
  let missFrames = 0;
  let lastGoodLayout = null;
  const smooth = { left: 0, top: 0, width: 0, height: 0 };

  const scratch = {
    localBL: null,
    localBR: null,
    localTL: null,
    localTR: null,
    world: null,
    projected: null,
  };

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
    const vp = getViewport();
    let h = Math.max(vp.height * MIN_VIEWPORT_HEIGHT_RATIO, heightPx * DISPLAY_SCALE);
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

  const applyDefaultLayout = (immediate = true) => {
    const vp = getViewport();
    const h = vp.height * DEFAULT_HEIGHT_RATIO;
    const x = vp.offsetLeft + vp.width * 0.5;
    const y = vp.offsetTop + vp.height * 0.66;
    applyLayout(x, y, h, immediate);
  };

  const holdOrDefault = (immediate = false) => {
    if (lastGoodLayout) {
      applyLayout(
        lastGoodLayout.bottomX,
        lastGoodLayout.bottomY,
        lastGoodLayout.heightPx,
        immediate,
      );
      return Boolean(lastGoodLayout);
    }
    applyDefaultLayout(immediate);
    return false;
  };

  const projectPlaneScreenBounds = (THREE, camera, anchorGroup) => {
    if (!THREE || !camera || !anchorGroup) return null;

    if (!scratch.localBL) {
      const halfW = planeWidth / 2;
      scratch.localBL = new THREE.Vector3(-halfW, 0, 0);
      scratch.localBR = new THREE.Vector3(halfW, 0, 0);
      scratch.localTL = new THREE.Vector3(-halfW, planeHeight, 0);
      scratch.localTR = new THREE.Vector3(halfW, planeHeight, 0);
      scratch.world = new THREE.Vector3();
      scratch.projected = new THREE.Vector3();
    }

    camera.updateMatrixWorld?.(true);
    anchorGroup.updateMatrixWorld?.(true);

    const corners = [
      scratch.localBL,
      scratch.localBR,
      scratch.localTL,
      scratch.localTR,
    ];
    const vp = getViewport();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let valid = 0;

    for (const local of corners) {
      scratch.world.copy(local).applyMatrix4(anchorGroup.matrixWorld);
      scratch.projected.copy(scratch.world).project(camera);
      if (scratch.projected.z > 1.05) continue;

      const sx = vp.offsetLeft + (scratch.projected.x * 0.5 + 0.5) * vp.width;
      const sy = vp.offsetTop + (-scratch.projected.y * 0.5 + 0.5) * vp.height;
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;

      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy);
      maxY = Math.max(maxY, sy);
      valid += 1;
    }

    if (valid < 2) return null;

    const bottomX = (minX + maxX) * 0.5;
    const bottomY = maxY;
    let heightPx = Math.max(16, maxY - minY);
    if (!Number.isFinite(heightPx) || heightPx < 16) return null;

    return { bottomX, bottomY, heightPx };
  };

  const applyTrackedLayout = (THREE, camera, anchorGroup) => {
    const bounds = projectPlaneScreenBounds(THREE, camera, anchorGroup);

    if (bounds) {
      missFrames = 0;
      lastGoodLayout = bounds;
      applyLayout(bounds.bottomX, bounds.bottomY, bounds.heightPx, !hasLayout);
      return true;
    }

    missFrames += 1;
    if (missFrames <= HOLD_FRAMES_ON_MISS) {
      return holdOrDefault(!hasLayout);
    }

    const vp = getViewport();
    if (!scratch.world) {
      scratch.world = new THREE.Vector3();
      scratch.projected = new THREE.Vector3();
    }
    scratch.world.setFromMatrixPosition(anchorGroup.matrixWorld);
    const dist = camera.position.distanceTo(scratch.world);
    if (Number.isFinite(dist) && dist >= 0.08) {
      const vFov = getCameraVerticalFovRad(camera);
      const heightPx = ((planeHeight / dist) / Math.tan(vFov / 2)) * vp.height;
      scratch.projected.copy(scratch.world).project(camera);
      const bottomX = vp.offsetLeft + (scratch.projected.x * 0.5 + 0.5) * vp.width;
      const bottomY = vp.offsetTop + (-scratch.projected.y * 0.5 + 0.5) * vp.height;
      if (Number.isFinite(bottomX) && Number.isFinite(bottomY) && scratch.projected.z <= 1.05) {
        missFrames = 0;
        lastGoodLayout = { bottomX, bottomY, heightPx };
        applyLayout(bottomX, bottomY, heightPx, !hasLayout);
        return true;
      }
    }

    return holdOrDefault(!hasLayout);
  };

  const reveal = () => {
    applyDefaultLayout(true);
    updateVideoFrame(true);
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
      missFrames = 0;
      lastGoodLayout = null;
      compositeTick = 0;
      reveal();
    },

    show() {
      this.showAtScreen();
    },

    hide() {
      active = false;
      hasLayout = false;
      missFrames = 0;
      lastGoodLayout = null;
      wrap.classList.remove('visible');
      displayVideo.pause();
    },

    setPlaying(shouldPlay) {
      if (!active) return;
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
      if (!active) return;
      mirrorPlaybackState();
      updateVideoFrame(true);
    },

    update(THREE, camera, anchorGroup) {
      if (!active) return;

      updateVideoFrame();

      if (THREE && camera && anchorGroup) {
        applyTrackedLayout(THREE, camera, anchorGroup);
      } else if (!hasLayout) {
        holdOrDefault(true);
      }

      wrap.classList.add('visible');
    },

    destroy() {
      active = false;
      hasLayout = false;
      missFrames = 0;
      lastGoodLayout = null;
      displayVideo.pause();
      displayVideo.removeAttribute('src');
      displayVideo.load();
      wrap.remove();
    },
  };
};
