/**
 * animations.js
 *
 * GSAP-powered animations for the AR hologram video plane.
 *
 * All animations operate on Three.js Object3D instances.
 * GSAP animates plain JS objects; we hook into `onUpdate` to
 * push values to Three.js each frame.
 *
 * GLOBAL DEPENDENCY
 * - window.gsap — set in main.js from the gsap npm package
 */

const gsap = () => window.gsap;

// ---------------------------------------------------------------------------
// Pop-in entrance animation
// ---------------------------------------------------------------------------

/**
 * animateTargetFound
 * Plays when MindAR fires the `targetFound` event.
 * 1. Scale the plane from 0 → 1  (spring overshoot feel)
 * 2. Fade the video material in
 * 3. Start the persistent float loop
 *
 * @param {THREE.Mesh}  plane        The 9:16 video plane mesh
 * @param {THREE.Mesh}  glow         The glow quad behind the plane
 */
export const animateTargetFound = (plane, glow) => {
  const g = gsap();
  if (!g) return;

  // Kill any running tweens on these objects to avoid conflicts
  g.killTweensOf([plane.scale, plane.material, glow.scale, glow.material]);

  // Make everything visible
  plane.visible = true;
  glow.visible = true;
  plane.scale.set(0, 0, 0);
  glow.scale.set(0, 0, 0);
  plane.material.opacity = 0;
  glow.material.opacity = 0;

  const tl = g.timeline();

  // Glow fades in slightly ahead of the plane
  tl.to(
    glow.scale,
    { x: 1.15, y: 1.15, z: 1.15, duration: 0.6, ease: 'back.out(1.8)' },
    0
  );
  tl.to(glow.material, { opacity: 0.35, duration: 0.4 }, 0);

  // Plane scales up with spring bounce
  tl.to(
    plane.scale,
    { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(2)' },
    0.05
  );
  tl.to(plane.material, { opacity: 1, duration: 0.5 }, 0.05);

  // Once entrance is done, start the persistent float loop
  tl.call(() => startFloat(plane, glow), null, 0.75);
};

// ---------------------------------------------------------------------------
// Exit animation — target lost
// ---------------------------------------------------------------------------

/**
 * animateTargetLost
 * Plays when MindAR fires the `targetLost` event.
 * Shrinks and fades everything to invisible.
 */
export const animateTargetLost = (plane, glow) => {
  const g = gsap();
  if (!g) return;

  g.killTweensOf([plane.scale, plane.material, glow.scale, glow.material]);
  stopFloat(plane, glow);

  const tl = g.timeline({
    onComplete: () => {
      plane.visible = false;
      glow.visible = false;
    },
  });

  tl.to(plane.material, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 0);
  tl.to(plane.scale, { x: 0.1, y: 0.1, z: 0.1, duration: 0.35, ease: 'power2.in' }, 0);
  tl.to(glow.material, { opacity: 0, duration: 0.25 }, 0);
  tl.to(glow.scale, { x: 0.1, y: 0.1, z: 0.1, duration: 0.3, ease: 'power2.in' }, 0);
};

// ---------------------------------------------------------------------------
// Persistent float + pulse loop
// ---------------------------------------------------------------------------

// Store tween references so we can kill them on targetLost
const _floatTweens = { plane: null, glow: null };

/**
 * startFloat — gentle Y-axis levitation + glow pulse running in a loop.
 * Uses a proxy object so we can smoothly interpolate a Three.js position.
 */
const startFloat = (plane, glow) => {
  const g = gsap();
  if (!g) return;

  const planeProxy = { y: plane.position.y };
  const glowProxy = { scale: 1.15 };

  _floatTweens.plane = g.to(planeProxy, {
    y: planeProxy.y + 0.04,
    duration: 1.6,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
    onUpdate: () => {
      plane.position.y = planeProxy.y;
    },
  });

  _floatTweens.glow = g.to(glowProxy, {
    scale: 1.25,
    duration: 1.8,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
    onUpdate: () => {
      glow.scale.setScalar(glowProxy.scale);
    },
  });
};

const stopFloat = (plane, glow) => {
  if (_floatTweens.plane) { _floatTweens.plane.kill(); _floatTweens.plane = null; }
  if (_floatTweens.glow) { _floatTweens.glow.kill(); _floatTweens.glow = null; }
  // Reset position baseline so next entrance starts cleanly
  plane.position.y = 0.6;
  glow.position.y = 0.6;
};
