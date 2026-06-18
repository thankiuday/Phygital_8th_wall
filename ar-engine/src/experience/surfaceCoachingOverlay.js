/**
 * surfaceCoachingOverlay — translucent branded guide during surface AR scanning.
 *
 * States: hidden | starting | scanning | ready | placed
 */

import { getSurfaceCoachingCopy } from '../utils/arTargetCopy.js';

const STATE_CLASS = {
  hidden: 'state-hidden',
  starting: 'state-starting',
  scanning: 'state-scanning',
  ready: 'state-ready',
  placed: 'state-placed',
};

/**
 * @param {{
 *   domRoot: HTMLElement,
 *   markUrl?: string,
 *   iosDomReticle?: boolean,
 *   onStartTap?: () => void,
 * }} opts
 */
export const createSurfaceCoachingOverlay = ({
  domRoot,
  markUrl = '/phygital-mark.png',
  iosDomReticle = false,
  onStartTap,
}) => {
  const el = document.createElement('div');
  el.id = 'ar-surface-coaching';
  el.className = 'ar-surface-coaching state-hidden';
  if (iosDomReticle) {
    el.classList.add('ios-surface');
  }
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `
    <div class="ar-surface-coaching-vignette" aria-hidden="true"></div>
    <div class="ar-surface-coaching-content">
      <img src="${markUrl}" alt="" class="ar-surface-coaching-mark" width="48" height="48" />
      <p class="ar-surface-coaching-brand">Powered by Phygital</p>
      <div class="ar-surface-coaching-scan" aria-hidden="true">
        <span class="ar-surface-coaching-scan-line"></span>
      </div>
      <p class="ar-surface-coaching-message" id="ar-surface-coaching-message"></p>
      <p class="ar-surface-coaching-tap" id="ar-surface-coaching-tap">Tap to start camera</p>
    </div>
    ${iosDomReticle ? '<div class="ar-surface-coaching-reticle" aria-hidden="true"></div>' : ''}
  `;
  domRoot.appendChild(el);

  const messageEl = el.querySelector('#ar-surface-coaching-message');
  const tapEl = el.querySelector('#ar-surface-coaching-tap');

  let state = 'hidden';

  const setMessage = (phase) => {
    if (messageEl) {
      messageEl.textContent = getSurfaceCoachingCopy(phase);
    }
  };

  const onTap = (event) => {
    if (state !== 'starting') return;
    event.preventDefault();
    event.stopPropagation();
    onStartTap?.();
  };

  el.addEventListener('click', onTap);
  el.addEventListener('pointerup', onTap);

  return {
    root: el,

    get state() {
      return state;
    },

    setState(next) {
      if (state === next) return;
      Object.values(STATE_CLASS).forEach((cls) => el.classList.remove(cls));
      state = next;
      el.classList.add(STATE_CLASS[next] || STATE_CLASS.hidden);
      el.classList.toggle('state-hidden', next === 'hidden' || next === 'placed');

      if (tapEl) {
        tapEl.style.display = next === 'starting' ? '' : 'none';
      }

      if (next === 'starting') {
        setMessage('starting');
      } else if (next === 'scanning') {
        setMessage('scanning');
      } else if (next === 'ready') {
        setMessage('ready');
      } else if (next === 'placed') {
        el.classList.add('state-placed');
        window.setTimeout(() => {
          Object.values(STATE_CLASS).forEach((cls) => el.classList.remove(cls));
          state = 'hidden';
          el.classList.add(STATE_CLASS.hidden);
          el.setAttribute('aria-hidden', 'true');
        }, 450);
        return;
      }

      el.setAttribute('aria-hidden', next === 'hidden' ? 'true' : 'false');
    },

    destroy() {
      el.removeEventListener('click', onTap);
      el.removeEventListener('pointerup', onTap);
      el.remove();
    },
  };
};
