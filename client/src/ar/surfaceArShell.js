/**
 * Surface AR shell — creates DOM synchronously inside a user-gesture handler
 * so WebXR requestSession can use the dom-overlay root immediately.
 */

let shellEl = null;

export const createSurfaceArShell = () => {
  if (shellEl) {
    return {
      shell: shellEl,
      arRoot: shellEl.querySelector('#ar-root'),
      domOverlay: shellEl.querySelector('#ar-dom-overlay'),
    };
  }

  const root = document.createElement('div');
  root.id = 'surface-ar-shell';
  root.className = 'surface-ar-shell';
  root.innerHTML = `
    <div id="ar-root"></div>
    <div id="ar-dom-overlay"></div>
    <button type="button" class="surface-ar-close" id="surface-ar-close" aria-label="Close AR">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/>
      </svg>
    </button>
  `;
  document.body.appendChild(root);
  document.body.classList.add('ar-surface-active');
  shellEl = root;

  return {
    shell: root,
    arRoot: root.querySelector('#ar-root'),
    domOverlay: root.querySelector('#ar-dom-overlay'),
  };
};

export const removeSurfaceArShell = () => {
  document.body.classList.remove('ar-surface-active');
  shellEl?.remove();
  shellEl = null;
};

export const getSurfaceArShell = () => shellEl;

/** Inline error banner for embedded surface AR (no ar-engine loading overlay). */
export const showSurfaceArBootError = (headline, detail = '') => {
  const shell = shellEl;
  if (!shell) return;

  let box = shell.querySelector('#surface-ar-boot-error');
  if (!box) {
    box = document.createElement('div');
    box.id = 'surface-ar-boot-error';
    box.className = 'surface-ar-boot-error';
    box.innerHTML = `
      <p class="surface-ar-boot-error-title"></p>
      <p class="surface-ar-boot-error-detail"></p>
    `;
    shell.appendChild(box);
  }

  const title = box.querySelector('.surface-ar-boot-error-title');
  const sub = box.querySelector('.surface-ar-boot-error-detail');
  if (title) title.textContent = headline;
  if (sub) sub.textContent = detail;
  box.hidden = false;
};

export const hideSurfaceArBootError = () => {
  const box = shellEl?.querySelector('#surface-ar-boot-error');
  if (box) box.hidden = true;
};
