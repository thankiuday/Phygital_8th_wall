# WebAR Image Targets — How They Work + MVP Strategy

## What Is an Image Target?

An image target (also called an "image marker") is a reference image that the
AR engine learns to recognise through the phone camera. When the camera frame
matches the target, the engine computes the exact position and rotation of that
image in 3D space, allowing virtual objects to be "anchored" on top of it.

---

## How Image Target Databases Work (Traditional Flow)

### Step 1 — Offline compilation
Every image target must be "compiled" into a proprietary binary format before it
can be tracked at runtime. This compilation:
- Extracts corner-point features (ORB / SIFT descriptors)
- Builds a feature map and a K-D tree for fast nearest-neighbour search
- Outputs a compact binary file (~50–200 KB per image)

### Step 2 — SDK downloads the compiled database
At app/page load, the AR SDK downloads this binary file and loads it into a
WebAssembly module. The WASM tracker then uses it to compare live camera frames
against the stored feature map every 33ms (30fps).

### Step 3 — Target found event
When enough feature points match with consistent geometry, the SDK fires a
`targetFound` event with a 4×4 world matrix. The engine attaches a Three.js
object to that anchor — our 9:16 video plane.

---

## The Dynamic Upload Problem

Traditional image target pipelines (8th Wall Cloud, Vuforia, ARCore) require
you to pre-upload images to a cloud dashboard, wait minutes for compilation,
then download a new database file per campaign. This makes **user-uploaded
targets impossible without a backend compilation service**.

---

## Platform Comparison

| Platform | Open Source | Cost | Dynamic Targets | Notes |
|---|---|---|---|---|
| **8th Wall (Niantic)** | Binary SLAM + MIT framework | Free (self-hosted) | Image: pre-compiled targets | Best cross-browser SLAM on iOS |
| **MindAR.js** | ✅ 100% open | Free | ✅ Browser runtime | Perfect for MVP |
| **AR.js** | ✅ | Free | ❌ Pre-compiled only | Older, less accurate |
| **Zappar** | Partial | Paid tier | ✅ | |
| **Vuforia** | ❌ | Paid | ✅ API | Enterprise |

---

## Our MVP Strategy — MindAR.js with Runtime Compilation

MindAR.js is the **only major WebAR library that compiles image targets entirely
inside the browser** using TensorFlow.js + WebAssembly. This solves our problem:

```
User uploads card image
       ↓
Stored on Cloudinary (URL in DB)
       ↓
AR page opens on phone
       ↓
ar-engine fetches image via fetch()
       ↓
MindAR Compiler.compileImageTargets([imgElement]) → ArrayBuffer (.mind)
  (runs in browser — 5-15s on mobile)
       ↓
Blob URL from buffer → MindARThree(imageTargetSrc: blobUrl)
       ↓
Camera starts → tracking live
       ↓
targetFound → GSAP animates video plane into view
```

### Compilation time (approximate)
| Device | Time |
|---|---|
| iPhone 14 | ~5s |
| Mid-range Android | ~10s |
| Low-end Android | ~15-20s |

This is a one-time cost per session. We show a "Calibrating AR…" progress bar.

### Performance optimisation — Caching compiled .mind files
Once compiled, we can cache the ArrayBuffer in `sessionStorage` keyed by
`targetImageUrl`. Subsequent re-scans in the same session skip recompilation.

**Future upgrade (Module 10):** Pre-compile `.mind` files server-side on campaign
creation (Node.js + puppeteer headless) and store them on Cloudinary. The
ar-engine downloads the pre-compiled file instead of compiling live — reduces
load time to <1s.

---

## How to Upgrade to 8th Wall (surface mode on iOS)

As of 2026, 8th Wall is **free and self-hosted** at [8thwall.org](https://8thwall.org). Surface-only campaigns on iOS use the **Distributed Engine Binary** with the `slam` chunk for world tracking and tap-to-place.

1. Install `@8thwall/engine-binary` and load it with `data-preload-chunks="slam"`.
2. Use the Camera Pipeline Module API (`GlTextureRenderer`, `Threejs`, `XrController`).
3. Include the required **Niantic Spatial copyright notice** in the AR experience when SLAM is active.

Image-target mode still uses MindAR for runtime browser compilation. Migrating image targets to 8th Wall would require server-side target compilation (`.json` targets) per campaign.

---

## Image Quality Guidelines (for best tracking)

| Property | Recommendation |
|---|---|
| Resolution | ≥ 600 × 400 px |
| Content | Rich visual detail — logos, photos, text |
| Avoid | Solid colours, simple geometric patterns |
| Avoid | Reflective or shiny surfaces on the physical card |
| Lighting | Good ambient light when scanning |
| Angle | Hold phone 15–30cm from card, near-perpendicular |

---

## Surface mode (no printed marker)

Campaigns can disable **Image target** (`requiresImageTarget: false`) in the dashboard. The AR engine then uses markerless surface placement instead of MindAR image tracking.

| Platform | Image target ON | Surface mode OFF |
|---|---|---|
| Android Chrome | MindAR | WebXR immersive-ar + hit-test tap-to-place |
| iOS Safari / iPadOS | MindAR | 8th Wall SLAM + tap-to-place |
| Desktop | Preview | Not supported |

Surface mode skips MindAR target compilation (faster boot). Visitors tap **Launch AR Experience**, point the phone at a flat surface, then tap the purple placement ring to play the hologram.
