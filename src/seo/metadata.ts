export type StructuredDataType =
  | 'SoftwareApplication'
  | 'WebSite'
  | 'Organization'
  | 'WebPage'
  | 'Article'
  | 'Event';

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export interface RouteMetadata {
  title: string;
  description: string;
  canonicalPath: string;
  noindex?: boolean;
  nofollow?: boolean;
  ogType?: 'website' | 'article';
  ogImage?: string;
  ogImageAlt?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  keywords?: string[];
  includeInSitemap?: boolean;
  isLocalizedMarketing?: boolean;
  priority?: number;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  structuredDataType?: StructuredDataType;
  breadcrumbs?: BreadcrumbItem[];
  publishedTime?: string;
  modifiedTime?: string;
  authorName?: string;
}

export interface ResolvedSEO {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  ogImage: string;
  ogImageAlt: string;
  ogType: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  jsonLd?: Record<string, any>[];
}
