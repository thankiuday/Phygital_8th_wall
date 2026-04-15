/**
 * loadingScreen.js — Controls the loading overlay displayed
 * while the target is being compiled and the camera is starting.
 *
 * The overlay is defined in index.html with id="ar-loading-overlay".
 */

const overlay  = () => document.getElementById('ar-loading-overlay');
const bar      = () => document.getElementById('ar-progress-bar');
const label    = () => document.getElementById('ar-progress-label');
const errorBox = () => document.getElementById('ar-error-box');
const errMsg   = () => document.getElementById('ar-error-message');
const errSub   = () => document.getElementById('ar-error-sub');

/**
 * updateLoadingProgress
 * @param {number} pct    0–100
 * @param {string} text   Status label
 */
export const updateLoadingProgress = (pct, text) => {
  const b = bar();
  const l = label();
  if (b) b.style.width = `${Math.min(100, pct)}%`;
  if (l) l.textContent = text ?? '';
};

/**
 * hideLoading — fade out and remove the loading overlay.
 * Uses a CSS transition defined in index.html.
 */
export const hideLoading = () => {
  const el = overlay();
  if (!el) return;
  el.style.opacity = '0';
  setTimeout(() => { el.style.display = 'none'; }, 500);
};

/**
 * showError — swap the loading view for an error message.
 * @param {string} headline  Primary user-facing message
 * @param {string} detail    Technical detail (smaller text)
 */
export const showError = (headline, detail = '') => {
  const b = errorBox();
  const m = errMsg();
  const s = errSub();
  const l = overlay();
  const progress = document.getElementById('ar-loading-content');

  if (progress) progress.style.display = 'none';
  if (b) b.style.display = 'flex';
  if (m) m.textContent = headline;
  if (s) s.textContent = detail;
  if (l) l.style.opacity = '1'; // keep overlay visible
};
