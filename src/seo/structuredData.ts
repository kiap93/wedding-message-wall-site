import { SEO_CONFIG } from './config';
import { BreadcrumbItem, StructuredDataType } from './metadata';

export function getOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'EventFrame',
    alternateName: 'EventFrame.io',
    url: SEO_CONFIG.productionDomain,
    logo: `${SEO_CONFIG.productionDomain}/favicon.png`,
    description: SEO_CONFIG.defaultDescription,
    contactPoint: {
      '@type': 'ContactPoint',
      email: SEO_CONFIG.contactEmail,
      contactType: 'customer support',
    },
  };
}

export function getWebSiteSchema(inLanguage: string = 'en-US') {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'EventFrame',
    url: SEO_CONFIG.productionDomain,
    description: SEO_CONFIG.defaultDescription,
    inLanguage,
  };
}

export function getSoftwareApplicationSchema(options?: {
  url?: string;
  description?: string;
  screenshot?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'EventFrame.io',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'All web browsers (iOS, Android, macOS, Windows)',
    url: options?.url || SEO_CONFIG.productionDomain,
    description:
      options?.description ||
      'All-in-one wedding planning software for couples, planners, and studios: wedding website builder, digital invitations, RSVP tracking, guest management, venue seating floor plans, and live reception displays.',
    screenshot: options?.screenshot || SEO_CONFIG.platformScreenshot,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: '5.00',
      availability: 'https://schema.org/InStock',
      description:
        'USD $5.00 one-time payment per wedding event for 12 months full access. Free agency account creation and unlimited draft design.',
    },
    featureList: [
      'Modular Wedding Website Builder',
      'Interactive Wedding Seating Chart & Venue Floor Plan Editor (meters & feet)',
      'Digital Wedding Invitations & Canvas Stationery Studio',
      'Conditional RSVP Questionnaires & Dietary Tracking',
      'Wedding Guest List Management & VIP Highlighting',
      'Live Ballroom Reception Photo Wall & Guestbook Moderation',
      'White-Label Agency Subdomains & Private Couple PIN Portals',
    ],
  };
}

export function getWebPageSchema(params: {
  title: string;
  description: string;
  url: string;
  inLanguage?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: params.title,
    description: params.description,
    url: params.url,
    inLanguage: params.inLanguage || 'en-US',
    isPartOf: {
      '@type': 'WebSite',
      name: 'EventFrame',
      url: SEO_CONFIG.productionDomain,
    },
  };
}

export function getBreadcrumbListSchema(items: BreadcrumbItem[], domain: string = SEO_CONFIG.productionDomain) {
  const baseDomain = domain.replace(/\/+$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.path.startsWith('http')
        ? item.path
        : item.path === '/'
          ? `${baseDomain}/`
          : `${baseDomain}${item.path}`,
    })),
  };
}

export function getArticleSchema(params: {
  title: string;
  description: string;
  url: string;
  image: string;
  publishedAt: string;
  updatedAt: string;
  authorName: string;
  inLanguage?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: params.title,
    description: params.description,
    image: [params.image],
    datePublished: params.publishedAt,
    dateModified: params.updatedAt,
    inLanguage: params.inLanguage || 'en-US',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': params.url,
    },
    author: {
      '@type': 'Organization',
      name: params.authorName,
      url: SEO_CONFIG.productionDomain,
    },
    publisher: {
      '@type': 'Organization',
      name: 'EventFrame',
      logo: {
        '@type': 'ImageObject',
        url: `${SEO_CONFIG.productionDomain}/favicon.png`,
      },
    },
  };
}

export function getWeddingEventSchema(params: {
  name: string;
  description: string;
  url: string;
  image?: string;
  startDate?: string;
  location?: string;
}) {
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: params.name,
    description: params.description,
    url: params.url,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  };

  if (params.startDate) {
    schema.startDate = params.startDate;
  }
  if (params.location) {
    schema.location = {
      '@type': 'Place',
      name: params.location,
      address: params.location,
    };
  }
  if (params.image) {
    schema.image = params.image;
  }

  return schema;
}

export function buildPageStructuredData(params: {
  type?: StructuredDataType;
  title: string;
  description: string;
  canonicalUrl: string;
  inLanguage?: string;
  breadcrumbs?: BreadcrumbItem[];
  customSchemas?: Record<string, any>[];
  noindex?: boolean;
}): Record<string, any>[] {
  if (params.customSchemas && params.customSchemas.length > 0) {
    return params.customSchemas;
  }

  if (params.noindex) {
    return [];
  }

  const schemas: Record<string, any>[] = [getOrganizationSchema()];

  if (params.type === 'SoftwareApplication') {
    schemas.push(
      getSoftwareApplicationSchema({
        url: params.canonicalUrl,
        description: params.description,
      })
    );
  } else if (params.type === 'WebSite') {
    schemas.push(getWebSiteSchema(params.inLanguage));
  }

  schemas.push(
    getWebPageSchema({
      title: params.title,
      description: params.description,
      url: params.canonicalUrl,
      inLanguage: params.inLanguage,
    })
  );

  if (params.breadcrumbs && params.breadcrumbs.length > 0) {
    schemas.push(getBreadcrumbListSchema(params.breadcrumbs));
  }

  return schemas;
}

export function getStructuredDataForType(type?: string) {
  return buildPageStructuredData({
    type: (type as StructuredDataType) || 'WebPage',
    title: SEO_CONFIG.defaultTitle,
    description: SEO_CONFIG.defaultDescription,
    canonicalUrl: `${SEO_CONFIG.productionDomain}/`,
  });
}
