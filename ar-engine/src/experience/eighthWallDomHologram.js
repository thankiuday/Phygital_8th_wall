/**
 * eighthWallDomHologram — iOS 8th Wall hologram as an HTML video overlay.
 *
 * WebGL video planes are unreliable on 8th Wall + iOS Safari. A dedicated
 * display <video> (separate from any WebGL texture source) is positioned at
 * the tap point first, then tracks the SLAM anchor when projection is stable.
 */

const PLANE_ASPECT = 16 / 9;

const defaultScreenNorm = () => ({ x: 0.5, y: 0.66 });

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

const applyFixedScreenLayout = (wrap, normX, normY) => {
  const vv = window.visualViewport;
  const vw = vv?.width ?? window.innerWidth;
  const vh = vv?.height ?? window.innerHeight;
  const ox = vv?.offsetLeft ?? 0;
  const oy = vv?.offsetTop ?? 0;

  const width = Math.min(vw * 0.72, 320);
  const height = width * PLANE_ASPECT;
  const x = ox + normX * vw;
  const y = oy + normY * vh;

  wrap.style.width = `${width}px`;
  wrap.style.height = `${height}px`;
  wrap.style.left = `${x - width / 2}px`;
  wrap.style.top = `${y - height}px`;
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

  const displayVideo = cloneVideoForDisplay(sourceVideoEl);
  let displayEl = displayVideo;

  if (sideBySideAlpha) {
    const sbs = document.createElement('div');
    sbs.className = 'ar-ew-dom-hologram-sbs';
    sbs.appendChild(displayVideo);
    displayEl = sbs;
  }

  wrap.appendChild(displayEl);
  host.appendChild(wrap);

  sourceVideoEl.addEventListener('loadeddata', () => {
    if (displayVideo.src !== sourceVideoEl.src) {
      displayVideo.src = sourceVideoEl.src;
      displayVideo.load();
    }
  });

  let active = false;
  let screenNorm = defaultScreenNorm();
  let useTrackedLayout = false;

  const scratch = {
    bottom: null,
    projected: null,
  };

  const syncDisplayVideo = () => {
    if (!sourceVideoEl || !displayVideo) return;
    if (displayVideo.src !== sourceVideoEl.src) {
      displayVideo.src = sourceVideoEl.src;
    }
    if (
      sourceVideoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      && Math.abs(displayVideo.currentTime - sourceVideoEl.currentTime) > 0.12
    ) {
      try {
        displayVideo.currentTime = sourceVideoEl.currentTime;
      } catch {
        // ignore seek errors during startup
      }
    }
    if (!sourceVideoEl.paused && displayVideo.paused) {
      displayVideo.play().catch(() => {});
    }
  };

  const applyTrackedLayout = (THREE, camera, anchorGroup) => {
    if (!scratch.bottom) {
      scratch.bottom = new THREE.Vector3();
      scratch.projected = new THREE.Vector3();
    }

    camera.updateMatrixWorld?.(true);
    anchorGroup.updateMatrixWorld?.(true);
    anchorGroup.getWorldPosition(scratch.bottom);

    const dist = camera.position.distanceTo(scratch.bottom);
    if (!Number.isFinite(dist) || dist < 0.15) return false;

    scratch.projected.copy(scratch.bottom).project(camera);
    if (!Number.isFinite(scratch.projected.z) || scratch.projected.z > 1) {
      return false;
    }

    const vv = window.visualViewport;
    const vw = vv?.width ?? window.innerWidth;
    const vh = vv?.height ?? window.innerHeight;
    const ox = vv?.offsetLeft ?? 0;
    const oy = vv?.offsetTop ?? 0;

    const vFov = (camera.fov ?? 60) * (Math.PI / 180);
    const heightPx = (planeHeight / dist) / Math.tan(vFov / 2) * vh;
    const widthPx = heightPx / PLANE_ASPECT;

    const x = ox + (scratch.projected.x * 0.5 + 0.5) * vw;
    const y = oy + (-scratch.projected.y * 0.5 + 0.5) * vh;

    wrap.style.width = `${Math.max(48, widthPx)}px`;
    wrap.style.height = `${Math.max(85, heightPx)}px`;
    wrap.style.left = `${x - widthPx / 2}px`;
    wrap.style.top = `${y - heightPx}px`;
    return true;
  };

  const reveal = () => {
    syncDisplayVideo();
    wrap.classList.add('visible');
    displayVideo.play().catch(() => {});
  };

  return {
    root: wrap,
    getDisplayVideo: () => displayVideo,

    showAtScreen(normX, normY) {
      active = true;
      useTrackedLayout = false;
      screenNorm = {
        x: Number.isFinite(normX) ? normX : 0.5,
        y: Number.isFinite(normY) ? normY : 0.66,
      };
      applyFixedScreenLayout(wrap, screenNorm.x, screenNorm.y);
      reveal();
    },

    show() {
      this.showAtScreen(screenNorm.x, screenNorm.y);
    },

    hide() {
      active = false;
      useTrackedLayout = false;
      wrap.classList.remove('visible');
      displayVideo.pause();
    },

    syncFromSource() {
      if (!active) return;
      displayVideo.muted = sourceVideoEl.muted;
      syncDisplayVideo();
    },

    update(THREE, camera, anchorGroup) {
      if (!active) return;

      syncDisplayVideo();

      if (THREE && camera && anchorGroup) {
        const tracked = applyTrackedLayout(THREE, camera, anchorGroup);
        if (tracked) {
          useTrackedLayout = true;
        } else if (!useTrackedLayout) {
          applyFixedScreenLayout(wrap, screenNorm.x, screenNorm.y);
        }
      }

      wrap.classList.add('visible');
    },

    destroy() {
      active = false;
      displayVideo.pause();
      displayVideo.removeAttribute('src');
      displayVideo.load();
      wrap.remove();
    },
  };
};
