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
    <div id="ar-dom-overlay"></div>
    <div id="ar-root"></div>
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
