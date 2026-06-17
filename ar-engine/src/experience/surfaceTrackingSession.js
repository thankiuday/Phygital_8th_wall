/**
 * surfaceTrackingSession — WebXR immersive-ar hit-test placement.
 */

const RETICLE_OUTER = 0.2;
const RETICLE_INNER = 0.14;
const POSE_CACHE_MS = 500;

/**
 * @param {object} THREE
 */
export const createPlacementReticle = (THREE) => {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xc4b5fd,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  });

  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.visible = false;
  group.renderOrder = 999;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(RETICLE_INNER, RETICLE_OUTER, 32).rotateX(-Math.PI / 2),
    mat
  );
  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.035, 24).rotateX(-Math.PI / 2),
    mat.clone()
  );
  group.add(ring);
  group.add(dot);
  return group;
};

const horizontalnessFromMatrix = (m) => Math.abs(m[5]);

/**
 * @param {{
 *   renderer: THREE.WebGLRenderer,
 *   scene: THREE.Scene,
 *   camera: THREE.PerspectiveCamera,
 *   anchorGroup: THREE.Group,
 *   reticle: THREE.Group,
 *   domOverlayRoot?: HTMLElement,
 *   THREE: typeof import('three'),
 *   onPlaced: () => void,
 *   onRescan: () => void,
 *   onAnimate?: (time: number) => void,
 *   onHitVisibilityChange?: (visible: boolean) => void,
 * }} opts
 */
export class SurfaceTrackingSession {
  constructor({
    renderer,
    scene,
    camera,
    anchorGroup,
    reticle,
    domOverlayRoot,
    THREE,
    onPlaced,
    onRescan,
    onAnimate,
    onHitVisibilityChange,
  }) {
    this._renderer = renderer;
    this._scene = scene;
    this._camera = camera;
    this._anchorGroup = anchorGroup;
    this._reticle = reticle;
    this._domOverlayRoot = domOverlayRoot;
    this._THREE = THREE;
    this._scratchMatrix = THREE ? new THREE.Matrix4() : null;
    this._onPlaced = onPlaced;
    this._onRescan = onRescan;
    this._onAnimate = onAnimate;
    this._onHitVisibilityChange = onHitVisibilityChange;

    this._session = null;
    this._hitTestSource = null;
    this._hitTestSourceRequested = false;
    this._placed = false;
    this._hitVisible = false;
    this._cachedPose = null;
    this._cachedPoseTs = 0;

    this._onSelect = this._onSelect.bind(this);
    this._controller = null;
  }

  get placed() {
    return this._placed;
  }

  get hitVisible() {
    return this._hitVisible;
  }

  async start() {
    const sessionInit = {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['local-floor'],
    };

    if (this._domOverlayRoot) {
      sessionInit.optionalFeatures.push('dom-overlay');
      sessionInit.domOverlay = { root: this._domOverlayRoot };
    }

    this._session = await navigator.xr.requestSession('immersive-ar', sessionInit);

    if (this._renderer.xr.setReferenceSpaceType) {
      this._renderer.xr.setReferenceSpaceType('local-floor');
    }

    await this._renderer.xr.setSession(this._session);

    this._controller = this._renderer.xr.getController(0);
    this._controller.addEventListener('select', this._onSelect);
    this._scene.add(this._controller);

    this._session.addEventListener('select', this._onSelect);
    this._session.addEventListener('end', () => {
      this._placed = false;
      this._hitVisible = false;
      this._cachedPose = null;
      this._hitTestSource = null;
      this._hitTestSourceRequested = false;
      this._onRescan?.();
    });

    this._renderer.setAnimationLoop((time, frame) => this._onFrame(time, frame));
  }

  _setHitVisible(visible) {
    if (this._hitVisible === visible) return;
    this._hitVisible = visible;
    this._onHitVisibilityChange?.(visible);
  }

  _requestHitTestSource(session) {
    if (this._hitTestSourceRequested) return;
    this._hitTestSourceRequested = true;

    session.requestReferenceSpace('viewer').then((viewerSpace) => {
      session.requestHitTestSource({ space: viewerSpace }).then((source) => {
        this._hitTestSource = source;
      }).catch(() => {
        this._hitTestSourceRequested = false;
      });
    }).catch(() => {
      this._hitTestSourceRequested = false;
    });
  }

  _cachePose(matrixArray) {
    if (!this._cachedPose) {
      this._cachedPose = new Float32Array(16);
    }
    this._cachedPose.set(matrixArray);
    this._cachedPoseTs = performance.now();
  }

  _applyMatrixToAnchor(matrix) {
    this._anchorGroup.matrixAutoUpdate = false;
    this._anchorGroup.matrix.copy(matrix);
    this._anchorGroup.matrix.decompose(
      this._anchorGroup.position,
      this._anchorGroup.quaternion,
      this._anchorGroup.scale
    );
    this._anchorGroup.updateMatrixWorld(true);
  }

  _onFrame(_time, frame) {
    if (!frame) return;

    const session = this._renderer.xr.getSession();
    const referenceSpace = this._renderer.xr.getReferenceSpace();

    if (session && !this._hitTestSourceRequested) {
      this._requestHitTestSource(session);
    }

    if (!this._placed && this._hitTestSource && referenceSpace) {
      const hits = frame.getHitTestResults(this._hitTestSource);
      let bestPose = null;
      let bestScore = 0;

      for (const hit of hits) {
        const pose = hit.getPose(referenceSpace);
        if (!pose) continue;
        const score = horizontalnessFromMatrix(pose.transform.matrix);
        if (score > bestScore) {
          bestScore = score;
          bestPose = pose;
        }
      }

      if (bestPose && bestScore >= 0.35) {
        this._reticle.visible = true;
        this._reticle.matrix.fromArray(bestPose.transform.matrix);
        this._reticle.updateMatrixWorld(true);
        this._cachePose(bestPose.transform.matrix);
        this._setHitVisible(true);
      } else {
        this._reticle.visible = false;
        this._setHitVisible(false);
      }
    }

    this._onAnimate?.(_time);
    this._renderer.render(this._scene, this._camera);
  }

  _onSelect() {
    if (this._placed) return;

    const cacheFresh = this._cachedPose
      && (performance.now() - this._cachedPoseTs) < POSE_CACHE_MS;
    const canPlace = this._reticle.visible || cacheFresh;
    if (!canPlace) return;

    if (this._reticle.visible) {
      this._applyMatrixToAnchor(this._reticle.matrix);
    } else if (this._cachedPose && this._scratchMatrix) {
      this._scratchMatrix.fromArray(this._cachedPose);
      this._applyMatrixToAnchor(this._scratchMatrix);
    }

    this._placed = true;
    this._reticle.visible = false;
    this._setHitVisible(false);
    this._onPlaced?.();
  }

  resetPlacement() {
    this._placed = false;
    this._hitVisible = false;
    this._cachedPose = null;
    this._reticle.visible = false;
    this._anchorGroup.matrixAutoUpdate = true;
    this._anchorGroup.position.set(0, 0, 0);
    this._anchorGroup.quaternion.identity();
    this._anchorGroup.scale.set(1, 1, 1);
    this._onRescan?.();
  }

  async destroy() {
    this._renderer.setAnimationLoop(null);
    if (this._controller) {
      this._controller.removeEventListener('select', this._onSelect);
      this._scene.remove(this._controller);
      this._controller = null;
    }
    if (this._session) {
      this._session.removeEventListener('select', this._onSelect);
      try {
        await this._session.end();
      } catch {
        // ignore
      }
    }
    this._hitTestSource = null;
    this._hitTestSourceRequested = false;
    this._session = null;
  }
}
