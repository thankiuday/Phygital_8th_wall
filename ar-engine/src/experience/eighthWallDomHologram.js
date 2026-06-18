/**
 * eighthWallDomHologram — screen-projected HTML hologram for iOS 8th Wall.
 *
 * 8th Wall's WebGL stack often fails to composite video textures on iOS Safari
 * even when audio and DOM UI work. This overlay paints the same <video> into
 * screen space using the SLAM anchor pose each frame.
 */

const PLANE_ASPECT = 9 / 16;

/**
 * @param {{
 *   domRoot: HTMLElement,
 *   videoEl: HTMLVideoElement,
 *   planeWidth: number,
 *   planeHeight: number,
 *   sideBySideAlpha?: boolean,
 * }} opts
 */
export const createEighthWallDomHologram = ({
  domRoot,
  videoEl,
  planeWidth,
  planeHeight,
  sideBySideAlpha = false,
}) => {
  const wrap = document.createElement('div');
  wrap.id = 'ar-ew-dom-hologram';
  wrap.className = 'ar-ew-dom-hologram';
  wrap.setAttribute('aria-hidden', 'true');

  let displayEl = videoEl;
  let canvas = null;
  let ctx = null;
  let maskCanvas = null;
  let maskCtx = null;

  if (sideBySideAlpha) {
    canvas = document.createElement('canvas');
    canvas.className = 'ar-ew-dom-hologram-canvas';
    displayEl = canvas;
    ctx = canvas.getContext('2d', { alpha: true });
    maskCanvas = document.createElement('canvas');
    maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
  } else {
    videoEl.classList.add('ar-ew-dom-hologram-video');
    videoEl.remove();
  }

  wrap.appendChild(displayEl);
  domRoot.appendChild(wrap);

  const scratch = {
    bottom: null,
    projected: null,
  };

  const compositeSideBySide = () => {
    if (!ctx || !videoEl || videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    if (!vw || !vh) return;

    const hw = Math.floor(vw / 2);
    if (canvas.width !== hw || canvas.height !== vh) {
      canvas.width = hw;
      canvas.height = vh;
      maskCanvas.width = hw;
      maskCanvas.height = vh;
    }

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
  };

  const updateVideoFrame = () => {
    if (sideBySideAlpha) {
      compositeSideBySide();
    }
  };

  /**
   * @param {object} THREE
   * @param {THREE.Camera} camera
   * @param {THREE.Object3D} anchorGroup
   */
  const update = (THREE, camera, anchorGroup) => {
    if (!THREE || !camera || !anchorGroup) return;

    if (!scratch.bottom) {
      scratch.bottom = new THREE.Vector3();
      scratch.projected = new THREE.Vector3();
    }

    anchorGroup.getWorldPosition(scratch.bottom);

    const dist = camera.position.distanceTo(scratch.bottom);
    if (!Number.isFinite(dist) || dist < 0.05) {
      wrap.classList.remove('visible');
      return;
    }

    scratch.projected.copy(scratch.bottom).project(camera);
    if (scratch.projected.z > 1) {
      wrap.classList.remove('visible');
      return;
    }

    const vFov = (camera.fov ?? 60) * (Math.PI / 180);
    const heightPx = (planeHeight / dist) / Math.tan(vFov / 2) * window.innerHeight;
    const widthPx = heightPx * PLANE_ASPECT;

    const x = (scratch.projected.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-scratch.projected.y * 0.5 + 0.5) * window.innerHeight;

    wrap.style.width = `${Math.max(24, widthPx)}px`;
    wrap.style.height = `${Math.max(42, heightPx)}px`;
    wrap.style.left = `${x - widthPx / 2}px`;
    wrap.style.top = `${y - heightPx}px`;

    updateVideoFrame();
    wrap.classList.add('visible');
  };

  return {
    root: wrap,

    show() {
      wrap.classList.add('visible');
      if (!sideBySideAlpha) {
        videoEl.style.display = '';
      }
      updateVideoFrame();
    },

    hide() {
      wrap.classList.remove('visible');
      if (!sideBySideAlpha) {
        videoEl.style.display = 'none';
      }
    },

    update,
    updateVideoFrame,

    destroy() {
      wrap.remove();
      if (!sideBySideAlpha) {
        videoEl.classList.remove('ar-ew-dom-hologram-video');
        videoEl.style.display = 'none';
        if (!videoEl.parentElement || videoEl.parentElement === wrap) {
          document.body.appendChild(videoEl);
        }
      }
    },
  };
};
