'use strict';

/**
 * Matches redirect slug stored on campaigns.
 * Canonical length is 8; legacy AR create briefly used default nanoid (~21 chars).
 */
const SLUG_RE = /^[A-Za-z0-9_-]{6,24}$/;

module.exports = { SLUG_RE };
