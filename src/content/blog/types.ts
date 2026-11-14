export type BlogLocale = 'en' | 'zh-CN' | 'zh-TW' | 'ms';

export type BlogCategory =
  | 'Invitations & Design'
  | 'RSVP & Guest Lists'
  | 'Seating & Floor Plans'
  | 'Wedding Websites'
  | 'Reception Experience'
  | 'Planner Operations';

export interface BlogSection {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  callout?: string;
}

export interface BlogFaq {
  q: string;
  a: string;
}

export interface BlogToolLink {
  href: string;
  label: string;
  desc: string;
}

export interface BlogPost {
  id?: string;
  slug: string;
  title: string;
  seoTitle: string;
  description: string;
  excerpt: string;
  category: BlogCategory;
  publishedAt: string; // YYYY-MM-DD
  updatedAt: string; // YYYY-MM-DD
  readingTimeMinutes: number;
  authorName: string;
  authorRole: string;
  coverImage: string;
  coverImageWidth: number;
  coverImageHeight: number;
  coverImageAlt: string;
  keywords: string[];
  sections: BlogSection[];
  faqs: BlogFaq[];
  relatedToolLinks: BlogToolLink[];
  relatedPostSlugs: string[];
}

export interface LocalizedBlogTranslation {
  slug: string;
  title: string;
  seoTitle: string;
  description: string;
  excerpt: string;
  categoryLabel: string;
  authorName: string;
  authorRole: string;
  coverImageAlt: string;
  keywords: string[];
  sections: BlogSection[];
  faqs: BlogFaq[];
  relatedToolLinks: BlogToolLink[];
}

export interface LocalizedBlogPost extends Omit<BlogPost, 'category' | 'id'> {
  id: string;
  categoryId: BlogCategory;
  category: string;
  requestedLanguage: BlogLocale;
  resolvedLanguage: BlogLocale;
  isFallback: boolean;
  localizedSlugs: Record<BlogLocale, string>;
}

export interface BlogUiLabels {
  journalBadge: string;
  indexTitle: string;
  indexSubtitle: string;
  readFullGuide: string;
  readArticle: string;
  allGuides: string;
  minReadSuffix: string;
  updatedPrefix: string;
  homeBreadcrumb: string;
  journalBreadcrumb: string;
  faqHeading: string;
  builtIntoEyebrow: string;
  practiceHeading: string;
  createFreeDraftCta: string;
  allGuidesCta: string;
  relatedReadingHeading: string;
  previousArticleLabel: string;
  nextArticleLabel: string;
  notFoundTitle: string;
  notFoundSeoTitle: string;
  notFoundSeoDescription: string;
  notFoundDescription: string;
  notFoundCta: string;
  fallbackNotice: string;
}
