/**
 * animations.js
 *
 * GSAP-powered animations for the AR hologram.
 *
 * Visual goal: the video looks like it POPS UP from the business card,
 * as if a hologram is rising from the card surface.
 *
 * Entrance  — video scales from the bottom (card surface) upward,
 *             combined with a Y-rise so it appears to shoot out of the card.
 * Float     — gentle Y levitation + base-glow pulse while tracking.
 * Exit      — quick shrink back down to card surface.
 *
 * GLOBAL DEPENDENCY: window.gsap — set in main.js from the gsap npm package.
 */

const gsap = () => window.gsap;

// The plane's resting Y position must match PLANE_Y in ARExperience.js.
// Import is avoided to keep this file dependency-free; update both together.
const PLANE_Y_REST = 0.82 * (16 / 9) / 2; // ≈ 0.731  (PLANE_WIDTH * 16/9 / 2)
const GLOW_Y_REST  = 0.02;

// ---------------------------------------------------------------------------
// Entrance — target found
// ---------------------------------------------------------------------------

/**
 * animateTargetFound
 *
 * 1. Video rises from y = 0 (card surface) to final resting position.
 * 2. Scales from a squashed sliver at the bottom to full size.
 * 3. Base glow pulses in to reinforce the "emanating from card" look.
 * 4. Starts a gentle float loop once settled.
 */
export const animateTargetFound = (plane, glow) => {
  const g = gsap();
  if (!g) return;

  g.killTweensOf([plane.scale, plane.position, plane.material,
                  glow.scale,  glow.position,  glow.material]);

  // Reset to "card surface" start state
  plane.visible = true;
  glow.visible  = true;
  plane.material.opacity = 0;
  glow.material.opacity  = 0;

  // Start squashed at the bottom — scale Y = 0 makes it invisible at first
  plane.scale.set(1, 0, 1);
  plane.position.set(0, 0, 0.002);   // start at card surface

  glow.scale.set(0.2, 1, 1);
  glow.position.set(0, GLOW_Y_REST, 0.001);

  const tl = g.timeline();

  // ── Phase 1: quick flash of the base glow (0–0.25 s) ──────────────────
  tl.to(glow.scale, {
    x: 1.4, y: 1, z: 1,
    duration: 0.25,
    ease: 'power2.out',
  }, 0);
  tl.to(glow.material, { opacity: 0.7, duration: 0.2 }, 0);

  // ── Phase 2: video rises up from the card surface (0.05–0.65 s) ───────
  // Y-position rises from 0 to PLANE_Y_REST (bottom → resting centre)
  tl.to(plane.position, {
    y: PLANE_Y_REST,
    duration: 0.55,
    ease: 'back.out(1.4)',
  }, 0.05);

  // Scale Y from 0 → 1 (unroll upward)
  tl.to(plane.scale, {
    x: 1, y: 1, z: 1,
    duration: 0.55,
    ease: 'back.out(1.4)',
  }, 0.05);

  // Fade in the video
  tl.to(plane.material, { opacity: 1, duration: 0.4 }, 0.1);

  // ── Phase 3: glow settles to a softer pulse level ─────────────────────
  tl.to(glow.material, { opacity: 0.45, duration: 0.35 }, 0.35);
  tl.to(glow.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'power1.inOut' }, 0.35);

  // ── Phase 4: start floating once entrance is complete ─────────────────
  tl.call(() => _startFloat(plane, glow), null, 0.7);
};

// ---------------------------------------------------------------------------
// Exit — target lost
// ---------------------------------------------------------------------------

/**
 * animateTargetLost
 * Shrinks the video back down to the card surface (reverse of pop-up).
 */
export const animateTargetLost = (plane, glow) => {
  const g = gsap();
  if (!g) return;

  g.killTweensOf([plane.scale, plane.position, plane.material,
                  glow.scale,  glow.position,  glow.material]);
  _stopFloat(plane, glow);

  const tl = g.timeline({
    onComplete: () => {
      plane.visible = false;
      glow.visible  = false;
      // Reset to neutral so next entrance starts cleanly
      plane.scale.set(0, 0, 0);
      plane.position.set(0, PLANE_Y_REST, 0.002);
    },
  });

  // Collapse video downward (reverse pop-up)
  tl.to(plane.position, {
    y: 0,
    duration: 0.3,
    ease: 'power2.in',
  }, 0);
  tl.to(plane.scale, {
    x: 1, y: 0, z: 1,
    duration: 0.3,
    ease: 'power2.in',
  }, 0);
  tl.to(plane.material, { opacity: 0, duration: 0.2 }, 0);

  // Glow dissipates
  tl.to(glow.material, { opacity: 0, duration: 0.25 }, 0);
  tl.to(glow.scale, { x: 0.1, y: 1, z: 1, duration: 0.3, ease: 'power2.in' }, 0);
};

// ---------------------------------------------------------------------------
// Float loop — runs while target is visible
// ---------------------------------------------------------------------------

const _floatTweens = { plane: null, glow: null };

const _startFloat = (plane, glow) => {
  const g = gsap();
  if (!g) return;

  // Tiny Y levitation around the resting position
  const planeProxy = { y: plane.position.y };

  _floatTweens.plane = g.to(planeProxy, {
    y: planeProxy.y + 0.03,
    duration: 2.0,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
    onUpdate: () => { plane.position.y = planeProxy.y; },
  });

  // Glow pulse — subtle scale breathing
  const glowProxy = { s: 1 };
  _floatTweens.glow = g.to(glowProxy, {
    s: 1.25,
    duration: 1.8,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
    onUpdate: () => { glow.scale.set(glowProxy.s, 1, 1); },
  });
};

const _stopFloat = (plane, glow) => {
  if (_floatTweens.plane) { _floatTweens.plane.kill(); _floatTweens.plane = null; }
  if (_floatTweens.glow)  { _floatTweens.glow.kill();  _floatTweens.glow  = null; }
  // Snap back to rest so the next entrance is clean
  plane.position.set(0, PLANE_Y_REST, 0.002);
  glow.position.set(0, GLOW_Y_REST,  0.001);
};
