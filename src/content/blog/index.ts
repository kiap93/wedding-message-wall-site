import { BLOG_POSTS } from './posts';
import { BLOG_TRANSLATIONS_ZH_CN } from './translations/zh-CN';
import { BLOG_TRANSLATIONS_ZH_TW } from './translations/zh-TW';
import { BLOG_TRANSLATIONS_MS } from './translations/ms';
import {
  BLOG_CATEGORY_LABELS,
  BLOG_UI_LABELS,
  getBlogCategoryLabel,
  getBlogUiLabels,
} from './locales';
import {
  BlogCategory,
  BlogLocale,
  BlogPost,
  LocalizedBlogPost,
  LocalizedBlogTranslation,
} from './types';

export * from './types';
export {
  BLOG_POSTS,
  BLOG_CATEGORY_LABELS,
  BLOG_UI_LABELS,
  getBlogCategoryLabel,
  getBlogUiLabels,
};

export const BLOG_CATEGORIES: BlogCategory[] = [
  'Invitations & Design',
  'RSVP & Guest Lists',
  'Seating & Floor Plans',
  'Wedding Websites',
  'Reception Experience',
  'Planner Operations',
];

export const BLOG_TRANSLATION_MAPS: Record<
  Exclude<BlogLocale, 'en'>,
  Record<string, LocalizedBlogTranslation>
> = {
  'zh-CN': BLOG_TRANSLATIONS_ZH_CN,
  'zh-TW': BLOG_TRANSLATIONS_ZH_TW,
  ms: BLOG_TRANSLATIONS_MS,
};

const LOCALE_PREFIXES: Record<BlogLocale, string> = {
  en: '',
  'zh-CN': '/zh-cn',
  'zh-TW': '/zh-tw',
  ms: '/ms',
};

export function normalizeBlogLocale(raw?: string | null): BlogLocale {
  if (!raw) return 'en';
  const cleaned = raw.trim().toLowerCase().replace(/_/g, '-');
  if (cleaned === 'zh-cn' || cleaned === 'zh-hans') return 'zh-CN';
  if (cleaned === 'zh-tw' || cleaned === 'zh-hant' || cleaned === 'zh-hk') return 'zh-TW';
  if (cleaned === 'ms' || cleaned === 'ms-my') return 'ms';
  return 'en';
}

function getBasePostId(post: BlogPost): string {
  return post.id || post.slug;
}

function isTranslationComplete(
  base: BlogPost,
  translation?: LocalizedBlogTranslation | null
): translation is LocalizedBlogTranslation {
  if (!translation) return false;
  if (
    !translation.slug?.trim() ||
    !translation.title?.trim() ||
    !translation.seoTitle?.trim() ||
    !translation.description?.trim() ||
    !translation.excerpt?.trim() ||
    !translation.categoryLabel?.trim() ||
    !translation.coverImageAlt?.trim()
  ) {
    return false;
  }
  if (!Array.isArray(translation.sections) || translation.sections.length !== base.sections.length) {
    return false;
  }
  for (let i = 0; i < base.sections.length; i++) {
    const baseSec = base.sections[i];
    const locSec = translation.sections[i];
    if (
      !locSec?.heading?.trim() ||
      !Array.isArray(locSec.paragraphs) ||
      locSec.paragraphs.length === 0
    ) {
      return false;
    }
    if (baseSec.bullets && baseSec.bullets.length > 0 && (!locSec.bullets || locSec.bullets.length === 0)) {
      return false;
    }
  }
  if (base.faqs.length > 0 && (!Array.isArray(translation.faqs) || translation.faqs.length !== base.faqs.length)) {
    return false;
  }
  return true;
}

export function getLocalizedSlugsForPost(base: BlogPost): Record<BlogLocale, string> {
  const id = getBasePostId(base);
  return {
    en: base.slug,
    'zh-CN': BLOG_TRANSLATIONS_ZH_CN[id]?.slug || base.slug,
    'zh-TW': BLOG_TRANSLATIONS_ZH_TW[id]?.slug || base.slug,
    ms: BLOG_TRANSLATIONS_MS[id]?.slug || base.slug,
  };
}

export function resolveLocalizedBlogPost(
  base: BlogPost,
  requestedLang: BlogLocale = 'en',
  translationOverride?: Record<string, LocalizedBlogTranslation> | null
): LocalizedBlogPost {
  const id = getBasePostId(base);
  const localizedSlugs = getLocalizedSlugsForPost(base);

  if (requestedLang === 'en') {
    return {
      ...base,
      id,
      categoryId: base.category,
      category: getBlogCategoryLabel(base.category, 'en'),
      requestedLanguage: 'en',
      resolvedLanguage: 'en',
      isFallback: false,
      localizedSlugs,
    };
  }

  const dict = translationOverride !== undefined ? translationOverride : BLOG_TRANSLATION_MAPS[requestedLang];
  const candidate = dict?.[id];

  if (!isTranslationComplete(base, candidate)) {
    // Explicit honest fallback to English without silently marking English prose as localized
    return {
      ...base,
      id,
      categoryId: base.category,
      category: getBlogCategoryLabel(base.category, 'en'),
      requestedLanguage: requestedLang,
      resolvedLanguage: 'en',
      isFallback: true,
      localizedSlugs,
    };
  }

  return {
    ...base,
    id,
    slug: candidate.slug,
    title: candidate.title,
    seoTitle: candidate.seoTitle,
    description: candidate.description,
    excerpt: candidate.excerpt,
    categoryId: base.category,
    category: candidate.categoryLabel || getBlogCategoryLabel(base.category, requestedLang),
    authorName: candidate.authorName || base.authorName,
    authorRole: candidate.authorRole || base.authorRole,
    coverImageAlt: candidate.coverImageAlt,
    keywords: candidate.keywords && candidate.keywords.length > 0 ? candidate.keywords : base.keywords,
    sections: candidate.sections,
    faqs: candidate.faqs,
    relatedToolLinks:
      candidate.relatedToolLinks && candidate.relatedToolLinks.length > 0
        ? candidate.relatedToolLinks
        : base.relatedToolLinks,
    requestedLanguage: requestedLang,
    resolvedLanguage: requestedLang,
    isFallback: false,
    localizedSlugs,
  };
}

function getSortedBasePosts(): BlogPost[] {
  return [...BLOG_POSTS].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getAllBlogPosts(lang: BlogLocale = 'en'): LocalizedBlogPost[] {
  const targetLang = normalizeBlogLocale(lang);
  return getSortedBasePosts().map((base) => resolveLocalizedBlogPost(base, targetLang));
}

export function findBaseBlogPost(slugOrId: string): BlogPost | undefined {
  if (!slugOrId) return undefined;
  const normalized = slugOrId.trim().toLowerCase();

  return BLOG_POSTS.find((post) => {
    const id = getBasePostId(post);
    if (id.toLowerCase() === normalized || post.slug.toLowerCase() === normalized) {
      return true;
    }
    const slugs = getLocalizedSlugsForPost(post);
    return Object.values(slugs).some((locSlug) => locSlug.toLowerCase() === normalized);
  });
}

export function getBlogPostById(id: string, lang: BlogLocale = 'en'): LocalizedBlogPost | undefined {
  const base = BLOG_POSTS.find((p) => getBasePostId(p) === id);
  if (!base) return undefined;
  return resolveLocalizedBlogPost(base, normalizeBlogLocale(lang));
}

export function getBlogPostBySlug(slug: string, lang: BlogLocale = 'en'): LocalizedBlogPost | undefined {
  const base = findBaseBlogPost(slug);
  if (!base) return undefined;
  return resolveLocalizedBlogPost(base, normalizeBlogLocale(lang));
}

export function buildBlogIndexPath(lang: BlogLocale = 'en'): string {
  const targetLang = normalizeBlogLocale(lang);
  const prefix = LOCALE_PREFIXES[targetLang];
  return prefix ? `${prefix}/blog` : '/blog';
}

export function buildBlogPostPath(slugOrId: string, lang: BlogLocale = 'en'): string {
  const targetLang = normalizeBlogLocale(lang);
  const base = findBaseBlogPost(slugOrId);
  if (!base) {
    const clean = slugOrId.replace(/^\/+/, '');
    const prefix = LOCALE_PREFIXES[targetLang];
    return prefix ? `${prefix}/blog/${clean}` : `/blog/${clean}`;
  }
  const slugs = getLocalizedSlugsForPost(base);
  const localizedSlug = slugs[targetLang] || base.slug;
  const prefix = LOCALE_PREFIXES[targetLang];
  return prefix ? `${prefix}/blog/${localizedSlug}` : `/blog/${localizedSlug}`;
}

export function buildBlogPostHreflangLinks(
  slugOrId: string,
  domain: string = 'https://eventframe.io'
): Array<{ hreflang: string; href: string }> {
  const cleanDomain = domain.replace(/\/+$/, '');
  const base = findBaseBlogPost(slugOrId);
  if (!base) return [];

  const id = getBasePostId(base);
  const langs: BlogLocale[] = ['en', 'zh-CN', 'zh-TW', 'ms'];
  const links: Array<{ hreflang: string; href: string }> = langs.map((code) => ({
    hreflang: code,
    href: `${cleanDomain}${buildBlogPostPath(id, code)}`,
  }));

  links.push({
    hreflang: 'x-default',
    href: `${cleanDomain}${buildBlogPostPath(id, 'en')}`,
  });

  return links;
}

export function getRelatedBlogPosts(
  post: BlogPost | LocalizedBlogPost,
  lang?: BlogLocale
): LocalizedBlogPost[] {
  const targetLang = lang
    ? normalizeBlogLocale(lang)
    : 'resolvedLanguage' in post
      ? post.resolvedLanguage
      : 'en';

  const currentId = 'id' in post && post.id ? post.id : post.slug;
  const explicit = post.relatedPostSlugs
    .map((slug) => getBlogPostBySlug(slug, targetLang))
    .filter((item): item is LocalizedBlogPost => Boolean(item) && item.id !== currentId);

  if (explicit.length >= 2) return explicit;

  const all = getAllBlogPosts(targetLang);
  const fallback = all.filter(
    (p) => p.id !== currentId && !explicit.some((e) => e.id === p.id)
  );
  return [...explicit, ...fallback].slice(0, 3);
}

export function getAdjacentBlogPosts(
  slugOrId: string,
  lang: BlogLocale = 'en'
): { prev: LocalizedBlogPost | null; next: LocalizedBlogPost | null } {
  const targetLang = normalizeBlogLocale(lang);
  const base = findBaseBlogPost(slugOrId);
  if (!base) return { prev: null, next: null };

  const id = getBasePostId(base);
  const all = getAllBlogPosts(targetLang);
  const index = all.findIndex((p) => p.id === id);
  if (index === -1) return { prev: null, next: null };

  return {
    prev: index > 0 ? all[index - 1] : null,
    next: index < all.length - 1 ? all[index + 1] : null,
  };
}
