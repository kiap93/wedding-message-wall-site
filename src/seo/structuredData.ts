import { SEO_CONFIG } from './config';

export function getOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'EventFrame',
    alternateName: 'EventFrame.io',
    url: SEO_CONFIG.productionDomain,
    logo: `${SEO_CONFIG.productionDomain}/favicon.png`,
    description: SEO_CONFIG.defaultDescription,
    sameAs: [
      'https://twitter.com/eventframe',
    ],
  };
}

export function getWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'EventFrame',
    url: SEO_CONFIG.productionDomain,
    description: SEO_CONFIG.defaultDescription,
    inLanguage: 'en-US',
  };
}

export function getSoftwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'EventFrame.io',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'All web browsers (iOS, Android, macOS, Windows)',
    url: SEO_CONFIG.productionDomain,
    description: 'The editorial software platform for modern wedding studios and planners. Bespoke digital stationery suites, real-time live guest moderation, and custom RSVP questionnaires.',
    screenshot: SEO_CONFIG.defaultOgImage,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: '5.00',
      description: 'USD $5.00 one-time payment for 12 months full wedding event access. Free agency registration.',
    },
    featureList: [
      'White-label agency subdomains',
      'Real-time live guest moderation',
      'Custom conditional RSVP questionnaires',
      'Digital wedding stationery editor',
      'Curated venue projector display aesthetics'
    ]
  };
}

export function getStructuredDataForType(type?: string) {
  if (type === 'SoftwareApplication') {
    return [getOrganizationSchema(), getSoftwareApplicationSchema()];
  }
  if (type === 'WebSite') {
    return [getOrganizationSchema(), getWebSiteSchema()];
  }
  return [getOrganizationSchema()];
}
