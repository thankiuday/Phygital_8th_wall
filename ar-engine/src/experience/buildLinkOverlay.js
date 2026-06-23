/**
 * buildLinkOverlay — bottom icon dock shown while the AR target is active.
 */

import { getLinkIconSvg, getLinkAccent } from '../utils/hubLinkIcons.js';
import { recordLinkClick } from '../services/campaignLoader.js';
import { bindArTap } from '../utils/bindArTap.js';
import { resolvePlaybackMediaUrl } from '../utils/resolvePlaybackMediaUrl.js';

const STAGGER_SEC = 0.3;

const openLinkHref = (href) => {
  const h = String(href || '');
  if (/^(tel:|mailto:)/i.test(h)) {
    window.location.href = h;
    return;
  }
  window.open(h, '_blank', 'noopener,noreferrer');
};

const layoutClassForCount = (count) => {
  if (count === 1) return 'layout-single';
  if (count >= 2 && count <= 4) return 'layout-even';
  return 'layout-many';
};

const createLinkButton = (link, redirectSlug, onBeforeLeave) => {
  const kind = link.kind || 'custom';
  const accent = getLinkAccent(kind);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ar-link-btn';
  btn.setAttribute('aria-label', link.label || kind);
  btn.style.background = accent.bg;
  btn.style.color = accent.color;

  if (link.logoUrl) {
    btn.style.background = 'transparent';
    const img = document.createElement('img');
    img.src = resolvePlaybackMediaUrl(link.logoUrl);
    img.alt = '';
    img.className = 'ar-link-logo';
    img.setAttribute('aria-hidden', 'true');
    img.referrerPolicy = 'no-referrer';
    btn.appendChild(img);
  } else {
    btn.innerHTML = getLinkIconSvg(kind);
  }

  const onActivate = () => {
    if (redirectSlug && link.linkId) {
      recordLinkClick(redirectSlug, link.linkId);
    }
    onBeforeLeave?.();
    // Defer navigation so sessionStorage is committed before the tab switches.
    setTimeout(() => openLinkHref(link.href), 0);
  };

  const unbindTap = bindArTap(btn, onActivate);

  return { btn, unbindTap };
};

const gsap = () => window.gsap;

/**
 * @param {{ links: Array, redirectSlug: string, onBeforeLeave?: () => void, parent?: HTMLElement }} opts
 */
export const buildLinkOverlay = ({ links, redirectSlug, onBeforeLeave, parent }) => {
  if (!Array.isArray(links) || links.length === 0) {
    return null;
  }

  const dock = document.createElement('div');
  dock.id = 'ar-link-dock';

  const inner = document.createElement('div');
  inner.id = 'ar-link-dock-inner';
  inner.className = layoutClassForCount(links.length);

  const tapUnbinds = [];
  const buttons = links.map((link) => {
    const { btn, unbindTap } = createLinkButton(link, redirectSlug, onBeforeLeave);
    tapUnbinds.push(unbindTap);
    inner.appendChild(btn);
    return btn;
  });

  dock.appendChild(inner);
  (parent || document.body).appendChild(dock);

  let isVisible = false;

  const animateIn = () => {
    const g = gsap();
    if (!g) {
      buttons.forEach((btn) => {
        btn.style.opacity = '1';
        btn.style.transform = 'none';
      });
      return;
    }
    g.killTweensOf(buttons);
    g.set(buttons, { opacity: 0, y: 14, scale: 0.82 });
    g.to(buttons, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.35,
      stagger: STAGGER_SEC,
      ease: 'back.out(1.4)',
    });
  };

  const resetButtons = () => {
    const g = gsap();
    if (g) g.killTweensOf(buttons);
    buttons.forEach((btn) => {
      btn.style.opacity = '';
      btn.style.transform = '';
    });
  };

  const show = () => {
    if (isVisible) return;
    isVisible = true;
    dock.classList.add('visible');
    animateIn();
  };

  const hide = () => {
    if (!isVisible) return;
    isVisible = false;
    resetButtons();
    dock.classList.remove('visible');
  };

  const destroy = () => {
    resetButtons();
    tapUnbinds.forEach((unbind) => unbind());
    dock.remove();
  };

  return { dock, inner, show, hide, destroy };
};
