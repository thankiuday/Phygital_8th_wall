import React, { useMemo } from 'react';
import {
  Phone,
  Mail,
  MessageCircle,
  Globe,
  Send,
  ExternalLink,
} from 'lucide-react';

import { TEMPLATE_BY_ID } from './cardTemplates';

/**
 * BusinessCardLivePreview — single source of truth for rendering a digital
 * business card. Used in:
 *
 *   • The wizard's right-side preview (every step).
 *   • The public `/card/:slug` page.
 *   • The Puppeteer-driven `/print/card/:id` page (with `mode="print"`).
 *
 * Keeping every render path on this one component is what makes WYSIWYG
 * actually true — what the user designs IS what scans, and IS what prints.
 *
 * Props
 *   content   — `cardContent` shape from the draft / API.
 *   design    — `cardDesign`  shape.
 *   mode      — 'preview' (default), 'public', or 'print'. `print` removes
 *               interactive affordances (no buttons that look hoverable).
 *   onAction  — optional callback (action, target?) — wired for telemetry on
 *               the public page; left undefined in the wizard preview.
 *   className — extra utility classes.
 */
const BusinessCardLivePreview = ({
  content = {},
  design = {},
  mode = 'preview',
  onAction,
  className = '',
}) => {
  const tpl = TEMPLATE_BY_ID[design?.template] || TEMPLATE_BY_ID.professional;
  const colors = design?.colors || tpl.colors;
  const font = design?.font || tpl.font;
  const layout = design?.layout || tpl.layout;
  const corners = design?.corners || tpl.corners;
  const spacing = design?.spacing || tpl.spacing;

  const radius = corners === 'sharp' ? '0px' : '20px';
  const innerRadius = corners === 'sharp' ? '0px' : '14px';

  const spacingMap = useMemo(
    () => ({
      compact: { padding: '20px', gap: '14px', sectionGap: '18px' },
      normal:  { padding: '28px', gap: '20px', sectionGap: '24px' },
      relaxed: { padding: '36px', gap: '28px', sectionGap: '32px' },
    }),
    []
  );
  const spacingTokens = spacingMap[spacing] || spacingMap.normal;

  const profileUrl = content?.profileImagePreview || content?.profileImageUrl || null;
  const bannerUrl = content?.bannerImagePreview || content?.bannerImageUrl || null;

  const fire = (action, target) => {
    if (typeof onAction === 'function') onAction(action, target);
  };

  /* ── HEADER (varies by layout) ─────────────────────────────── */
  const HeaderCentered = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
      {bannerUrl && (
        <div
          style={{
            width: '100%',
            height: '120px',
            borderRadius: innerRadius,
            backgroundImage: `url(${bannerUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
      <Avatar />
      <Identity />
    </div>
  );

  const HeaderLeftAligned = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <Avatar size={84} />
      <Identity />
    </div>
  );

  const HeaderCover = () => (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          width: '100%',
          height: '160px',
          borderRadius: innerRadius,
          backgroundImage: bannerUrl
            ? `url(${bannerUrl})`
            : `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div
        style={{
          marginTop: '-40px',
          padding: `0 ${spacingTokens.padding}`,
          display: 'flex',
          alignItems: 'flex-end',
          gap: '14px',
        }}
      >
        <Avatar size={84} ring />
        <div style={{ paddingBottom: '8px' }}>
          <Identity />
        </div>
      </div>
    </div>
  );

  function Avatar({ size = 88, ring = false }) {
    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: corners === 'sharp' ? '0' : '50%',
          backgroundColor: '#1f2937',
          backgroundImage: profileUrl ? `url(${profileUrl})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: ring ? `4px solid ${colors.background}` : 'none',
          boxShadow: ring ? '0 4px 14px rgba(0,0,0,0.45)' : 'none',
          flexShrink: 0,
        }}
      />
    );
  }

  function Identity() {
    return (
      <div>
        <div style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1.15 }}>
          {content.fullName || 'Your Name'}
        </div>
        {content.jobTitle && (
          <div style={{ fontSize: '14px', opacity: 0.85 }}>{content.jobTitle}</div>
        )}
        {content.company && (
          <div style={{ fontSize: '13px', opacity: 0.7, marginTop: '2px' }}>
            {content.company}
          </div>
        )}
      </div>
    );
  }

  /* ── ACTION BUTTONS ────────────────────────────────────────── */
  const PrimaryActions = () => {
    const actions = [];
    const c = content.contact || {};
    if (c.phone) actions.push({ key: 'call', label: 'Call', Icon: Phone, href: `tel:${c.phone}` });
    if (c.email) actions.push({ key: 'email', label: 'Email', Icon: Mail, href: `mailto:${c.email}` });
    if (c.whatsapp) {
      const wa = String(c.whatsapp).replace(/\D/g, '');
      actions.push({ key: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle, href: `https://wa.me/${wa}` });
    }
    if (c.website) actions.push({ key: 'website', label: 'Website', Icon: Globe, href: c.website });
    if (!actions.length) return null;

    return (
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {actions.map((a) => {
          const Tag = mode === 'print' ? 'div' : 'a';
          const props = mode === 'print'
            ? {}
            : { href: a.href, target: '_blank', rel: 'noopener noreferrer', onClick: () => fire(a.key) };
          return (
            <Tag
              key={a.key}
              {...props}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '999px',
                backgroundColor: colors.primary,
                color: '#fff',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              <a.Icon size={16} />
              {a.label}
            </Tag>
          );
        })}
      </div>
    );
  };

  /* ── SOCIAL ROW ────────────────────────────────────────────── */
  const SOCIAL_ICONS = {
    instagram: Globe,
    linkedin: Globe,
    twitter: Globe,
    github: Globe,
    youtube: Globe,
    facebook: Globe,
    telegram: Send,
  };

  const SocialRow = () => {
    const s = content.social || {};
    const items = Object.entries(s).filter(([, url]) => !!url);
    if (!items.length) return null;
    return (
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {items.map(([platform, url]) => {
          const Icon = SOCIAL_ICONS[platform] || ExternalLink;
          const Tag = mode === 'print' ? 'div' : 'a';
          const props = mode === 'print'
            ? {}
            : { href: url, target: '_blank', rel: 'noopener noreferrer', onClick: () => fire('social', platform) };
          return (
            <Tag
              key={platform}
              {...props}
              style={{
                width: '36px', height: '36px',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.08)',
                color: colors.primary,
                textDecoration: 'none',
              }}
            >
              <Icon size={18} />
            </Tag>
          );
        })}
      </div>
    );
  };

  /* ── DYNAMIC SECTIONS ──────────────────────────────────────── */
  const Sections = () => {
    if (!Array.isArray(content.sections) || !content.sections.length) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacingTokens.sectionGap }}>
        {content.sections.map((sec) => (
          <Section key={sec.id} sec={sec} />
        ))}
      </div>
    );
  };

  const Section = ({ sec }) => {
    if (sec.type === 'heading') {
      return <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>{sec.text || 'Heading'}</h3>;
    }
    if (sec.type === 'text' || sec.type === 'about') {
      return (
        <div>
          {sec.title && <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.8, marginBottom: '6px' }}>{sec.title}</div>}
          <p style={{ fontSize: '14px', lineHeight: 1.6, margin: 0, opacity: 0.9 }}>
            {sec.body || sec.text || ''}
          </p>
        </div>
      );
    }
    if (sec.type === 'imageGallery') {
      const imgs = Array.isArray(sec.images) ? sec.images : [];
      if (!imgs.length) return null;
      return (
        <div>
          {sec.title && <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.8, marginBottom: '8px' }}>{sec.title}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>
            {imgs.map((img, i) => (
              <div
                key={img.publicId || img.url || i}
                onClick={() => fire('galleryView', String(i))}
                style={{
                  aspectRatio: '1 / 1',
                  borderRadius: innerRadius,
                  backgroundImage: `url(${img.url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  cursor: mode === 'print' ? 'default' : 'zoom-in',
                }}
              />
            ))}
          </div>
        </div>
      );
    }
    if (sec.type === 'video') {
      const src = sec.embedSrc || sec.externalVideoUrl || sec.videoUrl || sec.url;
      if (!src) return null;
      return (
        <div>
          {sec.title && <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.8, marginBottom: '8px' }}>{sec.title}</div>}
          {sec.embedSrc ? (
            <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
              <iframe
                title={sec.title || 'video'}
                src={src}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  border: 0,
                  borderRadius: innerRadius,
                }}
                onLoad={() => fire('videoPlay', sec.id)}
              />
            </div>
          ) : (
            <video
              src={src}
              controls
              playsInline
              style={{ width: '100%', borderRadius: innerRadius, display: 'block' }}
              onPlay={() => fire('videoPlay', sec.id)}
            />
          )}
        </div>
      );
    }
    if (sec.type === 'links') {
      const items = Array.isArray(sec.items) ? sec.items : [];
      if (!items.length) return null;
      return (
        <div>
          {sec.title && <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.8, marginBottom: '8px' }}>{sec.title}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map((it, i) => {
              const Tag = mode === 'print' ? 'div' : 'a';
              const props = mode === 'print'
                ? {}
                : { href: it.url, target: '_blank', rel: 'noopener noreferrer', onClick: () => fire('cta', it.label || `link-${i}`) };
              return (
                <Tag
                  key={i}
                  {...props}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: innerRadius,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'inherit', textDecoration: 'none',
                    fontSize: '14px',
                  }}
                >
                  <span>{it.label || it.url}</span>
                  <ExternalLink size={14} />
                </Tag>
              );
            })}
          </div>
        </div>
      );
    }
    if (sec.type === 'testimonials') {
      const items = Array.isArray(sec.items) ? sec.items : [];
      if (!items.length) return null;
      return (
        <div>
          {sec.title && <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.8, marginBottom: '8px' }}>{sec.title}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {items.map((t, i) => (
              <blockquote
                key={i}
                style={{
                  margin: 0, padding: '14px 16px',
                  borderRadius: innerRadius,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderLeft: `3px solid ${colors.primary}`,
                  fontSize: '14px',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontStyle: 'italic', opacity: 0.9 }}>“{t.quote}”</div>
                {(t.author || t.role) && (
                  <div style={{ marginTop: '6px', fontSize: '12px', opacity: 0.7 }}>
                    {t.author}{t.role ? ` · ${t.role}` : ''}
                  </div>
                )}
              </blockquote>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  /* ── COMPOSITION ───────────────────────────────────────────── */
  const Header = layout === 'cover'
    ? HeaderCover
    : layout === 'left-aligned'
      ? HeaderLeftAligned
      : HeaderCentered;

  return (
    <div
      className={className}
      style={{
        fontFamily: `${font}, -apple-system, system-ui, sans-serif`,
        background: colors.background,
        color: '#f5f7fb',
        borderRadius: radius,
        boxShadow: mode === 'print' ? 'none' : '0 12px 32px rgba(2, 6, 23, 0.45)',
        padding: layout === 'cover' ? `0 0 ${spacingTokens.padding} 0` : spacingTokens.padding,
        display: 'flex',
        flexDirection: 'column',
        gap: spacingTokens.gap,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <Header />
      {content.bio && (
        <p style={{ fontSize: '14px', lineHeight: 1.6, margin: 0, opacity: 0.9, padding: layout === 'cover' ? `0 ${spacingTokens.padding}` : 0 }}>
          {content.bio}
        </p>
      )}
      <div style={{ padding: layout === 'cover' ? `0 ${spacingTokens.padding}` : 0, display: 'flex', flexDirection: 'column', gap: spacingTokens.gap }}>
        <PrimaryActions />
        <SocialRow />
        <Sections />
      </div>
    </div>
  );
};

export default BusinessCardLivePreview;
