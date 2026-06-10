/**
 * AR hologram base effects — mirrors the server enum on Campaign.arEffect
 * and the ar-engine effect factory names.
 */
export const AR_EFFECT_OPTIONS = [
  {
    value: 'none',
    label: 'None',
    description: 'Pure hologram video, no base effect.',
  },
  {
    value: 'portal-rings',
    label: 'Portal Rings',
    description: 'Concentric glowing rings rotating under the video.',
  },
  {
    value: 'light-pillar',
    label: 'Light Pillar',
    description: 'Soft beam of light rising behind the hologram.',
  },
  {
    value: 'sparkles',
    label: 'Sparkles',
    description: 'Particles drifting up from the card surface.',
  },
  {
    value: 'energy-spiral',
    label: 'Energy Spiral',
    description: 'Ascending ring stack with a beam-up feel.',
  },
  {
    value: 'pulse-glow',
    label: 'Pulse Glow',
    description: 'Breathing glow with expanding shockwaves.',
  },
  {
    value: 'ember-rise',
    label: 'Ember Rise',
    description: 'Warm golden embers drifting up from the surface.',
  },
  {
    value: 'rune-circle',
    label: 'Rune Circle',
    description: 'Violet magic circle with counter-rotating rings.',
  },
  {
    value: 'orbit-orbs',
    label: 'Orbit Orbs',
    description: 'Colorful glowing orbs circling the hologram base.',
  },
];

export const arEffectLabel = (value) =>
  AR_EFFECT_OPTIONS.find((o) => o.value === value)?.label || 'None';
