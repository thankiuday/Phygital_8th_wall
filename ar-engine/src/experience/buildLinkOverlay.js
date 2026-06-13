/**
 * buildLinkOverlay — left/right circular link buttons during video playback.
 */

import { getLinkIconSvg, getLinkAccent } from '../utils/hubLinkIcons.js';
import { recordLinkClick } from '../services/campaignLoader.js';

const openLinkHref = (href) => {
  const h = String(href || '');
  if (/^(tel:|mailto:)/i.test(h)) {
    window.location.href = h;
    return;
  }
  window.open(h, '_blank', 'noopener,noreferrer');
};

const createLinkButton = (link, redirectSlug) => {
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
    openLinkHref(link.href);
  });
  return btn;
};

const createRail = (id) => {
  const rail = document.createElement('div');
  rail.id = id;
  rail.className = 'ar-link-rail';
  document.body.appendChild(rail);
  return rail;
};

/**
 * @param {{ links: Array, redirectSlug: string, videoEl: HTMLVideoElement }} opts
 */
export const buildLinkOverlay = ({ links, redirectSlug, videoEl }) => {
  if (!Array.isArray(links) || links.length === 0 || !videoEl) {
    return null;
  }

  const leftRail = createRail('ar-link-rail-left');
  const rightRail = createRail('ar-link-rail-right');

  links.forEach((link, index) => {
    const btn = createLinkButton(link, redirectSlug);
    (index % 2 === 0 ? leftRail : rightRail).appendChild(btn);
  });

  if (!leftRail.childElementCount) leftRail.remove();
  if (!rightRail.childElementCount) rightRail.remove();

  const rails = [leftRail, rightRail].filter((r) => r.parentElement);
  if (rails.length === 0) return null;

  const show = () => {
    rails.forEach((r) => r.classList.add('visible'));
  };
  const hide = () => {
    rails.forEach((r) => r.classList.remove('visible'));
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
    videoEl.removeEventListener('play', onPlay);
    videoEl.removeEventListener('playing', onPlaying);
    videoEl.removeEventListener('pause', onPause);
    videoEl.removeEventListener('ended', onEnded);
    leftRail.remove();
    rightRail.remove();
  };

  return { leftRail, rightRail, show, hide, destroy };
};
