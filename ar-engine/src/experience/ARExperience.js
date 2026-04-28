/**
 * ARExperience.js — Main WebAR orchestrator (production polish build)
 *
 * STABILITY PIPELINE
 * ──────────────────
 * Three layers cooperate so the hologram is steady at rest AND glides on motion:
 *
 *  1. MindAR One-Euro filter — algorithm-level smoothing of raw tracking
 *     (filterMinCF / filterBeta on MindARThree).  Tight cutoff at rest kills
 *     shimmer; high beta opens it on real motion → no swimming / lag.
 *
 *  2. Post-MindAR anchor-matrix EMA — every render frame we read the matrix
 *     MindAR just wrote into anchor.group, lerp/slerp our cached "smoothed"
 *     pose toward it (with a sub-millimetre dead-zone), and write the
 *     smoothed pose BACK to anchor.group.matrix.  All children inherit the
 *     smoothed transform for free; no scene-space re-parenting needed (which
 *     historically broke first-frame visibility).
 *
 *  3. Camera-facing billboard with EMA — the plane's facing direction is
 *     also slerped each frame, so it glides toward the viewer.
 *
 * SCENE HIERARCHY (minimalist)
 * ────────────────────────────
 * anchor.group  (MindAR — smoothed in-place each frame)
 *   └─ _plane   (video; billboard quaternion)
 *
 * No rim glow, no base glow, no scan ring — pure video on the card.
 *
 * UX OVERLAY (DOM, sibling of #ar-root)
 * ──────────────────────────────────────
 *   #ar-controls  — bottom-center pill: play/pause, mute, fullscreen
 *   #ar-buffer    — centered ring spinner shown while video stalls
 *   #ar-watermark — bottom-right "Powered by Phygital8thWall" (auto-fades)
 *
 * AUTO-QUALITY
 * ────────────
 * Render loop tracks a 60-frame FPS average.  If sustained < 30 fps we drop
 * pixelRatio to 1; if it recovers above 50 fps we restore it to
 * min(devicePixelRatio, 2).  Keeps the video smooth on low-end phones.
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
// Scene constants
// ─────────────────────────────────────────────────────────────────────────────

// Portrait 9:16 plane — 65 % of card width.
const PLANE_WIDTH  = 0.65;
const PLANE_HEIGHT = PLANE_WIDTH * (16 / 9);   // ≈ 1.156

// Plane centre offset from card surface when fully emerged (anchor-local +Z).
export const PLANE_REST_Z = PLANE_HEIGHT / 2;  // ≈ 0.578

// ─────────────────────────────────────────────────────────────────────────────
// Smoothing levers — tune to dial responsiveness vs stability.
// Higher α = snappier; lower α = smoother but laggier.
// ─────────────────────────────────────────────────────────────────────────────

// Anchor-matrix EMA factors (per-frame lerp/slerp toward the raw MindAR pose).
// 0.25 ≈ 4-frame half-life at 60 fps: smooth, but tracks real motion within ~70 ms.
const ANCHOR_SMOOTH_ALPHA    = 0.25;

// Sub-millimetre positional dead-zone (squared, in MindAR units ≈ metres²).
// (0.0004 m)² — kills the last shimmer when the card is perfectly still.
const ANCHOR_POS_DEADZONE_SQ = 1.6e-7;

// Billboard facing-direction quaternion EMA.  0.18 → 5-frame half-life.
const BILLBOARD_ALPHA = 0.18;

// FPS-aware auto-quality
const FPS_DROP_THRESHOLD    = 30;
const FPS_RESTORE_THRESHOLD = 50;
const FPS_SAMPLE_FRAMES     = 60;

// ─────────────────────────────────────────────────────────────────────────────
export class ARExperience {
  constructor({ container, campaign }) {
    this._container = container;
    this._campaign  = campaign;

    // Three.js / MindAR objects
    this._mindarThree  = null;
    this._anchor       = null;
    this._videoEl      = null;
    this._videoTexture = null;

    // Scene meshes
    this._plane        = null;   // video quad (billboard quaternion each frame)

    // Pre-allocated render-loop scratch objects
    this._scratch      = null;

    // Anchor-EMA state
    this._anchorPrimed = false;  // false → next frame snaps; true → lerp/slerp

    // FPS-aware quality state
    this._fpsLastTs        = 0;
    this._fpsAccum         = 0;
    this._fpsFrames        = 0;
    this._fpsLowStreak     = 0;
    this._fpsHighStreak    = 0;
    this._lowQualityActive = false;
    this._defaultPixelRatio = 1;

    // UX DOM overlays (created in _buildUx)
    this._ui = {
      controls:    null,
      btnPlay:     null,
      btnMute:     null,
      btnFs:       null,
      buffer:      null,
      watermark:   null,
      _videoListeners: null,
    };

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

      // One-Euro: tight cutoff at rest, opens on motion
      filterMinCF:    0.0001,
      filterBeta:     0.01,

      warmupTolerance: 5,
      missTolerance:   20,
    });

    const { renderer, scene, camera } = this._mindarThree;

    // Transparent canvas — camera feed shows through
    renderer.setClearColor(0x000000, 0);
    scene.background = null;
    renderer.outputEncoding = THREE.sRGBEncoding;
    this._defaultPixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(this._defaultPixelRatio);
    renderer.physicallyCorrectLights = true;

    // 3 — Build scene + UX overlay
    this._buildScene(THREE, renderer);
    this._buildUx();

    // 4 — Wire anchor events; plane lives on anchor.group (always at the card)
    const anchor = this._mindarThree.addAnchor(0);
    this._anchor = anchor;
    anchor.onTargetFound = () => this._onTargetFound();
    anchor.onTargetLost  = () => this._onTargetLost();
    anchor.group.add(this._plane);

    scene.add(new THREE.AmbientLight(0xffffff, 1));

    // 5 — Start MindAR
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

    // ── Render loop ──────────────────────────────────────────────────────────
    const sc = this._scratch;

    this._renderLoop = (now) => {
      // 0. Anchor-matrix EMA (in-place rewrite of anchor.group.matrix).
      //    Reading MindAR's matrix directly (instead of getWorldPosition)
      //    bypasses updateMatrix(), which would otherwise recompose the matrix
      //    from identity p/q/s and wipe the pose MindAR just wrote.
      this._anchor.group.matrix.decompose(sc.rawPos, sc.rawQuat, sc.scl);

      const isLive =
        sc.rawPos.lengthSq() > 1e-8 ||
        Math.abs(1 - sc.rawQuat.w) > 1e-6;

      if (isLive) {
        if (!this._anchorPrimed) {
          sc.smoothPos.copy(sc.rawPos);
          sc.smoothQuat.copy(sc.rawQuat);
          this._anchorPrimed = true;
        } else {
          sc.posDelta.subVectors(sc.rawPos, sc.smoothPos);
          if (sc.posDelta.lengthSq() > ANCHOR_POS_DEADZONE_SQ) {
            sc.smoothPos.lerp(sc.rawPos, ANCHOR_SMOOTH_ALPHA);
          }
          sc.smoothQuat.slerp(sc.rawQuat, ANCHOR_SMOOTH_ALPHA);
        }
        this._anchor.group.matrix.compose(sc.smoothPos, sc.smoothQuat, sc.unitScale);
      }

      // 1. Billboard: plane (+ rim future siblings) always faces the camera.
      //    EMA-smoothed quaternion → calmer face-to-camera.
      if (this._plane.visible) {
        camera.getWorldPosition(sc.camPos);
        this._anchor.group.getWorldPosition(sc.anchorWorldPos);

        sc.towardCam.subVectors(sc.camPos, sc.anchorWorldPos);
        if (sc.towardCam.lengthSq() > 0.0001) {
          sc.towardCam.normalize();
          sc.billboardWorldQuat.setFromUnitVectors(sc.FWD, sc.towardCam);
          sc.smoothBillboardQuat.slerp(sc.billboardWorldQuat, BILLBOARD_ALPHA);

          // Convert smoothed world quaternion to anchor.group local space
          this._anchor.group.getWorldQuaternion(sc.parentQuatInv);
          sc.parentQuatInv.invert();
          sc.parentQuatInv.multiply(sc.smoothBillboardQuat);
          this._plane.quaternion.copy(sc.parentQuatInv);
        }
      }

      // 2. Upload latest decoded video frame to GPU texture
      if (
        this._videoTexture &&
        this._videoEl?.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        this._videoTexture.needsUpdate = true;
      }

      // 3. Render
      renderer.render(scene, camera);

      // 4. FPS-aware auto-quality (after render, so dt reflects real GPU work)
      this._sampleFps(now ?? performance.now(), renderer);
    };

    renderer.setAnimationLoop(this._renderLoop);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // _buildScene — creates the video plane only; boot() adds it to anchor.group
  // ───────────────────────────────────────────────────────────────────────────
  _buildScene(THREE, renderer) {
    this._scratch = {
      // Anchor-matrix EMA
      rawPos:              new THREE.Vector3(),
      rawQuat:             new THREE.Quaternion(),
      scl:                 new THREE.Vector3(),
      smoothPos:           new THREE.Vector3(),
      smoothQuat:          new THREE.Quaternion(),
      posDelta:            new THREE.Vector3(),
      unitScale:           new THREE.Vector3(1, 1, 1),

      // Billboard
      camPos:              new THREE.Vector3(),
      anchorWorldPos:      new THREE.Vector3(),
      towardCam:           new THREE.Vector3(),
      billboardWorldQuat:  new THREE.Quaternion(),
      smoothBillboardQuat: new THREE.Quaternion(),
      parentQuatInv:       new THREE.Quaternion(),
      FWD:                 new THREE.Vector3(0, 0, 1),
    };

    // ── Off-screen video element ─────────────────────────────────────────────
    this._videoEl = document.createElement('video');
    Object.assign(this._videoEl, {
      src:         this._campaign.videoUrl,
      loop:        true,
      muted:       true,      // unmuted later in _onTargetFound
      playsInline: true,
      crossOrigin: 'anonymous',
      preload:     'auto',
    });
    this._videoEl.setAttribute('width',  '1080');
    this._videoEl.setAttribute('height', '1920');
    this._videoEl.style.display = 'none';
    document.body.appendChild(this._videoEl);
    this._videoEl.load();

    // ── Video texture ────────────────────────────────────────────────────────
    this._videoTexture = new THREE.VideoTexture(this._videoEl);
    this._videoTexture.minFilter = THREE.LinearFilter;
    this._videoTexture.magFilter = THREE.LinearFilter;
    this._videoTexture.generateMipmaps = false;
    this._videoTexture.encoding = THREE.sRGBEncoding;
    const maxAniso = renderer.capabilities?.getMaxAnisotropy?.() ?? 1;
    this._videoTexture.anisotropy = maxAniso;

    // ── Video plane (billboard — render loop sets quaternion each frame) ─────
    const planeGeo = new THREE.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT);
    const planeMat = new THREE.MeshBasicMaterial({
      map:         this._videoTexture,
      transparent: true,
      opacity:     0,
      side:        THREE.DoubleSide,
      depthWrite:  false,
    });
    this._plane = new THREE.Mesh(planeGeo, planeMat);
    this._plane.scale.set(1, 0, 1);
    this._plane.position.set(0, 0, 0);
    this._plane.renderOrder = 1;
    this._plane.visible = false;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // _buildUx — DOM overlays (controls, buffer spinner, watermark)
  // ───────────────────────────────────────────────────────────────────────────
  _buildUx() {
    // Controls pill (hidden until target is found for the first time)
    const controls = document.createElement('div');
    controls.id = 'ar-controls';
    controls.innerHTML = `
      <button class="ar-ctrl" data-action="play"  aria-label="Play / pause">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path class="icon-pause" fill="currentColor" d="M6 5h4v14H6zM14 5h4v14h-4z"/>
          <path class="icon-play"  fill="currentColor" d="M8 5v14l11-7z" style="display:none"/>
        </svg>
      </button>
      <button class="ar-ctrl" data-action="mute" aria-label="Mute / unmute">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path class="icon-vol"  fill="currentColor" d="M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06A7 7 0 0 1 14 18.7v2.06A9 9 0 0 0 14 3.23z"/>
          <path class="icon-mute" fill="currentColor" d="M3 10v4h4l5 5V5L7 10H3zm15.59 2L21 9.59 19.59 8.17 17.17 10.59 14.76 8.17 13.34 9.59 15.76 12l-2.42 2.41 1.42 1.42 2.41-2.42 2.42 2.42L21 14.41z" style="display:none"/>
        </svg>
      </button>
      <button class="ar-ctrl" data-action="fullscreen" aria-label="Fullscreen">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M5 5h5V3H3v7h2zm9-2v2h5v5h2V3zM5 19v-5H3v7h7v-2zm14 0h-5v2h7v-7h-2z"/>
        </svg>
      </button>
    `;
    document.body.appendChild(controls);

    const btnPlay = controls.querySelector('[data-action="play"]');
    const btnMute = controls.querySelector('[data-action="mute"]');
    const btnFs   = controls.querySelector('[data-action="fullscreen"]');

    btnPlay.addEventListener('click', () => this._togglePlayPause());
    btnMute.addEventListener('click', () => this._toggleMute());
    btnFs.addEventListener('click',   () => this._toggleFullscreen());

    // Buffer spinner (hidden by default)
    const buffer = document.createElement('div');
    buffer.id = 'ar-buffer';
    buffer.innerHTML = '<div class="ar-buffer-ring"></div>';
    document.body.appendChild(buffer);

    // Watermark (auto-fades via CSS keyframes)
    const watermark = document.createElement('div');
    watermark.id = 'ar-watermark';
    watermark.textContent = 'Powered by Phygital8thWall';
    document.body.appendChild(watermark);

    this._ui.controls  = controls;
    this._ui.btnPlay   = btnPlay;
    this._ui.btnMute   = btnMute;
    this._ui.btnFs     = btnFs;
    this._ui.buffer    = buffer;
    this._ui.watermark = watermark;

    // Buffer state listeners on the video element
    const onWaiting = () => this._ui.buffer.classList.add('visible');
    const onPlaying = () => this._ui.buffer.classList.remove('visible');
    const onCanPlay = () => this._ui.buffer.classList.remove('visible');
    const onStalled = () => this._ui.buffer.classList.add('visible');
    this._videoEl.addEventListener('waiting', onWaiting);
    this._videoEl.addEventListener('playing', onPlaying);
    this._videoEl.addEventListener('canplay', onCanPlay);
    this._videoEl.addEventListener('stalled', onStalled);
    this._videoEl.addEventListener('play',    () => this._refreshPlayIcon());
    this._videoEl.addEventListener('pause',   () => this._refreshPlayIcon());
    this._videoEl.addEventListener('volumechange', () => this._refreshMuteIcon());

    this._ui._videoListeners = { onWaiting, onPlaying, onCanPlay, onStalled };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // FPS sampling for auto-quality
  // ───────────────────────────────────────────────────────────────────────────
  _sampleFps(nowMs, renderer) {
    if (!this._fpsLastTs) {
      this._fpsLastTs = nowMs;
      return;
    }
    const dt = nowMs - this._fpsLastTs;
    this._fpsLastTs = nowMs;
    if (dt <= 0 || dt > 1000) return;   // ignore tab-switch spikes

    this._fpsAccum  += dt;
    this._fpsFrames += 1;

    if (this._fpsFrames < FPS_SAMPLE_FRAMES) return;

    const avgDt = this._fpsAccum / this._fpsFrames;
    const fps   = 1000 / avgDt;
    this._fpsAccum = 0;
    this._fpsFrames = 0;

    if (fps < FPS_DROP_THRESHOLD) {
      this._fpsLowStreak  += 1;
      this._fpsHighStreak  = 0;
    } else if (fps > FPS_RESTORE_THRESHOLD) {
      this._fpsHighStreak += 1;
      this._fpsLowStreak   = 0;
    } else {
      this._fpsLowStreak   = 0;
      this._fpsHighStreak  = 0;
    }

    if (!this._lowQualityActive && this._fpsLowStreak >= 1) {
      renderer.setPixelRatio(1);
      this._lowQualityActive = true;
    } else if (this._lowQualityActive && this._fpsHighStreak >= 1) {
      renderer.setPixelRatio(this._defaultPixelRatio);
      this._lowQualityActive = false;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Event handlers
  // ───────────────────────────────────────────────────────────────────────────
  _onTargetFound() {
    // Snap the EMA on (re-)detection so we don't carry stale pose
    this._anchorPrimed = false;

    // Prime the smoothed billboard quaternion toward the camera
    const sc = this._scratch;
    const camera = this._mindarThree.camera;
    this._anchor.group.getWorldPosition(sc.anchorWorldPos);
    camera.getWorldPosition(sc.camPos);
    sc.towardCam.subVectors(sc.camPos, sc.anchorWorldPos);
    if (sc.towardCam.lengthSq() > 0.0001) {
      sc.towardCam.normalize();
      sc.smoothBillboardQuat.setFromUnitVectors(sc.FWD, sc.towardCam);
    }

    this._playWithAudio();
    animateTargetFound(this._plane, PLANE_REST_Z);

    // Reveal the controls overlay (after the entrance has started)
    this._ui.controls?.classList.add('visible');
  }

  _onTargetLost() {
    this._anchorPrimed = false;
    animateTargetLost(this._plane, PLANE_REST_Z);
    this._videoEl?.pause();
    // Keep controls visible — user may want to keep using them; spinner hides
    this._ui.buffer?.classList.remove('visible');
  }

  /**
   * Attempts to play the video unmuted.  Falls back to muted on iOS Safari;
   * the user can tap the mute button in the controls pill to enable audio.
   */
  _playWithAudio() {
    const v = this._videoEl;
    if (!v) return;

    v.muted = false;
    v.play().then(() => {
      this._refreshMuteIcon();
    }).catch(() => {
      v.muted = true;
      v.play().catch(() => {});
      this._refreshMuteIcon();
    });
  }

  _togglePlayPause() {
    const v = this._videoEl;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }

  _toggleMute() {
    const v = this._videoEl;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.paused) v.play().catch(() => {});
  }

  _toggleFullscreen() {
    const root = this._container || document.documentElement;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else if (root.requestFullscreen) {
      root.requestFullscreen().catch(() => {});
    } else if (root.webkitRequestFullscreen) {
      root.webkitRequestFullscreen();
    }
  }

  _refreshPlayIcon() {
    const v = this._videoEl;
    const btn = this._ui.btnPlay;
    if (!v || !btn) return;
    const playing = !v.paused && !v.ended;
    btn.querySelector('.icon-pause').style.display = playing ? '' : 'none';
    btn.querySelector('.icon-play').style.display  = playing ? 'none' : '';
  }

  _refreshMuteIcon() {
    const v = this._videoEl;
    const btn = this._ui.btnMute;
    if (!v || !btn) return;
    btn.querySelector('.icon-vol').style.display  = v.muted ? 'none' : '';
    btn.querySelector('.icon-mute').style.display = v.muted ? '' : 'none';
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

    // Detach video listeners
    const v = this._videoEl;
    const ls = this._ui._videoListeners;
    if (v && ls) {
      v.removeEventListener('waiting', ls.onWaiting);
      v.removeEventListener('playing', ls.onPlaying);
      v.removeEventListener('canplay', ls.onCanPlay);
      v.removeEventListener('stalled', ls.onStalled);
    }
    if (v) {
      v.pause();
      v.remove();
    }

    this._videoTexture?.dispose();

    // Remove DOM overlays
    this._ui.controls?.remove();
    this._ui.buffer?.remove();
    this._ui.watermark?.remove();
  }

  _getVideoWatchPercent() {
    const v = this._videoEl;
    if (!v || !v.duration) return 0;
    return Math.round((v.currentTime / v.duration) * 100);
  }
}
