/**
 * bindArTap — reliable tap/click on iOS Safari over AR camera layers.
 */

/**
 * @param {HTMLElement} el
 * @param {(e: Event) => void} handler
 * @returns {() => void} cleanup
 */
export const bindArTap = (el, handler) => {
  if (!el || typeof handler !== 'function') return () => {};

  const onClick = (e) => {
    e.stopPropagation();
    handler(e);
  };

  const onTouchEnd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handler(e);
  };

  el.addEventListener('click', onClick);
  el.addEventListener('touchend', onTouchEnd, { passive: false });

  return () => {
    el.removeEventListener('click', onClick);
    el.removeEventListener('touchend', onTouchEnd);
  };
};
