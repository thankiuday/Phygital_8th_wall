/**
 * gravity.js — smoothed device-gravity tracker for surface detection.
 *
 * Listens to `devicemotion` and maintains an EMA-smoothed gravity reading so
 * the AR scene can tell whether the tracked card is lying on a horizontal
 * surface (table/floor) or hanging vertically (wall, screen held upright).
 *
 * Per the W3C DeviceMotion spec, `accelerationIncludingGravity` for a device
 * at rest points OPPOSITE to gravity (device flat, screen up → z ≈ +9.81),
 * i.e. it already is the "up" direction expressed in the device frame.
 *
 * Camera space vs device frame: the rear camera looks along device −Z and the
 * MindAR Three.js camera is identity, so in natural (portrait) orientation the
 * device frame coincides with camera space. For other orientations we rotate
 * the X/Y components by the screen-orientation angle.
 *
 * iOS 13+ requires a user-gesture-scoped permission request for motion data.
 * We attach one-shot gesture listeners that request it; when permission is
 * unavailable or denied, `getUpVector()` returns null and callers should
 * fall back to permissive behaviour.
 */

const EMA_ALPHA = 0.12;

const state = {
  gx: 0,
  gy: 0,
  gz: 0,
  hasSample: false,
  listening: false,
};

const onMotion = (e) => {
  const g = e.accelerationIncludingGravity;
  if (!g || (g.x == null && g.y == null && g.z == null)) return;
  const x = g.x ?? 0;
  const y = g.y ?? 0;
  const z = g.z ?? 0;
  if (!state.hasSample) {
    state.gx = x;
    state.gy = y;
    state.gz = z;
    state.hasSample = true;
    return;
  }
  state.gx += (x - state.gx) * EMA_ALPHA;
  state.gy += (y - state.gy) * EMA_ALPHA;
  state.gz += (z - state.gz) * EMA_ALPHA;
};

const startListening = () => {
  if (state.listening) return;
  state.listening = true;
  window.addEventListener('devicemotion', onMotion);
};

/**
 * Begin tracking gravity. Safe to call multiple times.
 * On iOS the actual listener attach is deferred until the user's first
 * touch (permission prompt must run inside a gesture handler).
 */
export const initGravityTracker = () => {
  if (typeof window === 'undefined') return;

  const needsPermission =
    typeof DeviceMotionEvent !== 'undefined' &&
    typeof DeviceMotionEvent.requestPermission === 'function';

  if (!needsPermission) {
    startListening();
    return;
  }

  const requestOnGesture = () => {
    window.removeEventListener('touchend', requestOnGesture);
    window.removeEventListener('pointerup', requestOnGesture);
    DeviceMotionEvent.requestPermission()
      .then((res) => {
        if (res === 'granted') startListening();
      })
      .catch(() => {});
  };
  window.addEventListener('touchend', requestOnGesture, { once: true });
  window.addEventListener('pointerup', requestOnGesture, { once: true });
};

const screenAngleRad = () => {
  const deg =
    (typeof screen !== 'undefined' && screen.orientation?.angle != null)
      ? screen.orientation.angle
      : (typeof window !== 'undefined' && typeof window.orientation === 'number')
        ? window.orientation
        : 0;
  return (deg * Math.PI) / 180;
};

/**
 * Up direction in camera/viewport space, normalized, or null when no motion
 * data is available (sensor missing, or iOS permission not granted).
 *
 * @returns {{x:number, y:number, z:number} | null}
 */
export const getUpVector = () => {
  if (!state.hasSample) return null;
  const len = Math.hypot(state.gx, state.gy, state.gz);
  if (len < 1) return null;   // free-fall / garbage sample

  const dx = state.gx / len;
  const dy = state.gy / len;
  const dz = state.gz / len;

  // Rotate device-frame X/Y into the visual viewport frame.
  const a = screenAngleRad();
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return {
    x: dx * cos + dy * sin,
    y: -dx * sin + dy * cos,
    z: dz,
  };
};
