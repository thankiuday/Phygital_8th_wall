/**
 * ARExperience.js — Main WebAR orchestrator
 *
 * Responsibilities:
 *  1. Compile the user-uploaded card image into a MindAR target (.mind)
 *  2. Bootstrap the MindARThree pipeline (camera + tracker)
 *  3. Build the Three.js scene: video plane (9:16) + glow quad
 *  4. Wire targetFound / targetLost events to GSAP animations
 *  5. Manage the video element lifecycle (play/pause, cleanup)
 *
 * GLOBAL DEPENDENCIES loaded via CDN in index.html:
 *   window.MINDAR.IMAGE  — MindARThree + Compiler
 *   window.THREE         — Three.js (same copy MindAR uses to avoid conflicts)
 *   window.gsap          — GSAP 3
 */

import { compileMindTarget } from './targetCompiler.js';
import { animateTargetFound, animateTargetLost } from './animations.js';
import { updateLoadingProgress, showError, hideLoading } from '../utils/loadingScreen.js';
import { updateSession } from '../services/campaignLoader.js';

// ---------------------------------------------------------------------------
// Video plane geometry constants
//
// Coordinate system: MindAR places the tracked card centre at origin.
// 1 world-unit ≈ card width.  Positive Y goes UP from the card surface.
//
// Goal: a portrait 9:16 video that looks like it is RISING from the card.
//   • Bottom edge sits right at the card centre (y ≈ 0).
//   • Top edge extends well above the card.
//   • Width: ~80 % of card width so it does not overflow left/right.
// ---------------------------------------------------------------------------
const PLANE_WIDTH  = 0.82;                     // 82 % of card width
const PLANE_HEIGHT = PLANE_WIDTH * (16 / 9);   // ≈ 1.46  (portrait 9:16)
const PLANE_Y      = PLANE_HEIGHT / 2;         // centre at half-height → bottom at y≈0

// Thin horizontal glow ellipse that sits at the base of the video
// giving the "emitting from card surface" look.
const GLOW_W = PLANE_WIDTH  * 1.3;
const GLOW_H = PLANE_HEIGHT * 0.14;  // flat ellipse, not a full-size quad
const GLOW_Y = 0.02;                 // just above card surface

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------

export class ARExperience {
  constructor({ container, campaign }) {
    this._container = container;
    this._campaign  = campaign;

    this._mindarThree  = null;
    this._videoEl      = null;
    this._videoTexture = null;
    this._plane        = null;
    this._glow         = null;
    this._started      = false;
    this._sessionStart = null; // records when AR tracking begins
    this._renderLoop   = null;
  }

  // --------------------------------------------------------------------------
  // boot — compile target then start AR
  // --------------------------------------------------------------------------
  async boot() {
    const THREE = window.THREE;
    if (!THREE) throw new Error('Three.js not found on window.THREE');
    if (!window.MINDAR?.IMAGE?.MindARThree) {
      throw new Error('MindARThree not found. Check CDN script in index.html.');
    }

    updateLoadingProgress(5, 'Preparing AR experience…');

    // 1 — Compile the image target in the browser
    let mindBlobUrl;
    try {
      mindBlobUrl = await compileMindTarget(
        this._campaign.targetImageUrl,
        (pct) => {
          // Compilation takes 0 → 85% of progress bar
          updateLoadingProgress(5 + Math.round(pct * 0.8), `Calibrating AR target… ${pct}%`);
        }
      );
    } catch (err) {
      showError('Could not calibrate image target. Please try again.', err.message);
      return;
    }

    updateLoadingProgress(88, 'Starting camera…');

    // 2 — Bootstrap MindARThree
    const { MindARThree } = window.MINDAR.IMAGE;
    this._mindarThree = new MindARThree({
      container:       this._container,
      imageTargetSrc:  mindBlobUrl,
      maxTrack:        1,
      uiLoading:       'no',   // we control the loading UI ourselves
      uiScanning:      'yes',  // keep MindAR's built-in scanning hint
      uiError:         'no',
    });

    const { renderer, scene, camera } = this._mindarThree;

    // MindAR puts the camera <video> under the canvas (z-index -2) and uses a WebGLRenderer
    // with alpha: true. Three.js still defaults to an opaque clear buffer, which paints black
    // over the entire video — users only see the scanning UI. Force a transparent clear.
    renderer.setClearColor(0x000000, 0);
    scene.background = null;

    // 3 — Build the Three.js scene objects
    this._buildVideoPlane(THREE, scene);

    // 4 — Wire anchor events
    const anchor = this._mindarThree.addAnchor(0); // target index 0
    anchor.onTargetFound = () => this._onTargetFound();
    anchor.onTargetLost  = () => this._onTargetLost();
    anchor.group.add(this._plane);
    anchor.group.add(this._glow);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(0, 5, 5);
    scene.add(dir);

    // 5 — Start MindAR (opens camera, begins tracking)
    try {
      await this._mindarThree.start();
      this._started = true;
    } catch (err) {
      showError(
        'Camera access required.',
        'Please allow camera permissions and reload the page.'
      );
      return;
    }

    this._sessionStart = Date.now();
    updateLoadingProgress(100, 'Ready!');
    hideLoading();

    // Render loop (MindAR does not register one — see official three.js example)
    this._renderLoop = () => {
      this._videoTexture?.update();
      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(this._renderLoop);
  }

  // --------------------------------------------------------------------------
  // _buildVideoPlane — 9:16 portrait video rising from card + base glow
  // --------------------------------------------------------------------------
  _buildVideoPlane(THREE, scene) {
    // --- Video element ---
    this._videoEl = document.createElement('video');
    Object.assign(this._videoEl, {
      src:         this._campaign.videoUrl,
      loop:        true,
      muted:       true,        // required for autoplay on iOS / Android
      playsInline: true,
      crossOrigin: 'anonymous',
    });
    this._videoEl.style.display = 'none';
    document.body.appendChild(this._videoEl);

    // --- Video texture ---
    this._videoTexture = new THREE.VideoTexture(this._videoEl);
    this._videoTexture.minFilter = THREE.LinearFilter;
    this._videoTexture.magFilter = THREE.LinearFilter;

    // --- Portrait video plane (9:16) ---
    // Bottom edge anchored at card surface (y ≈ 0), top extends upward.
    // Start hidden at scale 0 so the entrance animation can pop it up.
    const planeGeo = new THREE.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT);
    const planeMat = new THREE.MeshBasicMaterial({
      map:         this._videoTexture,
      transparent: true,
      opacity:     0,
      side:        THREE.DoubleSide,
      depthWrite:  false,
    });
    this._plane = new THREE.Mesh(planeGeo, planeMat);
    this._plane.position.set(0, PLANE_Y, 0.002);
    this._plane.scale.set(0, 0, 0);
    this._plane.visible = false;

    // --- Base glow — flat ellipse sitting on the card surface ---
    // Gives the "hologram emitting from card" look without covering the video.
    const glowGeo = new THREE.PlaneGeometry(GLOW_W, GLOW_H);
    const glowMat = new THREE.MeshBasicMaterial({
      color:      0x7c3aed,
      transparent: true,
      opacity:     0,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });
    this._glow = new THREE.Mesh(glowGeo, glowMat);
    this._glow.position.set(0, GLOW_Y, 0.001);
    this._glow.scale.set(0, 0, 0);
    this._glow.visible = false;

    void scene;
  }

  // --------------------------------------------------------------------------
  // Event handlers
  // --------------------------------------------------------------------------
  _onTargetFound() {
    // Start video playback (may be blocked until user gesture on some browsers,
    // but in practice camera-open counts as user gesture on modern mobile)
    this._videoEl?.play().catch(() => {});
    animateTargetFound(this._plane, this._glow);
  }

  _onTargetLost() {
    animateTargetLost(this._plane, this._glow);
    this._videoEl?.pause();
  }

  // --------------------------------------------------------------------------
  // destroy — cleanup when navigating away
  // --------------------------------------------------------------------------
  async destroy() {
    // Report session analytics before teardown
    if (this._sessionStart) {
      const durationMs = Date.now() - this._sessionStart;
      const watchPct   = this._getVideoWatchPercent();
      updateSession(this._campaign._id, durationMs, watchPct);
    }

    if (this._mindarThree?.renderer) {
      this._mindarThree.renderer.setAnimationLoop(null);
    }
    if (this._started && this._mindarThree) {
      await this._mindarThree.stop();
    }
    if (this._videoEl) {
      this._videoEl.pause();
      this._videoEl.remove();
    }
    this._videoTexture?.dispose();
  }

  /** Estimates video watch % based on currentTime vs duration. */
  _getVideoWatchPercent() {
    const v = this._videoEl;
    if (!v || !v.duration || v.duration === 0) return 0;
    return Math.round((v.currentTime / v.duration) * 100);
  }
}
