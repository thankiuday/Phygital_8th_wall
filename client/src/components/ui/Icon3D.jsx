import React from 'react';

const ICON3D_PRESETS = Object.freeze({
  brand: 'brand',
  violet: 'violet',
  cyan: 'cyan',
  emerald: 'emerald',
  amber: 'amber',
  rose: 'rose',
  slate: 'slate',
});

/**
 * Icon3D
 * Shared elevated icon treatment used across the product UI.
 * Use this for all new "feature / card / nav" icon containers.
 */
const Icon3D = ({
  icon: Icon,
  size = 18,
  className = '',
  accent = ICON3D_PRESETS.brand,
  rounded = 'rounded-xl',
  muted = false,
}) => {
  const paletteToken = muted ? ICON3D_PRESETS.slate : accent;
  const isToken = Object.values(ICON3D_PRESETS).includes(paletteToken);
  const legacyClassGradient = !isToken ? String(paletteToken) : null;

  const tokenStyles = isToken
    ? {
      '--icon-c1': `var(--icon3d-${paletteToken}-1)`,
      '--icon-c2': `var(--icon3d-${paletteToken}-2)`,
      '--icon-c3': `var(--icon3d-${paletteToken}-3)`,
      '--icon-glow': `var(--icon3d-${paletteToken}-glow)`,
    }
    : {};

  return (
    <div className={`group/icon relative shrink-0 ${className}`} style={tokenStyles}>
      <div
        className={`absolute inset-0 translate-y-0.5 ${rounded} opacity-35 blur-[1px] ${legacyClassGradient ? `bg-gradient-to-br ${legacyClassGradient}` : ''}`}
        style={legacyClassGradient ? undefined : { backgroundImage: 'linear-gradient(135deg, var(--icon-c1), var(--icon-c2), var(--icon-c3))' }}
      />
      <div
        className={`relative flex h-full w-full items-center justify-center ${rounded} text-white ring-1 ring-white/25 transition-all duration-200 group-hover/icon:-translate-y-0.5 group-hover/icon:scale-[1.03] ${legacyClassGradient ? `bg-gradient-to-br ${legacyClassGradient}` : ''}`}
        style={legacyClassGradient ? undefined : {
          backgroundImage: 'linear-gradient(135deg, var(--icon-c1), var(--icon-c2), var(--icon-c3))',
          boxShadow: '0 10px 25px -10px var(--icon-glow)',
        }}
      >
        <div className={`absolute inset-[1px] ${rounded} bg-white/10`} />
        <div className="absolute inset-x-1.5 top-1 h-2 rounded-full bg-white/40 blur-[0.5px]" />
        <Icon size={size} className="relative drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]" />
      </div>
    </div>
  );
};

export { ICON3D_PRESETS };
export default Icon3D;
