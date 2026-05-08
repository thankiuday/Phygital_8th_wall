/**
 * cardTemplates.js — design presets for the digital business card wizard.
 * Picking a template seeds the design state; the user can then tweak any
 * value without losing the others. Templates are intentionally a single
 * source of truth so the live preview and exported PNG can never drift.
 */

export const CARD_TEMPLATES = [
  {
    id: 'professional',
    label: 'Professional',
    colors: { primary: '#3b82f6', secondary: '#1d4ed8', background: '#030712' },
    font: 'Inter',
    layout: 'left-aligned',
    corners: 'rounded',
    spacing: 'normal',
    accent: 'Cool blues, dark canvas, business default.',
  },
  {
    id: 'creative',
    label: 'Creative',
    colors: { primary: '#f97316', secondary: '#ea580c', background: '#fff7ed' },
    font: 'Trebuchet MS',
    layout: 'cover',
    corners: 'rounded',
    spacing: 'relaxed',
    accent: 'Warm tangerine on cream with cover-style hero.',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    colors: { primary: '#0f172a', secondary: '#475569', background: '#ffffff' },
    font: 'Inter',
    layout: 'centered',
    corners: 'sharp',
    spacing: 'compact',
    accent: 'Neutral palette, tight rhythm, sharp edges.',
  },
  {
    id: 'bold',
    label: 'Bold',
    colors: { primary: '#ef4444', secondary: '#b91c1c', background: '#0a0a0a' },
    font: 'Verdana',
    layout: 'cover',
    corners: 'rounded',
    spacing: 'normal',
    accent: 'High-contrast red on near-black.',
  },
  {
    id: 'elegant',
    label: 'Elegant',
    colors: { primary: '#9333ea', secondary: '#6b21a8', background: '#1e1b4b' },
    font: 'Georgia',
    layout: 'centered',
    corners: 'rounded',
    spacing: 'relaxed',
    accent: 'Serif, plum + indigo, generous spacing.',
  },
  {
    id: 'dark',
    label: 'Dark',
    colors: { primary: '#22d3ee', secondary: '#0891b2', background: '#020617' },
    font: 'Inter',
    layout: 'left-aligned',
    corners: 'rounded',
    spacing: 'normal',
    accent: 'Cyan on midnight; reads great on phones at night.',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    colors: { primary: '#fb7185', secondary: '#f97316', background: '#1f0a36' },
    font: 'Trebuchet MS',
    layout: 'cover',
    corners: 'rounded',
    spacing: 'normal',
    accent: 'Pink-coral gradient over deep purple.',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    colors: { primary: '#06b6d4', secondary: '#0e7490', background: '#0c1424' },
    font: 'Inter',
    layout: 'left-aligned',
    corners: 'rounded',
    spacing: 'normal',
    accent: 'Teal on slate — calm, technical.',
  },
  {
    id: 'forest',
    label: 'Forest',
    colors: { primary: '#22c55e', secondary: '#15803d', background: '#0a1f12' },
    font: 'Inter',
    layout: 'centered',
    corners: 'rounded',
    spacing: 'normal',
    accent: 'Emerald accents on forest floor.',
  },
  {
    id: 'neon',
    label: 'Neon',
    colors: { primary: '#a3e635', secondary: '#65a30d', background: '#020617' },
    font: 'Verdana',
    layout: 'cover',
    corners: 'sharp',
    spacing: 'compact',
    accent: 'Acid lime — high signal, sharp corners.',
  },
  {
    id: 'rose',
    label: 'Rose',
    colors: { primary: '#f43f5e', secondary: '#9f1239', background: '#1c0710' },
    font: 'Georgia',
    layout: 'centered',
    corners: 'rounded',
    spacing: 'relaxed',
    accent: 'Rose serif on burgundy.',
  },
  {
    id: 'slate',
    label: 'Slate',
    colors: { primary: '#94a3b8', secondary: '#475569', background: '#0f172a' },
    font: 'Inter',
    layout: 'left-aligned',
    corners: 'rounded',
    spacing: 'normal',
    accent: 'Quiet grayscale with cool slate background.',
  },
];

export const TEMPLATE_BY_ID = Object.fromEntries(CARD_TEMPLATES.map((t) => [t.id, t]));

export const CARD_FONTS = ['Inter', 'Georgia', 'Trebuchet MS', 'Arial', 'Verdana'];
export const CARD_LAYOUTS = ['centered', 'left-aligned', 'cover'];
export const CARD_CORNERS = ['rounded', 'sharp'];
export const CARD_SPACING = ['compact', 'normal', 'relaxed'];

export const SECTION_TYPES = [
  { id: 'heading',      label: 'Heading' },
  { id: 'text',         label: 'Text Block' },
  { id: 'about',        label: 'About' },
  { id: 'imageGallery', label: 'Image Gallery' },
  { id: 'video',        label: 'Video' },
  { id: 'links',        label: 'Custom Links' },
  { id: 'testimonials', label: 'Testimonials' },
];

export const SOCIAL_PLATFORMS = [
  'instagram', 'linkedin', 'twitter', 'github', 'youtube', 'facebook', 'telegram',
];

export const QR_POSITIONS = [
  { id: 'top-left',     label: 'Top Left' },
  { id: 'top-right',    label: 'Top Right' },
  { id: 'top-center',   label: 'Top Center' },
  { id: 'bottom-left',  label: 'Bottom Left' },
  { id: 'bottom-right', label: 'Bottom Right' },
  { id: 'center',       label: 'Center' },
];

export const QR_THEMES = [
  { id: 'white', label: 'White', dark: '#000000', light: '#ffffff' },
  { id: 'black', label: 'Black', dark: '#ffffff', light: '#000000' },
  { id: 'neon',  label: 'Neon',  dark: '#a3e635', light: '#020617' },
];

export const DISPLAY_FIELDS = [
  { id: 'name',     label: 'Name' },
  { id: 'jobTitle', label: 'Job Title' },
  { id: 'company',  label: 'Company' },
  { id: 'phone',    label: 'Phone' },
  { id: 'email',    label: 'Email' },
  { id: 'website',  label: 'Website' },
  { id: 'address',  label: 'Address' },
  { id: 'tagline',  label: 'Tagline' },
];
