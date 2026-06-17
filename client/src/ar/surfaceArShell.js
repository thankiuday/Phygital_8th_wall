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
    <div id="ar-dom-overlay">
      <p id="ar-surface-place-hint" aria-hidden="true">Tap the purple ring to place the hologram</p>
    </div>
    <div id="ar-root"></div>
    <button type="button" class="surface-ar-close" id="surface-ar-close" aria-label="Close AR">×</button>
  `;
  document.body.appendChild(root);
  shellEl = root;

  return {
    shell: root,
    arRoot: root.querySelector('#ar-root'),
    domOverlay: root.querySelector('#ar-dom-overlay'),
  };
};

export const removeSurfaceArShell = () => {
  shellEl?.remove();
  shellEl = null;
};

export const getSurfaceArShell = () => shellEl;
