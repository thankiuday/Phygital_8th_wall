/**
 * cardSizes.js — client mirror of `server/src/constants/cardSizes.js`. Both
 * files MUST stay in sync; the on-screen preview at print scale needs to be
 * byte-equivalent to the rendered PNG.
 */

const DPI = 300;
const BLEED_IN = 0.125;
const SAFE_INSET_IN = 0.07;

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

export const CARD_SIZES = Object.freeze({
  us:        buildSize('us',        'US / Canada Standard (3.5" x 2")',          3.5,  2.0),
  intl:      buildSize('intl',      'International (3.35" x 2.17")',             3.35, 2.17),
  'slim-h':  buildSize('slim-h',    'Slim Horizontal (3.5" x 1.5")',             3.5,  1.5),
  'slim-v':  buildSize('slim-v',    'Slim Vertical (1.5" x 3.5")',               1.5,  3.5),
  'square-s':buildSize('square-s',  'Square Small (2.5" x 2.5")',                2.5,  2.5),
  'square-m':buildSize('square-m',  'Square Medium (2.75" x 2.75")',             2.75, 2.75),
});

export const CARD_SIZE_IDS = Object.keys(CARD_SIZES);
export const DEFAULT_CARD_SIZE = 'us';
export const getCardSize = (id) => CARD_SIZES[id] || CARD_SIZES[DEFAULT_CARD_SIZE];

export { DPI, BLEED_IN, SAFE_INSET_IN };
