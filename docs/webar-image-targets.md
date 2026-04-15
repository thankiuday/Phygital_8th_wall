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
| **8th Wall (Niantic)** | ❌ Closed SDK | $99/mo+ | ✅ Cloud API (paid) | Best tracking quality |
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

## How to Upgrade to 8th Wall (When Budget Allows)

1. Sign up at https://www.8thwall.com/ — get an AppKey
2. Replace MindARThree with 8th Wall's XR pipeline:

```html
<!-- Replace MindAR CDN with 8th Wall -->
<script async src="//apps.8thwall.com/xrweb?appKey=YOUR_KEY"></script>
<script src="//cdn.8thwall.com/web/xrextras/xrextras.js"></script>
```

3. Use 8th Wall's "Cloud Image Targets" API to upload each campaign's card image
   and get back a compiled target database URL — store that URL on the Campaign
   model as `targetDatabaseUrl`.

4. Pass `targetDatabaseUrl` to the 8th Wall `imageTargets` pipeline.

The rest of the Three.js scene (video plane, GSAP animations) is identical.

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
