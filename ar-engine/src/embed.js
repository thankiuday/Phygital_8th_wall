export { ARExperience } from './experience/ARExperience.js';
export {
  checkWebXrArSupported,
  buildSurfaceSessionInit,
  requestSurfaceSession,
} from './utils/webxr.js';
export {
  resolveSurfaceArBackend,
  isSurfaceArSupported,
  isMobileTouchDevice,
} from './utils/surfaceCapability.js';
export { effectiveUsesImageTarget, usesImageTarget } from './utils/arTargetCopy.js';
export { createArSessionId } from './utils/arReturnReload.js';
