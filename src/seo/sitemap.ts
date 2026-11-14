import { SEO_CONFIG } from './config';
import {
  MARKETING_HREFLANG_CODES,
  buildCanonicalUrl,
  buildLocalizedRoutePath,
  MarketingLanguageCode,
} from './canonical';
import { PUBLIC_SEO_ROUTES } from './routes';
import {
  buildBlogPostHreflangLinks,
  buildBlogPostPath,
  getAllBlogPosts,
} from '../content/blog';

export interface SitemapProjectRecord {
  slug?: string | null;
  updated_at?: string | null;
  website_published_at?: string | null;
  website_published_config?: any;
  website_config?: any;
  website_status?: string | null;
  access_password?: string | null;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseConfigSafe(raw: any): Record<string, any> | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    return raw;
  }
  return null;
}

/**
 * Determines whether a wedding project website should be indexed & listed in sitemap.xml.
 * Strictly excludes drafts, unpublished sites, password-protected sites, and sites with seo.noIndex === true.
 */
export function isWeddingProjectIndexable(project: SitemapProjectRecord): boolean {
  if (!project || !project.slug) return false;
  const trimmedSlug = String(project.slug).trim().toLowerCase();
  if (!trimmedSlug || trimmedSlug === 'demo') return false;
  if (project.website_status !== 'published') return false;
  if (project.access_password && String(project.access_password).trim().length > 0) {
    return false;
  }

  const publishedCfg = parseConfigSafe(project.website_published_config);
  const draftCfg = parseConfigSafe(project.website_config);
  const effectiveCfg = publishedCfg || draftCfg;

  if (effectiveCfg?.seo?.noIndex === true) {
    return false;
  }

  return true;
}

function formatLastMod(rawDate?: string | null, fallbackDate?: string): string {
  const candidate = rawDate || fallbackDate;
  if (!candidate) {
    return new Date().toISOString().split('T')[0];
  }
  const isoMatch = String(candidate).match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];
  const parsed = new Date(candidate);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

export interface BuildSitemapOptions {
  publishedProjects?: SitemapProjectRecord[];
  customDomain?: string | null;
  defaultLastMod?: string;
}

/**
 * Runtime-agnostic dynamic sitemap.xml generator shared identically between
 * Cloudflare Worker (`worker/index.ts`) and Express (`server.ts`).
 */
export function buildSitemapXml(options: BuildSitemapOptions = {}): string {
  const {
    publishedProjects = [],
    customDomain = SEO_CONFIG.productionDomain,
    defaultLastMod = '2026-11-12',
  } = options;

  const baseDomain = (customDomain || SEO_CONFIG.productionDomain).replace(/\/+$/, '');
  const seenLocs = new Set<string>();
  const urlBlocks: string[] = [];

  const appendUrl = (params: {
    loc: string;
    lastmod?: string;
    changefreq: string;
    priority: string;
    alternates?: Array<{ hreflang: string; href: string }>;
  }) => {
    if (seenLocs.has(params.loc)) return;
    seenLocs.add(params.loc);

    const lines: string[] = [
      '  <url>',
      `    <loc>${escapeXml(params.loc)}</loc>`,
    ];
    if (params.lastmod) {
      lines.push(`    <lastmod>${escapeXml(params.lastmod)}</lastmod>`);
    }
    lines.push(`    <changefreq>${escapeXml(params.changefreq)}</changefreq>`);
    lines.push(`    <priority>${escapeXml(params.priority)}</priority>`);

    if (params.alternates && params.alternates.length > 0) {
      for (const alt of params.alternates) {
        lines.push(
          `    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.hreflang)}" href="${escapeXml(alt.href)}" />`
        );
      }
    }

    lines.push('  </url>');
    urlBlocks.push(lines.join('\n'));
  };

  // 1. Public Marketing Routes (+ Clean Localized Prefixes for Multilingual SEO)
  for (const [routePath, meta] of Object.entries(PUBLIC_SEO_ROUTES)) {
    if (meta.includeInSitemap === false || meta.noindex) continue;

    const priority = (meta.priority ?? 0.8).toFixed(1);
    const changefreq = meta.changefreq || 'weekly';

    if (meta.isLocalizedMarketing) {
      const alternates = [
        ...MARKETING_HREFLANG_CODES.map((code) => ({
          hreflang: code,
          href: buildCanonicalUrl(buildLocalizedRoutePath(routePath, code), undefined, baseDomain),
        })),
        {
          hreflang: 'x-default',
          href: buildCanonicalUrl(routePath, undefined, baseDomain),
        },
      ];

      for (const code of MARKETING_HREFLANG_CODES) {
        const localizedPath = buildLocalizedRoutePath(routePath, code as MarketingLanguageCode);
        const loc = buildCanonicalUrl(localizedPath, undefined, baseDomain);
        appendUrl({
          loc,
          lastmod: defaultLastMod,
          changefreq,
          priority: code === 'en' ? priority : Math.max(0.5, (meta.priority ?? 0.8) - 0.1).toFixed(1),
          alternates,
        });
      }
    } else {
      const loc = buildCanonicalUrl(routePath, undefined, baseDomain);
      appendUrl({
        loc,
        lastmod: defaultLastMod,
        changefreq,
        priority,
      });
    }
  }

  // 2. Editorial Blog Articles (+ Localized Variants & Hreflang Alternates)
  for (const basePost of getAllBlogPosts('en')) {
    const alternates = buildBlogPostHreflangLinks(basePost.id, baseDomain);
    for (const code of MARKETING_HREFLANG_CODES) {
      const localizedPath = buildBlogPostPath(basePost.id, code as MarketingLanguageCode);
      const loc = buildCanonicalUrl(localizedPath, undefined, baseDomain);
      appendUrl({
        loc,
        lastmod: formatLastMod(basePost.updatedAt || basePost.publishedAt, defaultLastMod),
        changefreq: 'monthly',
        priority: code === 'en' ? '0.7' : '0.6',
        alternates,
      });
    }
  }

  // 3. Published, Public, Indexable Couple Wedding Websites
  for (const project of publishedProjects) {
    if (!isWeddingProjectIndexable(project)) continue;
    const encodedSlug = encodeURIComponent(String(project.slug).trim());
    const loc = `${baseDomain}/${encodedSlug}/website`;
    const lastmod = formatLastMod(project.website_published_at || project.updated_at, defaultLastMod);
    appendUrl({
      loc,
      lastmod,
      changefreq: 'weekly',
      priority: '0.7',
    });
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urlBlocks,
    '</urlset>',
  ].join('\n');
}
