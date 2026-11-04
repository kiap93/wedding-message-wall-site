// Centralized SEO Configuration for EventFrame.io

export const SEO_CONFIG = {
  siteName: 'EventFrame.io',
  productionDomain: 'https://eventframe.io',
  defaultLocale: 'en_US',
  defaultTitle: 'EventFrame.io — Luxury Wedding Platform for Agencies & Couples',
  titleTemplate: '%s | EventFrame',
  defaultDescription: 'The editorial software platform for modern wedding studios and planners. Bespoke digital stationery suites, real-time live guest moderation, and custom RSVP questionnaires.',
  defaultOgImage: 'https://eventframe.io/assets/hero_wedding_editorial_1793501242401-Cpx_tB6X.jpg',
  defaultOgImageAlt: 'EventFrame — Luxury Wedding Stationery, Live Displays, and RSVP Software',
  twitterCard: 'summary_large_image' as const,
  twitterSite: '@eventframe',
  contactEmail: 'contact@eventframe.io',
  businessType: 'SoftwareApplication' as const,
  category: 'Wedding Planning Software',
};

export type SEOConfig = typeof SEO_CONFIG;
