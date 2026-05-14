'use strict';

/**
 * cardSizes.js — single source of truth for digital-business-card print
 * dimensions. Mirrored at `client/src/components/card/cardSizes.js` so the
 * on-screen preview is byte-equivalent to the rendered PNG.
 *
 * All pixel values are at 300 DPI (industry standard for offset/digital
 * printing). Puppeteer uses a `deviceScaleFactor` > 1 (`CARD_RENDER_DPR`, default 3)
 * so exported PNGs carry extra physical pixels for crisp zoom/print on top of
 * those logical bleed dimensions.
 *
 * Geometry contract per preset:
 *   trim   = visible card area
 *   bleed  = trim + 0.125" margin per edge (printer cut tolerance)
 *   safe   = trim − 0.07" inset per edge (text/QR must stay inside)
 */

const DPI = 300;
const BLEED_IN = 0.125;          // 0.125" / 37.5 px @ 300 DPI on each edge
const SAFE_INSET_IN = 0.07;      // 0.07"  / 21 px   @ 300 DPI on each edge

const inToPx = (inches) => Math.round(inches * DPI);

const buildSize = (id, label, trimWIn, trimHIn) => {
  const trimW = inToPx(trimWIn);
  const trimH = inToPx(trimHIn);
  const bleed = inToPx(BLEED_IN);
  const safe = inToPx(SAFE_INSET_IN);
  return {
    id,
    label,
    trim: { widthIn: trimWIn, heightIn: trimHIn, widthPx: trimW, heightPx: trimH },
    bleed: {
      widthIn: trimWIn + 2 * BLEED_IN,
      heightIn: trimHIn + 2 * BLEED_IN,
      widthPx: trimW + 2 * bleed,
      heightPx: trimH + 2 * bleed,
      marginPx: bleed,
    },
    safe: {
      widthIn: trimWIn - 2 * SAFE_INSET_IN,
      heightIn: trimHIn - 2 * SAFE_INSET_IN,
      widthPx: trimW - 2 * safe,
      heightPx: trimH - 2 * safe,
      insetPx: safe,
    },
  };
};

const CARD_SIZES = Object.freeze({
  us:        buildSize('us',        'US / Canada Standard',          3.5,  2.0),
  intl:      buildSize('intl',      'International (3.35" x 2.17")', 3.35, 2.17),
  'slim-h':  buildSize('slim-h',    'Slim Horizontal',               3.5,  1.5),
  'slim-v':  buildSize('slim-v',    'Slim Vertical',                 1.5,  3.5),
  'square-s':buildSize('square-s',  'Square Small',                  2.5,  2.5),
  'square-m':buildSize('square-m',  'Square Medium',                 2.75, 2.75),
});

const CARD_SIZE_IDS = Object.freeze(Object.keys(CARD_SIZES));
const DEFAULT_CARD_SIZE = 'us';

const getCardSize = (id) => CARD_SIZES[id] || CARD_SIZES[DEFAULT_CARD_SIZE];

module.exports = {
  DPI,
  BLEED_IN,
  SAFE_INSET_IN,
  CARD_SIZES,
  CARD_SIZE_IDS,
  DEFAULT_CARD_SIZE,
  getCardSize,
};
