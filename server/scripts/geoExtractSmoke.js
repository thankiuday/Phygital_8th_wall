'use strict';

/**
 * Offline smoke check for HTTP geo provider JSON shapes (CI-friendly).
 * Run: node scripts/geoExtractSmoke.js
 */

const assert = require('assert');
const path = require('path');
const { extractGeoFieldsFromProviderJson } = require(path.join(__dirname, '../src/utils/geoLookup'));

const fixtures = [
  {
    name: 'flat root',
    payload: { success: true, country: 'Germany', region: 'BE', city: 'Berlin', latitude: 52.5, longitude: 13.4 },
    expect: { country: 'Germany', region: 'BE', city: 'Berlin', latitude: 52.5, longitude: 13.4 },
  },
  {
    name: 'nested data',
    payload: {
      success: true,
      data: { country: 'France', region: 'IDF', city: 'Paris', latitude: 48.86, longitude: 2.35 },
    },
    expect: { country: 'France', region: 'IDF', city: 'Paris', latitude: 48.86, longitude: 2.35 },
  },
  {
    name: 'data.geoLocation',
    payload: {
      success: true,
      data: {
        geoLocation: { country: 'Japan', region: 'Tokyo', city: 'Shibuya', latitude: 35.66, longitude: 139.7 },
      },
    },
    expect: { country: 'Japan', region: 'Tokyo', city: 'Shibuya', latitude: 35.66, longitude: 139.7 },
  },
  {
    name: 'failure flag',
    payload: { success: false, message: 'bad' },
    expect: null,
  },
];

for (const { name, payload, expect } of fixtures) {
  const got = extractGeoFieldsFromProviderJson(payload);
  assert.deepStrictEqual(got, expect, name);
}

// eslint-disable-next-line no-console -- CLI smoke script
console.log('geoExtractSmoke: OK (%d cases)', fixtures.length);
