/**
 * buildHubToggle — persistent "View profile hub" button (mirror of hub Launch hologram).
 */

const HUB_ICON_SVG = `
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      points="15 3 21 3 21 9"/>
    <line fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      x1="10" y1="14" x2="21" y2="3"/>
  </svg>
`;

/**
 * @param {string} hubPageUrl
 */
export const buildHubToggle = (hubPageUrl) => {
  if (!hubPageUrl) return null;

  const btn = document.createElement('a');
  btn.id = 'ar-hub-toggle';
  btn.href = hubPageUrl;
  btn.className = 'visible';
  btn.setAttribute('aria-label', 'View profile hub');
  btn.innerHTML = `${HUB_ICON_SVG}<span>View profile hub</span>`;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = hubPageUrl;
  });

  document.body.appendChild(btn);

  const destroy = () => btn.remove();

  return { el: btn, destroy };
};
