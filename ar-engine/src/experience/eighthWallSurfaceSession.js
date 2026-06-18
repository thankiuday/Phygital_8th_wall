/**
 * eighthWallSurfaceSession — 8th Wall SLAM tap-to-place for iOS surface AR.
 *
 * Uses XR8.XrController.hitTest (SLAM feature points) with the same horizontal
 * surface scoring and matrix-based placement as WebXR on Android.
 */

import { loadEighthWallEngine } from './loadEighthWallEngine.js';
import { createPlacementReticle } from './surfaceTrackingSession.js';
import {
  applyMatrixToGroup,
  applyMatrixToReticle,
  isPlacementUiTarget,
  liftPlacementMatrix,
  queryPlacementHit,
  queryPlacementHitAtScreen,
  queryTapPlacementHit,
  resetGroupTransform,
} from './eighthWallSurfaceHitUtils.js';
import { getHitTestNormFromClient } from './surfaceHitUtils.js';

const MIN_SCAN_BEFORE_READY_MS = 1500;
const GROUND_FALLBACK_AFTER_MS = 2500;
const MIN_STABLE_FEATURE_FRAMES = 4;
const MIN_STABLE_GROUND_FRAMES = 8;
const MISS_FRAMES_TO_HIDE = 14;
const MISS_FRAMES_BEFORE_DECAY = 5;
const POSE_CACHE_MS = 2000;
const MIN_PLACEMENT_DISTANCE = 0.2;
const MAX_PLACEMENT_DISTANCE = 6;

/** @type {EighthWallSurfaceSession | null} */
let activePlacementSession = null;
let placementPipelineRegistered = false;

const isEmbeddedSurfaceShell = () =>
  Boolean(document.getElementById('surface-ar-shell'));

/** Keep the XR canvas edge-to-edge inside the surface shell (portrait fullscreen). */
const fitFullscreenCanvas = (canvas) => {
  if (!canvas) return;

  const host =
    document.getElementById('ar-root')
    || document.getElementById('surface-ar-shell')
    || canvas.parentElement;

  if (host && !host.contains(canvas)) {
    host.prepend(canvas);
  }

  Object.assign(canvas.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    width: '100%',
    height: '100%',
    maxWidth: 'none',
    maxHeight: 'none',
    display: 'block',
    zIndex: '0',
    objectFit: 'cover',
  });
};

const bindEmbeddedCanvas = (canvas) => {
  if (!canvas) return () => {};

  const fit = () => fitFullscreenCanvas(canvas);
  fit();
  window.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('resize', fit);
  return () => {
    window.removeEventListener('resize', fit);
    window.visualViewport?.removeEventListener('resize', fit);
  };
};

const registerPlacementPipeline = (XR8, XRExtras) => {
  if (placementPipelineRegistered) return;

  const placementModule = () => ({
    name: 'phygital-surface-placement',
    onStart: () => activePlacementSession?._pipelineOnStart(),
    onUpdate: () => activePlacementSession?._pipelineOnUpdate(),
  });

  const embeddedCanvasModule = () => ({
    name: 'phygital-embedded-canvas',
    onStart: ({ canvas }) => {
      activePlacementSession?._bindEmbeddedCanvas(canvas);
    },
  });

  const modules = [
    XR8.GlTextureRenderer.pipelineModule(),
    XR8.Threejs.pipelineModule(),
    XRExtras.FullWindowCanvas.pipelineModule(),
    XR8.XrController.pipelineModule(),
  ];

  if (isEmbeddedSurfaceShell()) {
    modules.push(embeddedCanvasModule());
  }

  modules.push(placementModule());

  XR8.addCameraPipelineModules(modules);

  placementPipelineRegistered = true;
};

/**
 * @param {{
 *   container: HTMLElement,
 *   anchorGroup?: THREE.Group,
 *   reticle?: THREE.Group,
 *   onPlaced?: () => void,
 *   onRescan?: () => void,
 *   onAnimate?: (time: number) => void,
 *   onHitVisibilityChange?: (visible: boolean) => void,
 *   onPrimeVideo?: () => void,
 *   onSceneReady?: (ctx: {
 *     scene: THREE.Scene,
 *     camera: THREE.Camera,
 *     renderer: THREE.WebGLRenderer,
 *     THREE: object,
 *   }) => { anchorGroup: THREE.Group, reticle: THREE.Group } | void | Promise<...>,
 * }} opts
 */
export class EighthWallSurfaceSession {
  constructor({
    container,
    anchorGroup,
    reticle,
    onPlaced,
    onRescan,
    onAnimate,
    onHitVisibilityChange,
    onPrimeVideo,
    onSceneReady,
  } = {}) {
    this._container = container;
    this._anchorGroup = anchorGroup || null;
    this._reticle = reticle || null;
    this._onPlaced = onPlaced;
    this._onRescan = onRescan;
    this._onAnimate = onAnimate;
    this._onHitVisibilityChange = onHitVisibilityChange;
    this._onPrimeVideo = onPrimeVideo;
    this._onSceneReady = onSceneReady;

    this._placed = false;
    this._hitVisible = false;
    this._canvas = null;
    this._touchHandler = null;
    this._shellTouchHandler = null;
    this._touchMoveHandler = null;
    this._XR8 = null;
    this._running = false;
    this._cameraStarted = false;
    this._sceneReadyPromise = null;
    this._sceneReadyResolve = null;
    this._sceneReadyReject = null;
    this._unbindEmbeddedCanvas = null;
    this._sceneReadyAt = 0;
    this._scanStartedAt = 0;
    this._stableHitCount = 0;
    this._missCount = 0;
    this._cachedPose = null;
    this._cachedPoseTs = 0;
    this._scratchMatrix = null;
    this._lastPlacementScreen = null;
  }

  get lastPlacementScreen() {
    return this._lastPlacementScreen;
  }

  get placed() {
    return this._placed;
  }

  get hitVisible() {
    return this._hitVisible;
  }

  bindCallbacks({
    onPlaced,
    onRescan,
    onAnimate,
    onHitVisibilityChange,
    onPrimeVideo,
    onSceneReady,
  } = {}) {
    if (onPlaced) this._onPlaced = onPlaced;
    if (onRescan) this._onRescan = onRescan;
    if (onAnimate) this._onAnimate = onAnimate;
    if (onHitVisibilityChange) this._onHitVisibilityChange = onHitVisibilityChange;
    if (onPrimeVideo) this._onPrimeVideo = onPrimeVideo;
    if (onSceneReady) this._onSceneReady = onSceneReady;

    if (this._pendingSceneCtx && onSceneReady) {
      this._finishSceneSetup(this._pendingSceneCtx);
    }
  }

  waitForSceneReady() {
    return this._sceneReadyPromise || Promise.resolve();
  }

  _bindEmbeddedCanvas(canvas) {
    this._unbindEmbeddedCanvas?.();
    this._unbindEmbeddedCanvas = bindEmbeddedCanvas(canvas);
  }

  _setHitVisible(visible) {
    if (this._hitVisible === visible) return;
    this._hitVisible = visible;
    this._onHitVisibilityChange?.(visible);
  }

  _cachePose(matrix) {
    if (!this._cachedPose) {
      this._cachedPose = new Float32Array(16);
    }
    this._cachedPose.set(matrix.elements);
    this._cachedPoseTs = performance.now();
  }

  /**
   * Query SLAM feature points; y=0 ground plane only after a long scan delay.
   */
  _queryBestSurfaceHit() {
    const hitTest = this._XR8?.XrController?.hitTest?.bind(this._XR8.XrController);
    const THREE = window.THREE;
    const camera = this._XR8?.Threejs?.xrScene?.()?.camera;
    if (!THREE || !camera || !this._sceneReadyAt) return null;

    const scanElapsed = performance.now() - this._sceneReadyAt;
    if (scanElapsed < MIN_SCAN_BEFORE_READY_MS) return null;

    return queryPlacementHit(THREE, hitTest, camera, {
      allowGround: scanElapsed >= GROUND_FALLBACK_AFTER_MS,
    });
  }

  /**
   * Start the camera inside the same user gesture as the Launch button tap.
   * Requires loadEighthWallEngine() to have completed beforehand.
   */
  beginCameraInUserGesture() {
    const XR8 = window.XR8;
    const XRExtras = window.XRExtras;
    if (!window.THREE) {
      throw new Error('window.THREE does not exist but is required by the ThreeJS pipeline module');
    }
    if (!XR8?.run || !XRExtras) {
      throw new Error('8th Wall engine not loaded yet.');
    }

    this._XR8 = XR8;
    activePlacementSession = this;

    this._sceneReadyPromise = new Promise((resolve, reject) => {
      this._sceneReadyResolve = resolve;
      this._sceneReadyReject = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.id = 'camerafeed';
    canvas.className = 'eighthwall-camerafeed';
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      display: 'block',
      zIndex: '0',
    });
    this._container.prepend(canvas);
    this._canvas = canvas;

    this._scanStartedAt = performance.now();
    this._stableHitCount = 0;

    registerPlacementPipeline(XR8, XRExtras);

    XR8.run({
      canvas,
      allowedDevices: XR8.XrConfig.device().MOBILE,
    });

    this._cameraStarted = true;
  }

  async start() {
    await loadEighthWallEngine();
    if (!this._cameraStarted) {
      this.beginCameraInUserGesture();
    }
    await this.waitForSceneReady();
  }

  _pipelineOnStart() {
    const XR8 = this._XR8;
    const xrScene = XR8?.Threejs?.xrScene?.();
    if (!xrScene) return;

    const { scene, camera, renderer } = xrScene;
    const THREE = window.THREE;
    if (!THREE) {
      this._sceneReadyReject?.(new Error('8th Wall Three.js runtime not available.'));
      return;
    }

    if (this._onSceneReady) {
      this._finishSceneSetup({ scene, camera, renderer, THREE });
    } else {
      this._pendingSceneCtx = { scene, camera, renderer, THREE };
    }
  }

  async _finishSceneSetup(ctx) {
    const { scene, camera, renderer, THREE } = ctx;
    this._pendingSceneCtx = null;

    try {
      const setup = await this._onSceneReady?.({ scene, camera, renderer, THREE });
      if (setup?.anchorGroup) this._anchorGroup = setup.anchorGroup;
      if (setup?.reticle) this._reticle = setup.reticle;

      if (!this._anchorGroup || !this._reticle) {
        throw new Error('Surface scene setup did not provide anchor and reticle.');
      }

      this._scratchMatrix = new THREE.Matrix4();

      renderer.shadowMap.enabled = false;

      if (renderer?.setSize) {
        renderer.setSize(window.innerWidth, window.innerHeight, false);
      }
      if (this._canvas) {
        fitFullscreenCanvas(this._canvas);
      }

      if (!this._anchorGroup.parent) {
        scene.add(this._anchorGroup);
      }
      if (!this._reticle.parent) {
        scene.add(this._reticle);
      }

      this._XR8.XrController.updateCameraProjectionMatrix({
        origin: camera.position,
        facing: camera.quaternion,
      });

      this._touchHandler = (event) => this._onTouchStart(event);
      this._touchMoveHandler = (event) => event.preventDefault();

      const touchRoot =
        document.getElementById('surface-ar-shell')
        || document.getElementById('ar-dom-overlay')
        || this._container;

      this._shellTouchHandler = this._touchHandler;
      touchRoot.addEventListener('touchstart', this._shellTouchHandler, {
        capture: true,
        passive: false,
      });
      this._canvas.addEventListener('touchmove', this._touchMoveHandler, { passive: false });

      document.getElementById('ar-dom-overlay')?.classList.add('placement-scanning');

      this._sceneReadyAt = performance.now();
      this._running = true;
      this._sceneReadyResolve?.();
    } catch (err) {
      this._sceneReadyReject?.(err);
      throw err;
    }
  }

  _isHitInRange(hit) {
    if (!hit) return false;
    const dist = hit.distance;
    if (!Number.isFinite(dist)) return true;
    return dist >= MIN_PLACEMENT_DISTANCE && dist <= MAX_PLACEMENT_DISTANCE;
  }

  _pipelineOnUpdate() {
    if (!this._running) return;

    const xrScene = this._XR8?.Threejs?.xrScene?.();
    const camera = xrScene?.camera;
    if (camera) {
      this._XR8.XrController.updateCameraProjectionMatrix({
        origin: camera.position,
        facing: camera.quaternion,
      });
    }

    if (!this._placed) {
      const hit = this._queryBestSurfaceHit();
      const inRange = this._isHitInRange(hit);
      const requiredStable = hit?.source === 'ground'
        ? MIN_STABLE_GROUND_FRAMES
        : MIN_STABLE_FEATURE_FRAMES;

      if (hit && inRange) {
        this._missCount = 0;
        this._stableHitCount = Math.min(
          this._stableHitCount + 1,
          requiredStable,
        );
      } else {
        this._missCount = Math.min(this._missCount + 1, MISS_FRAMES_TO_HIDE);
        if (this._missCount >= MISS_FRAMES_BEFORE_DECAY) {
          this._stableHitCount = Math.max(0, this._stableHitCount - 1);
        }
      }

      const placementReady = this._stableHitCount >= requiredStable;

      if (placementReady && hit && inRange) {
        const lifted = liftPlacementMatrix(window.THREE, hit.matrix);
        this._reticle.visible = true;
        applyMatrixToReticle(this._reticle, lifted);
        this._cachePose(lifted);
        this._setHitVisible(true);
      } else if (this._missCount >= MISS_FRAMES_TO_HIDE) {
        this._reticle.visible = false;
        this._setHitVisible(false);
      }
    }

    this._onAnimate?.(performance.now());
  }

  _onTouchStart(event) {
    if (this._placed) return;
    if (isPlacementUiTarget(event.target)) return;

    if (event.touches.length === 2) {
      this._XR8?.XrController?.recenter?.();
      this._scanStartedAt = performance.now();
      this._stableHitCount = 0;
      this._missCount = 0;
      return;
    }
    if (event.touches.length !== 1) return;

    const cacheFresh = this._cachedPose
      && (performance.now() - this._cachedPoseTs) < POSE_CACHE_MS;
    const canPlace = this._reticle.visible || (this._hitVisible && cacheFresh);
    if (!canPlace) return;

    event.preventDefault();
    event.stopPropagation();

    const touch = event.touches[0];
    const screenNorm = getHitTestNormFromClient(touch.clientX, touch.clientY);
    const normX = screenNorm.x;
    const normY = screenNorm.y;
    const hitTest = this._XR8?.XrController?.hitTest?.bind(this._XR8.XrController);
    const camera = this._XR8?.Threejs?.xrScene?.()?.camera;
    const tapHit = queryTapPlacementHit(
      window.THREE,
      hitTest,
      camera,
      normX,
      normY,
    );

    let placed = false;
    if (tapHit) {
      const lifted = liftPlacementMatrix(window.THREE, tapHit.matrix);
      applyMatrixToGroup(this._anchorGroup, lifted);
      placed = true;
    } else if (this._reticle.visible) {
      applyMatrixToGroup(this._anchorGroup, this._reticle.matrix);
      placed = true;
    } else if (this._cachedPose && this._scratchMatrix) {
      this._scratchMatrix.fromArray(this._cachedPose);
      applyMatrixToGroup(this._anchorGroup, this._scratchMatrix);
      placed = true;
    }

    if (!placed) return;

    this._lastPlacementScreen = { normX, normY };
    this._anchorGroup?.updateMatrixWorld?.(true);

    this._onPrimeVideo?.();

    this._placed = true;
    this._reticle.visible = false;
    this._setHitVisible(false);
    document.getElementById('ar-dom-overlay')?.classList.remove('placement-scanning');
    this._onPlaced?.();
  }

  resetPlacement() {
    this._placed = false;
    this._hitVisible = false;
    this._stableHitCount = 0;
    this._missCount = 0;
    this._scanStartedAt = performance.now();
    this._cachedPose = null;
    this._lastPlacementScreen = null;
    if (this._reticle) this._reticle.visible = false;
    if (this._anchorGroup) {
      resetGroupTransform(this._anchorGroup);
    }
    document.getElementById('ar-dom-overlay')?.classList.add('placement-scanning');
    this._onRescan?.();
  }

  async destroy() {
    this._running = false;
    this._unbindEmbeddedCanvas?.();
    this._unbindEmbeddedCanvas = null;

    if (activePlacementSession === this) {
      activePlacementSession = null;
    }

    if (this._canvas) {
      if (this._shellTouchHandler) {
        const touchRoot =
          document.getElementById('surface-ar-shell')
          || document.getElementById('ar-dom-overlay')
          || this._container;
        touchRoot.removeEventListener('touchstart', this._shellTouchHandler, true);
      }
      if (this._touchMoveHandler) {
        this._canvas.removeEventListener('touchmove', this._touchMoveHandler);
      }
    }

    try {
      this._XR8?.pause?.();
    } catch {
      // ignore
    }

    this._canvas?.remove();
    this._canvas = null;
    this._XR8 = null;
    this._cameraStarted = false;
  }
}

export { createPlacementReticle };
