import { RouteMetadata } from './metadata';
import { SEO_CONFIG } from './config';
import { normalizePathname } from './canonical';

export const PUBLIC_SEO_ROUTES: Record<string, RouteMetadata> = {
  '/': {
    title: 'Wedding Planning & Digital Stationery Platform for Studios | EventFrame',
    description: 'The editorial software platform for modern wedding studios and planners. Bespoke digital stationery suites, real-time live guest moderation, and custom RSVP questionnaires.',
    canonicalPath: '/',
    includeInSitemap: true,
    priority: 1.0,
    changefreq: 'weekly',
    ogType: 'website',
    ogImage: SEO_CONFIG.defaultOgImage,
    ogImageAlt: 'EventFrame — Editorial Wedding Software Platform',
    twitterCard: 'summary_large_image',
    structuredDataType: 'SoftwareApplication',
  },
  '/templates': {
    title: 'Wedding Display Themes & Invitation Suite Catalog | EventFrame',
    description: 'Explore curated wedding display themes and typography suites for live venue projectors, digital guestbooks, and luxury wedding stationery.',
    canonicalPath: '/templates',
    includeInSitemap: true,
    priority: 0.8,
    changefreq: 'weekly',
    ogType: 'website',
    ogImage: SEO_CONFIG.defaultOgImage,
    ogImageAlt: 'Curated Wedding Display Themes & Invitation Suites',
    twitterCard: 'summary_large_image',
    structuredDataType: 'WebSite',
  },
  '/pricing': {
    title: 'EventFrame Pricing — Plans for Wedding Studios & Couples',
    description: 'Simple, transparent pricing for luxury wedding studios and couples. Unlimited wedding invitations, live reception displays, and custom RSVP questionnaires.',
    canonicalPath: '/pricing',
    includeInSitemap: true,
    priority: 0.8,
    changefreq: 'monthly',
    ogType: 'website',
    ogImage: SEO_CONFIG.defaultOgImage,
    ogImageAlt: 'EventFrame Transparent Pricing Plans',
    twitterCard: 'summary_large_image',
    structuredDataType: 'SoftwareApplication',
  },
  '/wedding-planner-software': {
    title: 'Wedding Planner Software for Modern Studios | EventFrame',
    description: 'All-in-one wedding software for studios and planners. Coordinate digital invitations, custom RSVP questionnaires, guest moderation, and live reception displays.',
    canonicalPath: '/wedding-planner-software',
    includeInSitemap: true,
    priority: 0.9,
    changefreq: 'weekly',
    ogType: 'website',
    ogImage: SEO_CONFIG.defaultOgImage,
    ogImageAlt: 'Wedding Planner Software for Modern Studios',
    twitterCard: 'summary_large_image',
    structuredDataType: 'SoftwareApplication',
  },
  '/white-label-wedding-software': {
    title: 'White Label Wedding Software for Agencies | EventFrame',
    description: 'Offer branded digital wedding suites under your studio name. Custom agency subdomains, personalized couple portals, and bespoke digital stationery.',
    canonicalPath: '/white-label-wedding-software',
    includeInSitemap: true,
    priority: 0.9,
    changefreq: 'weekly',
    ogType: 'website',
    ogImage: SEO_CONFIG.defaultOgImage,
    ogImageAlt: 'White Label Wedding Software for Agencies',
    twitterCard: 'summary_large_image',
    structuredDataType: 'SoftwareApplication',
  },
  '/digital-wedding-invitations': {
    title: 'Digital Wedding Invitations & Designs | EventFrame',
    description: 'Design editorial digital wedding invitations with precision typography, responsive mobile previews, and seamless online RSVP collection.',
    canonicalPath: '/digital-wedding-invitations',
    includeInSitemap: true,
    priority: 0.9,
    changefreq: 'weekly',
    ogType: 'website',
    ogImage: SEO_CONFIG.defaultOgImage,
    ogImageAlt: 'Digital Wedding Invitations & Stationery Designs',
    twitterCard: 'summary_large_image',
    structuredDataType: 'WebSite',
  },
  '/wedding-rsvp-management': {
    title: 'Wedding RSVP Management Made Simple | EventFrame',
    description: 'Streamline wedding attendance tracking with custom questionnaire fields, dietary preferences, real-time submission metrics, and instant CSV export.',
    canonicalPath: '/wedding-rsvp-management',
    includeInSitemap: true,
    priority: 0.9,
    changefreq: 'weekly',
    ogType: 'website',
    ogImage: SEO_CONFIG.defaultOgImage,
    ogImageAlt: 'Wedding RSVP Management and Attendance Tracking',
    twitterCard: 'summary_large_image',
    structuredDataType: 'SoftwareApplication',
  },
  '/wedding-guest-management': {
    title: 'Wedding Guest Management Software | EventFrame',
    description: 'Bring guest list coordination, RSVP tracking, contact info, and live photo/message moderation together in one unified wedding portal.',
    canonicalPath: '/wedding-guest-management',
    includeInSitemap: true,
    priority: 0.9,
    changefreq: 'weekly',
    ogType: 'website',
    ogImage: SEO_CONFIG.defaultOgImage,
    ogImageAlt: 'Wedding Guest Management Software and Moderation',
    twitterCard: 'summary_large_image',
    structuredDataType: 'SoftwareApplication',
  },
  '/wedding-reception-display': {
    title: 'Wedding Reception Displays & Guest Experiences | EventFrame',
    description: 'Transform venue ballrooms with live projected guest photo walls, warm wishes, dynamic QR code sharing, and curated aesthetic themes.',
    canonicalPath: '/wedding-reception-display',
    includeInSitemap: true,
    priority: 0.9,
    changefreq: 'weekly',
    ogType: 'website',
    ogImage: SEO_CONFIG.defaultOgImage,
    ogImageAlt: 'Wedding Reception Displays and Guest Experiences',
    twitterCard: 'summary_large_image',
    structuredDataType: 'SoftwareApplication',
  },
  '/subscription': {
    title: 'EventFrame Pricing — Plans for Wedding Studios & Couples',
    description: 'Simple, transparent pricing for luxury wedding studios and couples. Unlimited wedding invitations, live reception displays, and custom RSVP questionnaires.',
    canonicalPath: '/pricing', // Canonicalized to clean /pricing URL
    includeInSitemap: false,
    ogType: 'website',
    ogImage: SEO_CONFIG.defaultOgImage,
    twitterCard: 'summary_large_image',
    structuredDataType: 'SoftwareApplication',
  },
};

// Private route patterns (Strictly marked noindex, nofollow)
export const PRIVATE_ROUTE_PATTERNS = [
  /^\/login/,
  /^\/verify/,
  /^\/reset-password/,
  /^\/onboarding/,
  /^\/workspace/,
  /^\/editor(\/.*)?$/,
  /^\/templates\/manage/,
  /^\/couple(\/.*)?$/,
  /^\/api(\/.*)?$/,
];

/**
 * Resolves SEO metadata for a given path.
 * If private or dynamic event page, automatically enforces noindex.
 */
export function getRouteMetadata(pathname: string): RouteMetadata {
  const normalized = normalizePathname(pathname);

  // 1. Direct match in public routes table
  if (PUBLIC_SEO_ROUTES[normalized]) {
    return PUBLIC_SEO_ROUTES[normalized];
  }

  // 2. Check private route patterns
  for (const pattern of PRIVATE_ROUTE_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        title: `Studio Portal | ${SEO_CONFIG.siteName}`,
        description: 'Secure authentication and management portal for EventFrame.',
        canonicalPath: normalized,
        noindex: true,
        nofollow: true,
        includeInSitemap: false,
      };
    }
  }

  // 3. Dynamic wedding event routes (e.g. /:slug, /:slug/display, /:slug/guest, /:slug/rsvp, /:slug/invitation)
  // Protected with noindex by default to preserve wedding couple and guest privacy
  const isEventSubpath = normalized.endsWith('/display') || 
                        normalized.endsWith('/guest') || 
                        normalized.endsWith('/rsvp') || 
                        normalized.endsWith('/invitation') || 
                        normalized.endsWith('/dashboard');
  
  if (isEventSubpath || (normalized !== '/' && !normalized.includes('.'))) {
    const slug = normalized.split('/')[1] || 'event';
    const sub = normalized.split('/')[2] || 'display';
    const subTitle = sub === 'guest' ? 'Guestbook' : sub === 'rsvp' ? 'RSVP' : sub === 'invitation' ? 'Invitation' : 'Wedding Celebration';

    return {
      title: `${subTitle} | ${SEO_CONFIG.siteName}`,
      description: 'Private celebration portal on EventFrame.',
      canonicalPath: normalized,
      noindex: true,
      nofollow: true,
      includeInSitemap: false,
    };
  }

  // Fallback for any unknown route
  return {
    title: SEO_CONFIG.defaultTitle,
    description: SEO_CONFIG.defaultDescription,
    canonicalPath: normalized,
    noindex: true,
    includeInSitemap: false,
  };
}
