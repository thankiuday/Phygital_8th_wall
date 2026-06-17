/**
 * eighthWallSurfaceSession — 8th Wall SLAM tap-to-place for iOS surface AR.
 *
 * Based on the official placeground Three.js example:
 * https://github.com/8thwall/web/tree/master/examples/threejs/placeground
 */

import { loadEighthWallEngine } from './loadEighthWallEngine.js';
import { createPlacementReticle } from './surfaceTrackingSession.js';

const GROUND_SIZE = 100;
const SLAM_WARMUP_MS = 1800;
const MIN_STABLE_HIT_FRAMES = 14;
const MIN_LOOK_DOWN_DOT = 0.32;

/** @type {THREE.Vector3 | null} */
let scratchForward = null;

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
    onSceneReady,
  } = {}) {
    this._container = container;
    this._anchorGroup = anchorGroup || null;
    this._reticle = reticle || null;
    this._onPlaced = onPlaced;
    this._onRescan = onRescan;
    this._onAnimate = onAnimate;
    this._onHitVisibilityChange = onHitVisibilityChange;
    this._onSceneReady = onSceneReady;

    this._placed = false;
    this._hitVisible = false;
    this._canvas = null;
    this._surface = null;
    this._raycaster = null;
    this._tapPosition = null;
    this._touchHandler = null;
    this._touchMoveHandler = null;
    this._XR8 = null;
    this._running = false;
    this._cameraStarted = false;
    this._sceneReadyPromise = null;
    this._sceneReadyResolve = null;
    this._sceneReadyReject = null;
    this._unbindEmbeddedCanvas = null;
    this._scanStartedAt = 0;
    this._stableHitCount = 0;
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
    onSceneReady,
  } = {}) {
    if (onPlaced) this._onPlaced = onPlaced;
    if (onRescan) this._onRescan = onRescan;
    if (onAnimate) this._onAnimate = onAnimate;
    if (onHitVisibilityChange) this._onHitVisibilityChange = onHitVisibilityChange;
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

      this._raycaster = new THREE.Raycaster();
      this._tapPosition = new THREE.Vector2();

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

      this._surface = new THREE.Mesh(
        new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 1, 1),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      this._surface.rotateX(-Math.PI / 2);
      this._surface.position.set(0, 0, 0);
      scene.add(this._surface);

      this._XR8.XrController.updateCameraProjectionMatrix({
        origin: camera.position,
        facing: camera.quaternion,
      });

      this._touchHandler = (event) => this._onTouchStart(event, camera);
      this._touchMoveHandler = (event) => event.preventDefault();

      this._canvas.addEventListener('touchstart', this._touchHandler, true);
      this._canvas.addEventListener('touchmove', this._touchMoveHandler, { passive: false });

      this._running = true;
      this._sceneReadyResolve?.();
    } catch (err) {
      this._sceneReadyReject?.(err);
      throw err;
    }
  }

  _isSurfaceScanReady(camera, hitPoint) {
    const THREE = window.THREE;
    if (!THREE || !camera || !hitPoint) return false;

    if (performance.now() - this._scanStartedAt < SLAM_WARMUP_MS) {
      return false;
    }

    if (!scratchForward) scratchForward = new THREE.Vector3();
    scratchForward.set(0, 0, -1).applyQuaternion(camera.quaternion);

    // Require the user to tilt the phone down toward a floor/table, like WebXR scanning.
    if (scratchForward.y > -MIN_LOOK_DOWN_DOT) return false;

    if (hitPoint.y > camera.position.y - 0.08) return false;

    const dist = hitPoint.distanceTo(camera.position);
    if (dist < 0.25 || dist > 6) return false;

    return true;
  }

  _pipelineOnUpdate() {
    if (!this._running) return;

    if (!this._placed) {
      const { camera } = this._XR8.Threejs.xrScene();
      const THREE = window.THREE;
      if (THREE && this._raycaster && this._surface && camera) {
        this._tapPosition.set(0, 0);
        this._raycaster.setFromCamera(this._tapPosition, camera);
        const hits = this._raycaster.intersectObject(this._surface);

        if (hits.length > 0) {
          const point = hits[0].point;
          const ready = this._isSurfaceScanReady(camera, point);

          if (ready) {
            this._stableHitCount = Math.min(
              this._stableHitCount + 1,
              MIN_STABLE_HIT_FRAMES,
            );
          } else {
            this._stableHitCount = 0;
          }

          if (this._stableHitCount >= MIN_STABLE_HIT_FRAMES) {
            this._reticle.visible = true;
            this._reticle.position.copy(point);
            this._reticle.rotation.set(-Math.PI / 2, 0, 0);
            this._setHitVisible(true);
          } else {
            this._reticle.visible = false;
            this._setHitVisible(false);
          }
        } else {
          this._stableHitCount = 0;
          this._reticle.visible = false;
          this._setHitVisible(false);
        }
      }
    }

    this._onAnimate?.(performance.now());
  }

  _onTouchStart(event, camera) {
    if (!this._raycaster || !this._surface || this._placed) return;
    if (!this._hitVisible || this._stableHitCount < MIN_STABLE_HIT_FRAMES) return;

    if (event.touches.length === 2) {
      this._XR8?.XrController?.recenter?.();
      return;
    }
    if (event.touches.length !== 1) return;

    event.preventDefault();

    const touch = event.touches[0];
    this._tapPosition.x = (touch.clientX / window.innerWidth) * 2 - 1;
    this._tapPosition.y = -(touch.clientY / window.innerHeight) * 2 + 1;

    this._raycaster.setFromCamera(this._tapPosition, camera);
    const hits = this._raycaster.intersectObject(this._surface);
    if (hits.length === 0) return;

    const point = hits[0].point;
    this._anchorGroup.position.set(point.x, point.y, point.z);
    this._anchorGroup.quaternion.identity();
    this._anchorGroup.scale.set(1, 1, 1);
    this._anchorGroup.updateMatrixWorld(true);

    this._placed = true;
    this._reticle.visible = false;
    this._setHitVisible(false);
    this._onPlaced?.();
  }

  resetPlacement() {
    this._placed = false;
    this._hitVisible = false;
    this._stableHitCount = 0;
    this._scanStartedAt = performance.now();
    if (this._reticle) this._reticle.visible = false;
    if (this._anchorGroup) {
      this._anchorGroup.position.set(0, 0, 0);
      this._anchorGroup.quaternion.identity();
      this._anchorGroup.scale.set(1, 1, 1);
    }
  }

  async destroy() {
    this._running = false;
    this._unbindEmbeddedCanvas?.();
    this._unbindEmbeddedCanvas = null;

    if (activePlacementSession === this) {
      activePlacementSession = null;
    }

    if (this._canvas) {
      if (this._touchHandler) {
        this._canvas.removeEventListener('touchstart', this._touchHandler, true);
      }
      if (this._touchMoveHandler) {
        this._canvas.removeEventListener('touchmove', this._touchMoveHandler);
      }
    }

    if (this._surface?.parent) {
      this._surface.parent.remove(this._surface);
    }
    this._surface = null;

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
