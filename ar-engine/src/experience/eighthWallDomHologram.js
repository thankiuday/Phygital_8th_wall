/**
 * eighthWallDomHologram — iOS 8th Wall hologram as a surface-anchored overlay.
 *
 * Projects the SLAM anchor into screen space each frame (bottom pinned to the
 * placed surface). Side-by-side iOS video is composited to canvas with alpha.
 */

const PORTRAIT_ASPECT = 9 / 16; // width / height
const MIN_HEIGHT_RATIO = 0.52;  // min hologram height vs viewport
const MAX_HEIGHT_RATIO = 0.88;
const SIZE_GAIN = 1.28;         // iOS DOM reads slightly small vs WebXR
const SMOOTH_ALPHA = 0.22;

const compositeSideBySideFrame = (ctx, maskCtx, videoEl, canvas) => {
  if (!videoEl || videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false;
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh) return false;

  const hw = Math.floor(vw / 2);
  if (canvas.width !== hw || canvas.height !== vh) {
    canvas.width = hw;
    canvas.height = vh;
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

const drawOpaqueFrame = (ctx, videoEl, canvas) => {
  if (!videoEl || videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false;
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh) return false;
  if (canvas.width !== vw || canvas.height !== vh) {
    canvas.width = vw;
    canvas.height = vh;
  }
  ctx.clearRect(0, 0, vw, vh);
  ctx.drawImage(videoEl, 0, 0, vw, vh);
  return true;
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

  const wrap = document.createElement('div');
  wrap.id = 'ar-ew-dom-hologram';
  wrap.className = 'ar-ew-dom-hologram';
  wrap.setAttribute('aria-hidden', 'true');

  const canvas = document.createElement('canvas');
  canvas.className = 'ar-ew-dom-hologram-canvas';
  wrap.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: true });
  const maskCanvas = sideBySideAlpha ? document.createElement('canvas') : null;
  const maskCtx = maskCanvas?.getContext('2d', { willReadFrequently: true });

  host.appendChild(wrap);

  let active = false;
  let hasLayout = false;
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

  const updateVideoFrame = () => {
    if (!sourceVideoEl) return;
    try {
      if (sideBySideAlpha) {
        compositeSideBySideFrame(ctx, maskCtx, sourceVideoEl, canvas);
      } else {
        drawOpaqueFrame(ctx, sourceVideoEl, canvas);
      }
    } catch {
      // CORS/taint — last good frame stays visible
    }
  };

  const applyLayout = (left, top, width, height, immediate = false) => {
    const vp = getViewport();
    const minH = vp.height * MIN_HEIGHT_RATIO;
    const maxH = vp.height * MAX_HEIGHT_RATIO;
    let h = Math.min(maxH, Math.max(minH, height * SIZE_GAIN));
    let w = h * PORTRAIT_ASPECT;

    const maxW = vp.width * 0.92;
    if (w > maxW) {
      w = maxW;
      h = w / PORTRAIT_ASPECT;
    }

    const targetLeft = left - w / 2;
    const targetTop = top - h;

    if (!hasLayout || immediate) {
      smooth.left = targetLeft;
      smooth.top = targetTop;
      smooth.width = w;
      smooth.height = h;
      hasLayout = true;
    } else {
      const a = SMOOTH_ALPHA;
      smooth.left += (targetLeft - smooth.left) * a;
      smooth.top += (targetTop - smooth.top) * a;
      smooth.width += (w - smooth.width) * a;
      smooth.height += (h - smooth.height) * a;
    }

    wrap.style.width = `${smooth.width}px`;
    wrap.style.height = `${smooth.height}px`;
    wrap.style.left = `${smooth.left}px`;
    wrap.style.top = `${smooth.top}px`;
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

    if (
      !Number.isFinite(scratch.projectedBottom.z)
      || scratch.projectedBottom.z > 1
      || scratch.projectedTop.z > 1
    ) {
      return hasLayout;
    }

    const vp = getViewport();
    const bottomX = vp.offsetLeft + (scratch.projectedBottom.x * 0.5 + 0.5) * vp.width;
    const bottomY = vp.offsetTop + (-scratch.projectedBottom.y * 0.5 + 0.5) * vp.height;
    const topY = vp.offsetTop + (-scratch.projectedTop.y * 0.5 + 0.5) * vp.height;

    let heightPx = Math.abs(bottomY - topY);
    if (!Number.isFinite(heightPx) || heightPx < 8) {
      const dist = camera.position.distanceTo(scratch.bottom);
      if (!Number.isFinite(dist) || dist < 0.1) return hasLayout;
      const vFov = getCameraVerticalFovRad(camera);
      heightPx = ((planeHeight / dist) / Math.tan(vFov / 2)) * vp.height;
    }

    applyLayout(bottomX, bottomY, heightPx * PORTRAIT_ASPECT, heightPx);
    return true;
  };

  const reveal = () => {
    updateVideoFrame();
    wrap.classList.add('visible');
    sourceVideoEl.play?.().catch(() => {});
  };

  return {
    root: wrap,
    getDisplayVideo: () => sourceVideoEl,

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
      wrap.classList.remove('visible');
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
      }

      wrap.classList.add('visible');
    },

    destroy() {
      active = false;
      hasLayout = false;
      wrap.remove();
    },
  };
};
