'use strict';

/** Matches redirect slug issued by nanoid (and wizard preview placeholder). */
const SLUG_RE = /^[A-Za-z0-9_-]{6,16}$/;

module.exports = { SLUG_RE };
