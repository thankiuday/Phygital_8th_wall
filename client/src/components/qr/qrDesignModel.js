/**
 * qrDesignModel.js — single source of truth for QR design state shape.
 *
 * The wizard's `design` state is a flat, JSON-serializable object so it can be
 * sent verbatim to the server (it's stored on the Campaign as `qrDesign`).
 * This file holds:
 *   - the default design (used when the wizard first opens),
 *   - constants for the dropdown options,
 *   - `buildQrOptions(design)` which translates the flat shape to the
 *     `qr-code-styling` library's nested options object.
 */

export const FRAME_OPTIONS = [
  { value: 'none',         label: 'None' },
  { value: 'bottom-bar',   label: 'Bottom Bar' },
  { value: 'bottom-arrow', label: 'Bottom Arrow' },
  { value: 'right-arrow',  label: 'Right Arrow' },
];

export const DOT_TYPES = [
  { value: 'square',         label: 'Square' },
  { value: 'rounded',        label: 'Rounded' },
  { value: 'dots',           label: 'Dots' },
  { value: 'classy',         label: 'Classy' },
  { value: 'classy-rounded', label: 'Classy Rounded' },
  { value: 'extra-rounded',  label: 'Extra Rounded' },
];

export const CORNER_SQUARE_TYPES = [
  { value: 'square',        label: 'Square' },
  { value: 'extra-rounded', label: 'Extra Rounded' },
  { value: 'dot',           label: 'Dot' },
];

export const CORNER_DOT_TYPES = [
  { value: 'square', label: 'Square' },
  { value: 'dot',    label: 'Dot' },
];

export const DEFAULT_DESIGN = {
  frame: 'none',
  frameCaption: 'Scan me!',

  dotsType: 'square',
  dotsColor: '#000000',
  dotsUseGradient: false,
  dotsGradientStart: '#000000',
  dotsGradientEnd: '#666666',

  cornersSquareType: 'square',
  cornersSquareColor: '#000000',

  cornersDotType: 'square',
  cornersDotColor: '#000000',

  backgroundColor: '#ffffff',
  backgroundTransparent: false,

  // Logo (data URL).  Empty string means no logo.  We deliberately do NOT
  // include this in DEFAULT_DESIGN's `image` slot so the empty string is
  // harmlessly serialized; the builder below converts to undefined.
  logoDataUrl: '',
};

/**
 * Translate the flat wizard form into the nested options shape that
 * `qr-code-styling` expects.  Everything coming out of this function is
 * already validated by the strict Zod schema on the server, so we keep the
 * client-side builder permissive (no throwing on missing fields).
 */
export const buildQrOptions = (design, encodedData) => {
  const dotsOptions = design.dotsUseGradient
    ? {
        type: design.dotsType,
        gradient: {
          type: 'linear',
          rotation: 0,
          colorStops: [
            { offset: 0, color: design.dotsGradientStart },
            { offset: 1, color: design.dotsGradientEnd },
          ],
        },
      }
    : {
        type: design.dotsType,
        color: design.dotsColor,
      };

  const cornersSquareOptions = {
    type: design.cornersSquareType,
    color: design.cornersSquareColor,
  };

  const cornersDotOptions = {
    type: design.cornersDotType,
    color: design.cornersDotColor,
  };

  const backgroundOptions = design.backgroundTransparent
    ? { color: 'transparent' }
    : { color: design.backgroundColor };

  // qr-code-styling merges options on `update()`. If `imageOptions` is ever
  // omitted while a logo was previously shown, the library still dereferences
  // `imageOptions.hideBackgroundDots` → crash. Always send a full object.
  const imageOptions = {
    hideBackgroundDots: Boolean(design.logoDataUrl),
    imageSize: 0.4,
    margin: 4,
  };

  return {
    width: 256,
    height: 256,
    margin: 6,
    type: 'svg',
    data: encodedData,
    qrOptions: { errorCorrectionLevel: 'Q' },
    dotsOptions,
    cornersSquareOptions,
    cornersDotOptions,
    backgroundOptions,
    image: design.logoDataUrl || undefined,
    imageOptions,
  };
};

/**
 * Translate the wizard form into the slim qrDesign payload we persist on the
 * Campaign.  Mirrors the strict server-side schema in
 * server/src/validators/campaignValidators.js.
 */
export const buildQrDesignPayload = (design) => {
  const payload = {
    width: 256,
    height: 256,
    margin: 6,
    dotsOptions: design.dotsUseGradient
      ? {
          type: design.dotsType,
          gradient: {
            type: 'linear',
            rotation: 0,
            colorStops: [
              { offset: 0, color: design.dotsGradientStart },
              { offset: 1, color: design.dotsGradientEnd },
            ],
          },
        }
      : { type: design.dotsType, color: design.dotsColor },
    cornersSquareOptions: {
      type: design.cornersSquareType,
      color: design.cornersSquareColor,
    },
    cornersDotOptions: {
      type: design.cornersDotType,
      color: design.cornersDotColor,
    },
    backgroundOptions: design.backgroundTransparent
      ? undefined
      : { color: design.backgroundColor },
    frame: design.frame,
    frameCaption: design.frameCaption || undefined,
  };

  if (design.logoDataUrl) {
    payload.image = design.logoDataUrl;
    payload.imageOptions = { hideBackgroundDots: true, imageSize: 0.4, margin: 4 };
  }

  // Strip undefined keys so we don't send noise the server's strict() schema
  // would reject.
  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
};
