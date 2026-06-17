/**
 * eighthWallSurfaceSession — 8th Wall SLAM tap-to-place for iOS surface AR.
 *
 * Based on the official placeground Three.js example:
 * https://github.com/8thwall/web/tree/master/examples/threejs/placeground
 */

import { loadEighthWallEngine } from './loadEighthWallEngine.js';
import { createPlacementReticle } from './surfaceTrackingSession.js';

const GROUND_SIZE = 100;

/**
 * @param {{
 *   container: HTMLElement,
 *   anchorGroup?: THREE.Group,
 *   reticle?: THREE.Group,
 *   onPlaced: () => void,
 *   onRescan: () => void,
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
  }) {
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
  }

  get placed() {
    return this._placed;
  }

  get hitVisible() {
    return this._hitVisible;
  }

  _setHitVisible(visible) {
    if (this._hitVisible === visible) return;
    this._hitVisible = visible;
    this._onHitVisibilityChange?.(visible);
  }

  async start() {
    const { XR8, XRExtras } = await loadEighthWallEngine();
    this._XR8 = XR8;

    const canvas = document.createElement('canvas');
    canvas.id = 'camerafeed';
    canvas.className = 'eighthwall-camerafeed';
    this._container.prepend(canvas);
    this._canvas = canvas;

    const session = this;

    const scenePipelineModule = () => ({
      name: 'phygital-surface-placement',

      onStart: async () => {
        const xrScene = XR8.Threejs.xrScene();
        const { scene, camera, renderer } = xrScene;
        const THREE = window.THREE;

        if (!THREE) {
          throw new Error('8th Wall Three.js runtime not available.');
        }

        const setup = await session._onSceneReady?.({ scene, camera, renderer, THREE });
        if (setup?.anchorGroup) session._anchorGroup = setup.anchorGroup;
        if (setup?.reticle) session._reticle = setup.reticle;

        if (!session._anchorGroup || !session._reticle) {
          throw new Error('Surface scene setup did not provide anchor and reticle.');
        }

        session._raycaster = new THREE.Raycaster();
        session._tapPosition = new THREE.Vector2();

        renderer.shadowMap.enabled = false;

        if (!session._anchorGroup.parent) {
          scene.add(session._anchorGroup);
        }
        if (!session._reticle.parent) {
          scene.add(session._reticle);
        }

        session._surface = new THREE.Mesh(
          new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 1, 1),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        session._surface.rotateX(-Math.PI / 2);
        session._surface.position.set(0, 0, 0);
        scene.add(session._surface);

        XR8.XrController.updateCameraProjectionMatrix({
          origin: camera.position,
          facing: camera.quaternion,
        });

        session._touchHandler = (event) => session._onTouchStart(event, camera);
        session._touchMoveHandler = (event) => event.preventDefault();

        canvas.addEventListener('touchstart', session._touchHandler, true);
        canvas.addEventListener('touchmove', session._touchMoveHandler, { passive: false });

        session._running = true;
      },

      onUpdate: () => {
        if (!session._running || session._placed) return;

        const { camera } = XR8.Threejs.xrScene();
        const THREE = window.THREE;
        if (!THREE || !session._raycaster || !session._surface) return;

        session._tapPosition.set(0, 0);
        session._raycaster.setFromCamera(session._tapPosition, camera);
        const hits = session._raycaster.intersectObject(session._surface);

        if (hits.length > 0) {
          const point = hits[0].point;
          session._reticle.visible = true;
          session._reticle.position.copy(point);
          session._reticle.rotation.set(-Math.PI / 2, 0, 0);
          session._setHitVisible(true);
        } else {
          session._reticle.visible = false;
          session._setHitVisible(false);
        }

        session._onAnimate?.(performance.now());
      },
    });

    XR8.addCameraPipelineModules([
      XR8.GlTextureRenderer.pipelineModule(),
      XR8.Threejs.pipelineModule(),
      XR8.XrController.pipelineModule(),
      XRExtras.FullWindowCanvas.pipelineModule(),
      scenePipelineModule(),
    ]);

    XR8.run({
      canvas,
      allowedDevices: XR8.XrConfig.device().ANY,
    });
  }

  _onTouchStart(event, camera) {
    if (!this._raycaster || !this._surface || this._placed) return;

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
    if (this._reticle) this._reticle.visible = false;
    if (this._anchorGroup) {
      this._anchorGroup.position.set(0, 0, 0);
      this._anchorGroup.quaternion.identity();
      this._anchorGroup.scale.set(1, 1, 1);
    }
  }

  async destroy() {
    this._running = false;

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
  }
}

export { createPlacementReticle };
