import { RouteMetadata } from './metadata';
import { SEO_CONFIG } from './config';
import {
  extractLocaleFromPathname,
  isBlogArticlePath,
  normalizePathname,
  MarketingLanguageCode,
} from './canonical';
import {
  buildBlogIndexPath,
  buildBlogPostPath,
  getBlogPostBySlug,
  getBlogUiLabels,
} from '../content/blog';

export const PUBLIC_SEO_ROUTES: Record<string, RouteMetadata> = {
  '/': {
    title: 'Wedding Planning Software & All-in-One Wedding Platform | EventFrame',
    description:
      'All-in-one wedding planning software for couples, planners, and studios. Create wedding websites, digital invitations, RSVP forms, guest lists, seating charts, and live reception displays.',
    canonicalPath: '/',
    includeInSitemap: true,
    isLocalizedMarketing: true,
    priority: 1.0,
    changefreq: 'weekly',
    ogType: 'website',
    ogImage: SEO_CONFIG.defaultOgImage,
    ogImageAlt: SEO_CONFIG.defaultOgImageAlt,
    twitterCard: 'summary_large_image',
    structuredDataType: 'SoftwareApplication',
    breadcrumbs: [{ name: 'Home', path: '/' }],
  },
  '/wedding-website-builder': {
    title: 'Wedding Website Builder for Couples & Planners | EventFrame',
    description:
      'Build luxury custom wedding websites with modular story, schedule, venue map, gallery, RSVP, and live wish wall sections. Full mobile preview and search privacy controls.',
    canonicalPath: '/wedding-website-builder',
    includeInSitemap: true,
    isLocalizedMarketing: true,
    priority: 0.9,
    changefreq: 'weekly',
    ogType: 'website',
    ogImage: 'https://eventframe.io/images/seo/wedding-website-builder-studio.webp',
    ogImageAlt: 'EventFrame Wedding Website Builder Studio Interface',
    twitterCard: 'summary_large_image',
    structuredDataType: 'SoftwareApplication',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Wedding Website Builder', path: '/wedding-website-builder' },
    ],
  },
  '/wedding-seating-chart': {
    title: 'Wedding Seating Chart & Venue Hall Layout Planner | EventFrame',
    description:
      'Design real-scale wedding venue floor plans in meters or feet, arrange round and head tables, assign guests and households by seat, and sync dietary preferences.',
    canonicalPath: '/wedding-seating-chart',
    includeInSitemap: true,
    isLocalizedMarketing: true,
    priority: 0.9,
    changefreq: 'weekly',
    ogType: 'website',
    ogImage: 'https://eventframe.io/images/seo/wedding-seating-chart-floor-plan.webp',
    ogImageAlt: 'EventFrame Interactive Wedding Seating Chart and Venue Layout Planner',
    twitterCard: 'summary_large_image',
    structuredDataType: 'SoftwareApplication',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Wedding Seating Chart', path: '/wedding-seating-chart' },
    ],
  },
  '/wedding-planner-software': {
    title: 'Wedding Planner Software for Modern Studios | EventFrame',
    description:
      'All-in-one wedding software for studios and planners. Coordinate websites, digital invitations, seating floor plans, custom RSVP questionnaires, and live reception displays.',
    canonicalPath: '/wedding-planner-software',
    includeInSitemap: true,
    isLocalizedMarketing: true,
    priority: 0.9,
    changefreq: 'weekly',
    ogType: 'website',
    ogImage: 'https://eventframe.io/images/seo/wedding-management-workspace-dashboard.webp',
    ogImageAlt: 'Wedding Planner Software Workspace and Multi-Client Dashboard',
    twitterCard: 'summary_large_image',
    structuredDataType: 'SoftwareApplication',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Wedding Planner Software', path: '/wedding-planner-software' },
    ],
  },
  '/white-label-wedding-software': {
    title: 'White Label Wedding Software for Agencies | EventFrame',
    description:
      'Offer branded digital wedding suites under your studio name. Custom agency subdomains, private couple PIN portals, bespoke websites, and digital stationery.',
    canonicalPath: '/white-label-wedding-software',
    includeInSitemap: true,
    isLocalizedMarketing: true,
    priority: 0.9,
    changefreq: 'weekly',
    ogType: 'website',
    ogImage: SEO_CONFIG.defaultOgImage,
    ogImageAlt: 'White Label Wedding Software for Agencies',
    twitterCard: 'summary_large_image',
    structuredDataType: 'SoftwareApplication',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'White-Label Software', path: '/white-label-wedding-software' },
    ],
  },
  '/digital-wedding-invitations': {
    title: 'Digital Wedding Invitations & Stationery Studio | EventFrame',
    description:
      'Design editorial digital wedding invitations with precision typography, responsive mobile previews, venue directions, and integrated online RSVP collection.',
    canonicalPath: '/digital-wedding-invitations',
    includeInSitemap: true,
    isLocalizedMarketing: true,
    priority: 0.9,
    changefreq: 'weekly',
    ogType: 'website',
    ogImage: 'https://eventframe.io/images/seo/digital-wedding-invitations-stationery.webp',
    ogImageAlt: 'Digital Wedding Invitations and Stationery Studio',
    twitterCard: 'summary_large_image',
    structuredDataType: 'SoftwareApplication',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Digital Wedding Invitations', path: '/digital-wedding-invitations' },
    ],
  },
  '/wedding-rsvp-management': {
    title: 'Wedding RSVP Management & Dietary Tracking | EventFrame',
    description:
      'Streamline wedding attendance tracking with conditional questionnaire fields, meal preferences, household headcounts, real-time submission metrics, and instant CSV export.',
    canonicalPath: '/wedding-rsvp-management',
    includeInSitemap: true,
    isLocalizedMarketing: true,
    priority: 0.9,
    changefreq: 'weekly',
    ogType: 'website',
    ogImage: 'https://eventframe.io/images/seo/wedding-management-workspace-dashboard.webp',
    ogImageAlt: 'Wedding RSVP Management and Attendance Tracking',
    twitterCard: 'summary_large_image',
    structuredDataType: 'SoftwareApplication',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Wedding RSVP Management', path: '/wedding-rsvp-management' },
    ],
  },
  '/wedding-guest-management': {
    title: 'Wedding Guest List & Moderation Software | EventFrame',
    description:
      'Bring guest list coordination, VIP tagging, household grouping, RSVP tracking, and live photo/message moderation together in one unified wedding portal.',
    canonicalPath: '/wedding-guest-management',
    includeInSitemap: true,
    isLocalizedMarketing: true,
    priority: 0.9,
    changefreq: 'weekly',
    ogType: 'website',
    ogImage: 'https://eventframe.io/images/seo/wedding-management-workspace-dashboard.webp',
    ogImageAlt: 'Wedding Guest Management Software and Moderation',
    twitterCard: 'summary_large_image',
    structuredDataType: 'SoftwareApplication',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Wedding Guest Management', path: '/wedding-guest-management' },
    ],
  },
  '/wedding-reception-display': {
    title: 'Wedding Reception Displays & Live Photo Wall | EventFrame',
    description:
      'Transform venue ballrooms with live projected guest photo walls, warm wishes, priority guest highlights, dynamic QR code sharing, and curated aesthetic themes.',
    canonicalPath: '/wedding-reception-display',
    includeInSitemap: true,
    isLocalizedMarketing: true,
    priority: 0.9,
    changefreq: 'weekly',
    ogType: 'website',
    ogImage: 'https://eventframe.io/images/seo/wedding-reception-live-display.webp',
    ogImageAlt: 'Wedding Reception Displays and Live Guest Photo Wall',
    twitterCard: 'summary_large_image',
    structuredDataType: 'SoftwareApplication',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Wedding Reception Display', path: '/wedding-reception-display' },
    ],
  },
  '/templates': {
    title: 'Wedding Display Themes & Invitation Suite Catalog | EventFrame',
    description:
      'Explore curated wedding display themes and typography suites for live venue projectors, digital guestbooks, wedding websites, and luxury wedding stationery.',
    canonicalPath: '/templates',
    includeInSitemap: true,
    isLocalizedMarketing: true,
    priority: 0.8,
    changefreq: 'weekly',
    ogType: 'website',
    ogImage: SEO_CONFIG.defaultOgImage,
    ogImageAlt: 'Curated Wedding Display Themes & Invitation Suites',
    twitterCard: 'summary_large_image',
    structuredDataType: 'WebSite',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Themes & Suites', path: '/templates' },
    ],
  },
  '/pricing': {
    title: 'EventFrame Pricing — $5 USD Pay-Per-Event Wedding Licensing',
    description:
      'Transparent $5.00 USD one-time pay-per-event pricing with 12 months full access. Zero monthly subscriptions. Includes wedding website builder, invitations, RSVPs, seating chart & live wall.',
    canonicalPath: '/pricing',
    includeInSitemap: true,
    isLocalizedMarketing: true,
    priority: 0.85,
    changefreq: 'monthly',
    ogType: 'website',
    ogImage: SEO_CONFIG.defaultOgImage,
    ogImageAlt: 'EventFrame $5 USD Pay-Per-Event Wedding Pricing',
    twitterCard: 'summary_large_image',
    structuredDataType: 'SoftwareApplication',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Pricing', path: '/pricing' },
    ],
  },
  '/blog': {
    title: 'Wedding Planning Journal, Guides & Studio Playbooks | EventFrame',
    description:
      'Practical guides on digital wedding invitations, RSVP automation, wedding seating charts, reception guestbooks, and studio operations for modern couples and planners.',
    canonicalPath: '/blog',
    includeInSitemap: true,
    isLocalizedMarketing: true,
    priority: 0.8,
    changefreq: 'weekly',
    ogType: 'website',
    ogImage: SEO_CONFIG.defaultOgImage,
    ogImageAlt: 'EventFrame Wedding Planning Journal and Editorial Guides',
    twitterCard: 'summary_large_image',
    structuredDataType: 'WebPage',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Blog', path: '/blog' },
    ],
  },
};

// Private or billing-internal route patterns (Strictly marked noindex, nofollow)
export const PRIVATE_ROUTE_PATTERNS = [
  /^\/login/,
  /^\/verify/,
  /^\/reset-password/,
  /^\/onboarding/,
  /^\/workspace/,
  /^\/editor(\/.*)?$/,
  /^\/website-studio(\/.*)?$/,
  /^\/templates\/manage/,
  /^\/couple(\/.*)?$/,
  /^\/subscription(\/.*)?$/,
  /^\/api(\/.*)?$/,
];

export interface ResolvedRouteWithLocale {
  meta: RouteMetadata;
  lang: MarketingLanguageCode;
  basePath: string;
}

/**
 * Resolves SEO metadata + detected URL locale for any pathname.
 */
export function resolveRouteMetadata(pathname: string): ResolvedRouteWithLocale {
  const normalized = normalizePathname(pathname);
  const { lang, basePath } = extractLocaleFromPathname(normalized);

  // 1. Direct match in public marketing routes (supports localized prefixes /zh-cn, /zh-tw, /ms)
  if (PUBLIC_SEO_ROUTES[basePath]) {
    const baseMeta = PUBLIC_SEO_ROUTES[basePath];
    return {
      meta: {
        ...baseMeta,
        canonicalPath: lang === 'en' ? baseMeta.canonicalPath : normalized,
      },
      lang,
      basePath,
    };
  }

  // 2. Blog article dynamic routes: /blog/:slug, /zh-cn/blog/:slug, /zh-tw/blog/:slug, /ms/blog/:slug, /en/blog/:slug
  if (isBlogArticlePath(basePath)) {
    const slug = basePath.slice('/blog/'.length);
    const post = getBlogPostBySlug(slug, lang);
    const uiLabels = getBlogUiLabels(post ? post.resolvedLanguage : lang);
    if (post) {
      const resolvedLang = post.resolvedLanguage;
      const localizedArticlePath = buildBlogPostPath(post.id, resolvedLang);
      const localizedBlogPath = buildBlogIndexPath(resolvedLang);
      const localizedHomePath =
        resolvedLang === 'en' ? '/' : `/${resolvedLang.toLowerCase()}`;

      return {
        meta: {
          title: post.seoTitle,
          description: post.description,
          canonicalPath: localizedArticlePath,
          includeInSitemap: true,
          isLocalizedMarketing: true,
          ogType: 'article',
          ogImage: post.coverImage.startsWith('http')
            ? post.coverImage
            : `${SEO_CONFIG.productionDomain}${post.coverImage}`,
          ogImageAlt: post.coverImageAlt,
          twitterCard: 'summary_large_image',
          keywords: post.keywords,
          structuredDataType: 'Article',
          publishedTime: post.publishedAt,
          modifiedTime: post.updatedAt,
          authorName: post.authorName,
          breadcrumbs: [
            { name: uiLabels.homeBreadcrumb, path: localizedHomePath },
            { name: uiLabels.journalBreadcrumb, path: localizedBlogPath },
            { name: post.title, path: localizedArticlePath },
          ],
        },
        lang: resolvedLang,
        basePath: `/blog/${post.slug}`,
      };
    }

    return {
      meta: {
        title: uiLabels.notFoundSeoTitle,
        description: uiLabels.notFoundSeoDescription,
        canonicalPath: buildBlogIndexPath(lang),
        noindex: true,
        nofollow: true,
        includeInSitemap: false,
      },
      lang,
      basePath: normalized,
    };
  }

  // 3. Private workspace / studio / auth / subscription routes
  for (const pattern of PRIVATE_ROUTE_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        meta: {
          title: `Studio Portal | ${SEO_CONFIG.siteName}`,
          description: 'Secure authentication and management portal for EventFrame.',
          canonicalPath: normalized,
          noindex: true,
          nofollow: true,
          includeInSitemap: false,
        },
        lang: 'en',
        basePath: normalized,
      };
    }
  }

  // 4. Wedding celebration routes
  // Note: /:slug/website starts safely as noindex until WeddingWebsite resolves published && public && !seo.noIndex.
  const isEventSubpath =
    normalized.endsWith('/display') ||
    normalized.endsWith('/guest') ||
    normalized.endsWith('/rsvp') ||
    normalized.endsWith('/invitation') ||
    normalized.endsWith('/dashboard') ||
    normalized.endsWith('/website') ||
    normalized === '/guest' ||
    normalized === '/rsvp' ||
    normalized === '/display';

  if (isEventSubpath || (normalized !== '/' && !normalized.includes('.'))) {
    const sub = normalized.split('/')[2] || normalized.split('/')[1] || 'display';
    const subTitle =
      sub === 'guest'
        ? 'Guestbook'
        : sub === 'rsvp'
          ? 'RSVP'
          : sub === 'invitation'
            ? 'Invitation'
            : sub === 'website'
              ? 'Wedding Website'
              : 'Wedding Celebration';

    return {
      meta: {
        title: `${subTitle} | ${SEO_CONFIG.siteName}`,
        description: 'Wedding celebration experience on EventFrame.',
        canonicalPath: normalized,
        noindex: true,
        nofollow: true,
        includeInSitemap: false,
      },
      lang: 'en',
      basePath: normalized,
    };
  }

  return {
    meta: {
      title: SEO_CONFIG.defaultTitle,
      description: SEO_CONFIG.defaultDescription,
      canonicalPath: normalized,
      noindex: true,
      includeInSitemap: false,
    },
    lang: 'en',
    basePath: normalized,
  };
}

export function getRouteMetadata(pathname: string): RouteMetadata {
  return resolveRouteMetadata(pathname).meta;
}
