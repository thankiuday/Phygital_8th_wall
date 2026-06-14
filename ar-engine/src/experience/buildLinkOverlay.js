/**
 * buildLinkOverlay — bottom icon dock during video playback.
 */

import { getLinkIconSvg, getLinkAccent } from '../utils/hubLinkIcons.js';
import { recordLinkClick } from '../services/campaignLoader.js';

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
  btn.innerHTML = getLinkIconSvg(kind);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (redirectSlug && link.linkId) {
      recordLinkClick(redirectSlug, link.linkId);
    }
    onBeforeLeave?.();
    openLinkHref(link.href);
  });
  return btn;
};

const gsap = () => window.gsap;

/**
 * @param {{ links: Array, redirectSlug: string, videoEl: HTMLVideoElement, onBeforeLeave?: () => void }} opts
 */
export const buildLinkOverlay = ({ links, redirectSlug, videoEl, onBeforeLeave }) => {
  if (!Array.isArray(links) || links.length === 0 || !videoEl) {
    return null;
  }

  const dock = document.createElement('div');
  dock.id = 'ar-link-dock';

  const inner = document.createElement('div');
  inner.id = 'ar-link-dock-inner';
  inner.className = layoutClassForCount(links.length);

  const buttons = links.map((link) => {
    const btn = createLinkButton(link, redirectSlug, onBeforeLeave);
    inner.appendChild(btn);
    return btn;
  });

  dock.appendChild(inner);
  document.body.appendChild(dock);

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

  const onPlay = () => show();
  const onPlaying = () => show();
  const onPause = () => hide();
  const onEnded = () => hide();

  videoEl.addEventListener('play', onPlay);
  videoEl.addEventListener('playing', onPlaying);
  videoEl.addEventListener('pause', onPause);
  videoEl.addEventListener('ended', onEnded);

  if (!videoEl.paused && !videoEl.ended) {
    show();
  }

  const destroy = () => {
    resetButtons();
    videoEl.removeEventListener('play', onPlay);
    videoEl.removeEventListener('playing', onPlaying);
    videoEl.removeEventListener('pause', onPause);
    videoEl.removeEventListener('ended', onEnded);
    dock.remove();
  };

  return { dock, inner, show, hide, destroy };
};
