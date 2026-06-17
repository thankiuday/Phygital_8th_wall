/**
 * surfaceTrackingSession — WebXR immersive-ar hit-test placement.
 */

const RETICLE_RING = 0.18;

/**
 * @param {object} THREE
 */
export const createPlacementReticle = (THREE) => {
  const inner = new THREE.RingGeometry(RETICLE_RING * 0.55, RETICLE_RING * 0.7, 32);
  const outer = new THREE.RingGeometry(RETICLE_RING * 0.85, RETICLE_RING, 32);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x9d6cff,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(inner, mat));
  group.add(new THREE.Mesh(outer, mat.clone()));
  group.visible = false;
  group.matrixAutoUpdate = false;
  return group;
};

/**
 * @param {{
 *   renderer: THREE.WebGLRenderer,
 *   scene: THREE.Scene,
 *   anchorGroup: THREE.Group,
 *   reticle: THREE.Group,
 *   onPlaced: () => void,
 *   onRescan: () => void,
 * }} opts
 */
export class SurfaceTrackingSession {
  constructor({ renderer, scene, anchorGroup, reticle, onPlaced, onRescan, onAnimate }) {
    this._renderer = renderer;
    this._scene = scene;
    this._anchorGroup = anchorGroup;
    this._reticle = reticle;
    this._onPlaced = onPlaced;
    this._onRescan = onRescan;
    this._onAnimate = onAnimate;

    this._session = null;
    this._referenceSpace = null;
    this._hitTestSource = null;
    this._placed = false;
    this._hitVisible = false;
    this._scratchMatrix = new window.THREE.Matrix4();

    this._onSelect = this._onSelect.bind(this);
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

    this._session = await navigator.xr.requestSession('immersive-ar', sessionInit);
    await this._renderer.xr.setSession(this._session);

    this._referenceSpace = await this._session.requestReferenceSpace('local-floor')
      .catch(() => this._session.requestReferenceSpace('local'));

    const viewerSpace = await this._session.requestReferenceSpace('viewer');
    this._hitTestSource = await this._session.requestHitTestSource({ space: viewerSpace });

    this._session.addEventListener('select', this._onSelect);
    this._session.addEventListener('end', () => {
      this._placed = false;
      this._hitVisible = false;
      this._onRescan?.();
    });

    this._renderer.setAnimationLoop((time, frame) => this._onFrame(time, frame));
  }

  _onFrame(_time, frame) {
    if (!frame || !this._hitTestSource || !this._referenceSpace) return;

    if (!this._placed) {
      const hits = frame.getHitTestResults(this._hitTestSource);
      if (hits.length > 0) {
        const pose = hits[0].getPose(this._referenceSpace);
        if (pose) {
          this._reticle.visible = true;
          this._hitVisible = true;
          this._scratchMatrix.fromArray(pose.transform.matrix);
          this._reticle.matrix.copy(this._scratchMatrix);
        }
      } else {
        this._reticle.visible = false;
        this._hitVisible = false;
      }
    }

    this._onAnimate?.(_time);
    this._renderer.render(this._scene, this._renderer.xr.getCamera());
  }

  _onSelect() {
    if (this._placed || !this._hitVisible) return;

    this._anchorGroup.matrix.copy(this._reticle.matrix);
    this._anchorGroup.matrix.decompose(
      this._anchorGroup.position,
      this._anchorGroup.quaternion,
      this._anchorGroup.scale
    );
    this._anchorGroup.updateMatrixWorld(true);

    this._placed = true;
    this._reticle.visible = false;
    this._onPlaced?.();
  }

  resetPlacement() {
    this._placed = false;
    this._hitVisible = false;
    this._reticle.visible = false;
    this._anchorGroup.position.set(0, 0, 0);
    this._anchorGroup.quaternion.identity();
    this._anchorGroup.scale.set(1, 1, 1);
    this._onRescan?.();
  }

  async destroy() {
    this._renderer.setAnimationLoop(null);
    if (this._session) {
      this._session.removeEventListener('select', this._onSelect);
      try {
        await this._session.end();
      } catch {
        // ignore
      }
    }
    this._hitTestSource = null;
    this._session = null;
    this._referenceSpace = null;
  }
}
