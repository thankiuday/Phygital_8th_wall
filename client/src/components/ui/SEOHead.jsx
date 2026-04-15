import { Helmet } from 'react-helmet-async';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'Phygital8ThWall';
const APP_URL  = import.meta.env.VITE_APP_URL  || 'https://phygital8thwall.com';
const OG_IMAGE = `${APP_URL}/og-image.png`;

/**
 * SEOHead — sets page title, meta description, Open Graph, and Twitter Card tags.
 *
 * Props:
 *   title       {string}  Page title (appended with " | Phygital8ThWall")
 *   description {string}  Meta description (max ~160 chars)
 *   image       {string}  OG image URL (defaults to global og-image.png)
 *   url         {string}  Canonical URL (defaults to APP_URL)
 *   type        {string}  OG type — 'website' | 'article' (default: 'website')
 *   noIndex     {boolean} Set true for dashboard/admin pages
 */
const SEOHead = ({
  title,
  description = 'Create AR business card experiences in minutes. Upload your card, add a video, and share your augmented reality hologram.',
  image   = OG_IMAGE,
  url     = APP_URL,
  type    = 'website',
  noIndex = false,
}) => {
  const fullTitle = title ? `${title} | ${APP_NAME}` : `${APP_NAME} — AR Business Card Platform`;

  return (
    <Helmet>
      {/* ── Primary ────────────────────────────────────────────────── */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* ── Open Graph ─────────────────────────────────────────────── */}
      <meta property="og:type"        content={type} />
      <meta property="og:title"       content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image"       content={image} />
      <meta property="og:url"         content={url} />
      <meta property="og:site_name"   content={APP_NAME} />

      {/* ── Twitter Card ───────────────────────────────────────────── */}
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:title"       content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image"       content={image} />
    </Helmet>
  );
};

export default SEOHead;
