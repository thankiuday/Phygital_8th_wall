/**
 * surfaceCoachingBillboard — semi-transparent logo plane in front of camera while scanning.
 */

/**
 * @param {object} THREE
 * @param {string} markUrl
 */
export const createSurfaceCoachingBillboard = (THREE, markUrl = '/phygital-mark.png') => {
  const group = new THREE.Group();
  group.visible = false;
  group.renderOrder = 998;

  const loader = new THREE.TextureLoader();
  const texture = loader.load(markUrl);
  if ('colorSpace' in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  } else {
    texture.encoding = THREE.sRGBEncoding;
  }

  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    depthTest: false,
  });

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.35), mat);
  group.add(plane);

  let bobPhase = 0;

  return {
    group,

    setVisible(visible) {
      group.visible = visible;
    },

    update(time, camera) {
      if (!group.visible || !camera) return;

      bobPhase += 0.02;
      const bob = Math.sin(bobPhase) * 0.03;

      camera.getWorldPosition(group.position);
      const camQuat = camera.quaternion;
      group.quaternion.copy(camQuat);

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat);
      group.position.addScaledVector(forward, 1.2);
      group.position.y += bob;

      plane.lookAt(camera.position);
    },

    dispose() {
      texture.dispose();
      mat.dispose();
      plane.geometry.dispose();
    },
  };
};
