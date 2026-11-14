// Centralized SEO Configuration for EventFrame.io

export const SEO_CONFIG = {
  siteName: 'EventFrame.io',
  productionDomain: 'https://eventframe.io',
  defaultLocale: 'en_US',
  defaultTitle: 'EventFrame — All-in-One Wedding Management Platform & Planning Software',
  titleTemplate: '%s | EventFrame',
  defaultDescription:
    'All-in-one wedding planning software for couples, planners, and studios. Build custom wedding websites, digital invitations, RSVP tracking, guest lists, seating charts, and live reception displays.',
  defaultOgImage: 'https://eventframe.io/images/seo/og-eventframe.jpg',
  defaultOgImageWidth: 1200,
  defaultOgImageHeight: 630,
  defaultOgImageAlt:
    'EventFrame — All-in-One Wedding Website Builder, Seating Chart, RSVP, and Reception Software',
  platformScreenshot: 'https://eventframe.io/images/seo/eventframe-wedding-platform-showcase.webp',
  twitterCard: 'summary_large_image' as const,
  twitterSite: '@eventframe',
  contactEmail: 'contact@eventframe.io',
  businessType: 'SoftwareApplication' as const,
  category: 'Wedding Planning Software',
};

export type SEOConfig = typeof SEO_CONFIG;
