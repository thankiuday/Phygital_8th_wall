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
  /** New sessions: transparent QR background by default (Step 2 checkbox on). */
  backgroundTransparent: true,

  // Logo (data URL).  Empty string means no logo.  We deliberately do NOT
  // include this in DEFAULT_DESIGN's `image` slot so the empty string is
  // harmlessly serialized; the builder below converts to undefined.
  logoDataUrl: '',
};

/**
 * Frame stroke / label colour from either flat wizard `design` or persisted API `qrDesign`.
 * Matches Step2DesignQr + QrFrame: gradient → first stop, else solid dot colour.
 */
export const frameAccentFromDesign = (design) => {
  if (!design || typeof design !== 'object') return '#000000';
  const dots = design.dotsOptions;
  if (dots && typeof dots === 'object') {
    const stops = dots.gradient?.colorStops;
    if (Array.isArray(stops) && stops[0]?.color) return stops[0].color;
    if (typeof dots.color === 'string') return dots.color;
  }
  if (design.dotsUseGradient && design.dotsGradientStart) return design.dotsGradientStart;
  if (typeof design.dotsColor === 'string') return design.dotsColor;
  return '#000000';
};

/**
 * Build `qr-code-styling` options from persisted `qrDesign` (campaign document) + encoded URL.
 * Used on campaign detail so preview matches wizard output for the same payload.
 */
export const buildStyledOptionsFromPersistedDesign = (design, encodedData, pixelSize = 256) => {
  const d = design && typeof design === 'object' ? design : {};
  const size = typeof pixelSize === 'number' && pixelSize > 0 ? pixelSize : 256;
  return {
    width: size,
    height: size,
    margin: d.margin ?? 6,
    type: 'svg',
    data: encodedData,
    qrOptions: { errorCorrectionLevel: 'Q' },
    dotsOptions: d.dotsOptions || { type: 'square', color: '#000000' },
    cornersSquareOptions: d.cornersSquareOptions || { type: 'square', color: '#000000' },
    cornersDotOptions: d.cornersDotOptions || { type: 'square', color: '#000000' },
    /* Omitted `backgroundOptions` in persisted payload means transparent (see buildQrDesignPayload). */
    backgroundOptions:
      d.backgroundOptions && typeof d.backgroundOptions.color === 'string'
        ? d.backgroundOptions
        : { color: 'transparent' },
    image: d.image || undefined,
    imageOptions: {
      hideBackgroundDots: Boolean(d.image),
      imageSize: 0.4,
      margin: 4,
      ...(d.imageOptions || {}),
    },
  };
};

/** Flat wizard `design` → nested options for `qr-code-styling`. */
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
 * True when `design` is already the persisted API shape (e.g. guest draft
 * saved at auth gate with nested dotsOptions). Step2 always calls this
 * builder — without this branch, flat-field reads are undefined and Zod
 * rejects missing dotsOptions.type on the server.
 */
const isPersistedQrDesignShape = (design) =>
  !!(
    design
    && typeof design.dotsOptions === 'object'
    && design.dotsOptions
    && typeof design.dotsOptions.type === 'string'
    && typeof design.cornersSquareOptions === 'object'
    && design.cornersSquareOptions
    && typeof design.cornersSquareOptions.type === 'string'
    && typeof design.cornersDotOptions === 'object'
    && design.cornersDotOptions
    && typeof design.cornersDotOptions.type === 'string'
  );

/**
 * When a guest draft is saved at the auth gate we store `design` as the API
 * payload (nested dotsOptions, etc.). Rehydrate that into the flat wizard
 * shape Step2DesignQr expects.
 */
export const hydrateWizardDesignFromDraft = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_DESIGN };
  }
  if (isPersistedQrDesignShape(raw)) {
    const dots = raw.dotsOptions;
    const stops = dots?.gradient?.colorStops;
    const hasGradient = Array.isArray(stops) && stops.length >= 2;
    return {
      ...DEFAULT_DESIGN,
      frame: raw.frame ?? DEFAULT_DESIGN.frame,
      frameCaption: raw.frameCaption ?? DEFAULT_DESIGN.frameCaption,
      dotsType: dots.type,
      dotsUseGradient: hasGradient,
      dotsGradientStart: hasGradient ? stops[0].color : DEFAULT_DESIGN.dotsGradientStart,
      dotsGradientEnd: hasGradient ? stops[1].color : DEFAULT_DESIGN.dotsGradientEnd,
      dotsColor: dots.color || DEFAULT_DESIGN.dotsColor,
      cornersSquareType: raw.cornersSquareOptions.type,
      cornersSquareColor: raw.cornersSquareOptions.color || DEFAULT_DESIGN.cornersSquareColor,
      cornersDotType: raw.cornersDotOptions.type,
      cornersDotColor: raw.cornersDotOptions.color || DEFAULT_DESIGN.cornersDotColor,
      backgroundTransparent: !raw.backgroundOptions,
      backgroundColor: raw.backgroundOptions?.color || DEFAULT_DESIGN.backgroundColor,
      logoDataUrl: typeof raw.image === 'string' && raw.image ? raw.image : '',
    };
  }
  return { ...DEFAULT_DESIGN, ...raw };
};

/**
 * Translate the wizard form into the slim qrDesign payload we persist on the
 * Campaign.  Mirrors the strict server-side schema in
 * server/src/validators/campaignValidators.js.
 */
export const buildQrDesignPayload = (design) => {
  if (isPersistedQrDesignShape(design)) {
    const payload = {
      width: design.width ?? 256,
      height: design.height ?? 256,
      margin: design.margin ?? 6,
      dotsOptions: design.dotsOptions,
      cornersSquareOptions: design.cornersSquareOptions,
      cornersDotOptions: design.cornersDotOptions,
      backgroundOptions: design.backgroundOptions,
      frame: design.frame,
      frameCaption: design.frameCaption || undefined,
      image: design.image,
      imageOptions: design.imageOptions,
    };
    return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
  }

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
