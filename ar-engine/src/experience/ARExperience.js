/**
 * ARExperience.js — Main WebAR orchestrator
 *
 * HOW THE "RISING HOLOGRAM" EFFECT WORKS
 * ────────────────────────────────────────
 * MindAR's anchor group lives in the card's local coordinate space:
 *   • XY plane  = the physical card surface
 *   • +Z axis   = perpendicular to the card, pointing toward the camera
 *
 * A default (un-rotated) PlaneGeometry lies in the XY plane — it appears
 * flat ON the card, like a sticker. That is what was showing in screenshots.
 *
 * To make content RISE from the card we rotate the plane mesh by +90° around
 * X. This moves it into the XZ plane so it stands upright, perpendicular to
 * the card surface. The entrance animation then grows scale.y (height) from 0
 * while shifting position.z upward so the bottom edge stays glued to the card.
 *
 * GLOBAL DEPENDENCIES (loaded via CDN in index.html):
 *   window.MINDAR.IMAGE  — MindARThree + Compiler  (mind-ar@1.1.5 UMD)
 *   window.THREE         — Three.js r149
 * GSAP is bundled via Vite and exposed as window.gsap in main.js.
 */

import { compileMindTarget } from './targetCompiler.js';
import { animateTargetFound, animateTargetLost } from './animations.js';
import { updateLoadingProgress, showError, hideLoading } from '../utils/loadingScreen.js';
import { updateSession } from '../services/campaignLoader.js';

// ─────────────────────────────────────────────────────────────────────────────
// Geometry constants — keep in sync with PLANE_REST_Z exported below.
// ─────────────────────────────────────────────────────────────────────────────

// Portrait 9:16 plane that stands upright from the card surface.
// 1 world-unit = card width (set by MindAR's postMatrix).
const PLANE_WIDTH  = 0.65;                       // 65 % of card width
const PLANE_HEIGHT = PLANE_WIDTH * (16 / 9);     // ≈ 1.156  (true 9:16 portrait)

// After rotation.x = +Math.PI/2, "height" extends in +Z (toward camera).
// REST position: plane centre sits at z = PLANE_HEIGHT/2 so the bottom
// edge is exactly at z = 0 (card surface) when scale.y = 1.
export const PLANE_REST_Z = PLANE_HEIGHT / 2;    // ≈ 0.578

// Thin horizontal glow ellipse — stays flat ON the card (no rotation).
const GLOW_W = PLANE_WIDTH * 1.5;
const GLOW_H = 0.06;   // deliberately flat so it doesn't cover the card image

// ─────────────────────────────────────────────────────────────────────────────
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
    this._sessionStart = null;
    this._renderLoop   = null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // boot
  // ───────────────────────────────────────────────────────────────────────────
  async boot() {
    const THREE = window.THREE;
    if (!THREE) throw new Error('Three.js not found on window.THREE');
    if (!window.MINDAR?.IMAGE?.MindARThree) {
      throw new Error('MindARThree not found. Check CDN scripts in index.html.');
    }

    updateLoadingProgress(5, 'Preparing AR experience…');

    // 1 — Compile target image → .mind blob
    let mindBlobUrl;
    try {
      mindBlobUrl = await compileMindTarget(
        this._campaign.targetImageUrl,
        (pct) => updateLoadingProgress(5 + Math.round(pct * 0.8), `Calibrating target… ${pct}%`)
      );
    } catch (err) {
      showError('Could not calibrate image target.', err.message);
      return;
    }

    updateLoadingProgress(88, 'Starting camera…');

    // 2 — Bootstrap MindARThree
    const { MindARThree } = window.MINDAR.IMAGE;
    this._mindarThree = new MindARThree({
      container:      this._container,
      imageTargetSrc: mindBlobUrl,
      maxTrack:       1,
      uiLoading:      'no',
      uiScanning:     'yes',
      uiError:        'no',

      // ── One-Euro filter: aggressive smoothing for a near-stationary card ──
      // filterMinCF: lower  → smoother at rest, slightly more lag
      // filterBeta:  lower  → less speed-based reactivity (less jitter on hold)
      filterMinCF:    0.001,
      filterBeta:     0.001,

      // ── Tolerance frames ─────────────────────────────────────────────────
      // warmupTolerance: require N stable frames before showing content
      //   → prevents a flash on first detection
      // missTolerance:   tolerate N missed frames before firing targetLost
      //   → prevents content disappearing on brief tracking drops
      warmupTolerance: 5,
      missTolerance:   20,
    });

    const { renderer, scene, camera } = this._mindarThree;

    // ── Renderer quality upgrades ────────────────────────────────────────────
    // Transparent clear — camera feed shows through the WebGL canvas.
    renderer.setClearColor(0x000000, 0);
    scene.background = null;

    // sRGB output encoding → colours match the source video exactly.
    // THREE.sRGBEncoding is the correct constant for Three.js r149.
    renderer.outputEncoding = THREE.sRGBEncoding;

    // Full device pixel ratio (up to 2×) for sharp rendering on retina /
    // high-DPI screens. Capped at 2 to avoid GPU overload on 3× displays.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Physically-correct lighting (no effect on MeshBasicMaterial but
    // future-proofs the renderer for lit materials).
    renderer.physicallyCorrectLights = true;

    // 3 — Build scene objects
    this._buildScene(THREE, scene, renderer);

    // 4 — Wire anchor events
    const anchor = this._mindarThree.addAnchor(0);
    anchor.onTargetFound = () => this._onTargetFound();
    anchor.onTargetLost  = () => this._onTargetLost();
    anchor.group.add(this._plane);
    anchor.group.add(this._glow);

    // Ambient light only (MeshBasicMaterial ignores lights, but kept for future use)
    scene.add(new THREE.AmbientLight(0xffffff, 1));

    // 5 — Start MindAR (opens camera + begins tracking)
    try {
      await this._mindarThree.start();
      this._started = true;
    } catch {
      showError('Camera access required.', 'Please allow camera permissions and reload.');
      return;
    }

    this._sessionStart = Date.now();
    updateLoadingProgress(100, 'Ready!');
    hideLoading();

    // Render loop — runs every animation frame via MindAR's renderer.
    // We call videoTexture.update() every frame regardless of readyState
    // so Three.js uploads the latest decoded video frame to the GPU texture.
    this._renderLoop = () => {
      if (
        this._videoTexture &&
        this._videoEl?.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        this._videoTexture.needsUpdate = true;
      }
      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(this._renderLoop);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // _buildScene
  //
  // Key insight: this._plane.rotation.x = Math.PI / 2 rotates the plane from
  // the XY (card) plane into the XZ plane.  After this rotation:
  //   • The plane stands perpendicular to the card, rising toward the camera.
  //   • scale.y controls the "height" in the camera / Z direction.
  //   • position.z shifts the standing plane up/down from the card surface.
  //
  // Initial state: scale.y = 0, position.z = 0 (collapsed to a line at the
  // card surface) — the entrance animation grows it upward.
  // ───────────────────────────────────────────────────────────────────────────
  _buildScene(THREE, scene, renderer) {
    // --- Off-screen video element ---
    // Start muted so the browser allows immediate autoplay (required for iOS).
    // We unmute in _onTargetFound once the camera gesture has been granted.
    this._videoEl = document.createElement('video');
    Object.assign(this._videoEl, {
      src:         this._campaign.videoUrl,
      loop:        true,
      muted:       true,      // unmuted later in _onTargetFound
      playsInline: true,
      crossOrigin: 'anonymous',
      preload:     'auto',    // begin buffering as early as possible
    });
    // Hint browser to the native resolution of our render target so it
    // allocates the correct decode buffer (avoids a mid-play resize stutter).
    this._videoEl.setAttribute('width',  '1080');
    this._videoEl.setAttribute('height', '1920');
    this._videoEl.style.display = 'none';
    document.body.appendChild(this._videoEl);
    // Start buffering immediately — by the time target is found the video
    // should be fully in memory, giving instant smooth playback.
    this._videoEl.load();

    // --- Video texture (high-quality settings) ---
    this._videoTexture = new THREE.VideoTexture(this._videoEl);

    // LinearFilter on both min/mag — best quality for a video quad.
    this._videoTexture.minFilter = THREE.LinearFilter;
    this._videoTexture.magFilter = THREE.LinearFilter;

    // Mipmaps are useless for a VideoTexture (they are never auto-generated
    // for dynamic sources) and waste GPU memory — disable explicitly.
    this._videoTexture.generateMipmaps = false;

    // sRGB encoding so the texture is colour-correctly displayed on the
    // sRGB-encoded renderer output. Without this, colours appear washed out.
    this._videoTexture.encoding = THREE.sRGBEncoding;

    // Max anisotropy — dramatically sharpens the texture when the plane is
    // viewed at a steep angle (common when holding a phone over the card).
    const maxAniso = renderer.capabilities?.getMaxAnisotropy?.() ?? 1;
    this._videoTexture.anisotropy = maxAniso;

    // --- Portrait video plane (stands up from card) ---
    const planeGeo = new THREE.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT);
    const planeMat = new THREE.MeshBasicMaterial({
      map:         this._videoTexture,
      transparent: true,
      opacity:     0,
      side:        THREE.DoubleSide,
      depthWrite:  false,
    });
    this._plane = new THREE.Mesh(planeGeo, planeMat);
    // Rotate plane into XZ: now height extends along +Z (toward camera)
    this._plane.rotation.x = Math.PI / 2;
    // Start collapsed at card surface; entrance animation rises it up
    this._plane.scale.set(1, 0, 1);
    this._plane.position.set(0, 0, 0);
    this._plane.visible = false;

    // --- Flat base glow (thin horizontal ellipse at card surface) ---
    // Stays in the XY plane (no rotation) — gives the "energy emanating
    // from card" look without covering the card image.
    const glowGeo = new THREE.PlaneGeometry(GLOW_W, GLOW_H);
    const glowMat = new THREE.MeshBasicMaterial({
      color:      0x7c3aed,
      transparent: true,
      opacity:     0,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });
    this._glow = new THREE.Mesh(glowGeo, glowMat);
    this._glow.position.set(0, 0, 0.003);   // flat on card, just above surface
    this._glow.scale.set(0, 1, 1);           // collapsed width-wise initially
    this._glow.visible = false;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Event handlers
  // ───────────────────────────────────────────────────────────────────────────
  _onTargetFound() {
    this._playWithAudio();
    animateTargetFound(this._plane, this._glow, PLANE_REST_Z);
  }

  _onTargetLost() {
    animateTargetLost(this._plane, this._glow, PLANE_REST_Z);
    this._videoEl?.pause();
  }

  /**
   * _playWithAudio
   * Attempts to play the video unmuted (camera-open counts as a user gesture
   * on Android Chrome). Falls back to muted if the browser still blocks it
   * (iOS Safari requires an explicit tap on the page itself).
   * Shows a small persistent "🔊" button so the user can unlock audio on iOS.
   */
  _playWithAudio() {
    const v = this._videoEl;
    if (!v) return;

    v.muted = false;
    v.play().then(() => {
      // Successfully playing with audio — remove the tap-button if it exists
      document.getElementById('ar-audio-btn')?.remove();
    }).catch(() => {
      // Browser blocked unmuted autoplay (typically iOS Safari)
      v.muted = true;
      v.play().catch(() => {});
      this._showAudioButton();
    });
  }

  /** Adds a small persistent tap-to-unmute button for iOS. */
  _showAudioButton() {
    if (document.getElementById('ar-audio-btn')) return; // already shown

    const btn = document.createElement('button');
    btn.id = 'ar-audio-btn';
    btn.textContent = '🔊 Tap for audio';
    Object.assign(btn.style, {
      position:     'fixed',
      bottom:       '28px',
      left:         '50%',
      transform:    'translateX(-50%)',
      zIndex:       '9998',
      padding:      '10px 22px',
      borderRadius: '99px',
      border:       'none',
      background:   'rgba(124,58,237,0.85)',
      color:        '#fff',
      fontSize:     '14px',
      fontWeight:   '600',
      cursor:       'pointer',
      backdropFilter: 'blur(8px)',
    });
    btn.addEventListener('click', () => {
      if (this._videoEl) {
        this._videoEl.muted = false;
        this._videoEl.play().catch(() => {});
      }
      btn.remove();
    }, { once: true });

    document.body.appendChild(btn);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // destroy
  // ───────────────────────────────────────────────────────────────────────────
  async destroy() {
    if (this._sessionStart) {
      updateSession(
        this._campaign._id,
        Date.now() - this._sessionStart,
        this._getVideoWatchPercent()
      );
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
    document.getElementById('ar-audio-btn')?.remove();
  }

  _getVideoWatchPercent() {
    const v = this._videoEl;
    if (!v || !v.duration) return 0;
    return Math.round((v.currentTime / v.duration) * 100);
  }
}
