import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter, Routes, Route } from 'react-router-dom';

import { SEO_CONFIG } from '../src/seo/config.ts';
import { resolveRouteMetadata } from '../src/seo/routes.ts';
import {
  buildCanonicalUrl,
  buildLocalizedRoutePath,
  buildMarketingHreflangLinks,
  LOCALIZED_MARKETING_BASE_PATHS,
  MARKETING_HREFLANG_CODES,
  MarketingLanguageCode,
} from '../src/seo/canonical.ts';
import {
  buildPageStructuredData,
  getArticleSchema,
  getBreadcrumbListSchema,
  getOrganizationSchema,
} from '../src/seo/structuredData.ts';
import { buildSitemapXml } from '../src/seo/sitemap.ts';
import {
  buildBlogIndexPath,
  buildBlogPostHreflangLinks,
  buildBlogPostPath,
  getAllBlogPosts,
  getBlogUiLabels,
  LocalizedBlogPost,
} from '../src/content/blog/index.ts';
import {
  MarketingTranslationProvider,
  translateMarketing,
} from '../src/lib/i18n/MarketingTranslationContext.tsx';
import { OG_LOCALES, SEOProvider } from '../src/components/SEO.tsx';

// Eagerly rendered marketing and blog components
import Home from '../src/pages/Home.tsx';
import TemplateSelector from '../src/pages/TemplateSelector.tsx';
import PricingPage from '../src/pages/PricingPage.tsx';
import WeddingWebsiteBuilder from '../src/pages/marketing/WeddingWebsiteBuilder.tsx';
import WeddingSeatingChart from '../src/pages/marketing/WeddingSeatingChart.tsx';
import WeddingPlannerSoftware from '../src/pages/marketing/WeddingPlannerSoftware.tsx';
import WhiteLabelWeddingSoftware from '../src/pages/marketing/WhiteLabelWeddingSoftware.tsx';
import DigitalWeddingInvitations from '../src/pages/marketing/DigitalWeddingInvitations.tsx';
import WeddingRsvpManagement from '../src/pages/marketing/WeddingRsvpManagement.tsx';
import WeddingGuestManagement from '../src/pages/marketing/WeddingGuestManagement.tsx';
import WeddingReceptionDisplay from '../src/pages/marketing/WeddingReceptionDisplay.tsx';
import BlogIndexPage from '../src/pages/blog/BlogIndexPage.tsx';
import BlogPostPage from '../src/pages/blog/BlogPostPage.tsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function serializeJsonLd(schemas: Record<string, any>[]): string {
  return JSON.stringify(schemas).replace(/</g, '\\u003c');
}

function renderMarketingRoutes(prefix: string = '') {
  const routes: Array<{ path: string; el: React.ReactElement }> = [
    { path: prefix || '/', el: React.createElement(Home) },
    { path: `${prefix}/templates`, el: React.createElement(TemplateSelector) },
    { path: `${prefix}/pricing`, el: React.createElement(PricingPage) },
    { path: `${prefix}/blog`, el: React.createElement(BlogIndexPage) },
    { path: `${prefix}/blog/:slug`, el: React.createElement(BlogPostPage) },
    { path: `${prefix}/wedding-website-builder`, el: React.createElement(WeddingWebsiteBuilder) },
    { path: `${prefix}/wedding-seating-chart`, el: React.createElement(WeddingSeatingChart) },
    { path: `${prefix}/wedding-planner-software`, el: React.createElement(WeddingPlannerSoftware) },
    { path: `${prefix}/white-label-wedding-software`, el: React.createElement(WhiteLabelWeddingSoftware) },
    { path: `${prefix}/digital-wedding-invitations`, el: React.createElement(DigitalWeddingInvitations) },
    { path: `${prefix}/wedding-rsvp-management`, el: React.createElement(WeddingRsvpManagement) },
    { path: `${prefix}/wedding-guest-management`, el: React.createElement(WeddingGuestManagement) },
    { path: `${prefix}/wedding-reception-display`, el: React.createElement(WeddingReceptionDisplay) },
  ];

  return routes.map((r) =>
    React.createElement(Route, { key: r.path, path: r.path, element: r.el })
  );
}

function renderPageHtml(requestPath: string, lang: MarketingLanguageCode): string {
  const routesEl = React.createElement(
    Routes,
    null,
    ...renderMarketingRoutes(''),
    ...renderMarketingRoutes('/en'),
    ...renderMarketingRoutes('/zh-cn'),
    ...renderMarketingRoutes('/zh-tw'),
    ...renderMarketingRoutes('/ms')
  );

  const appElement = React.createElement(
    StaticRouter,
    { location: requestPath },
    React.createElement(MarketingTranslationProvider, {
      initialLanguage: lang,
      children: React.createElement(SEOProvider, { children: routesEl }),
    })
  );

  return renderToString(appElement);
}

interface PrerenderTarget {
  routePath: string;
  basePath: string;
  lang: MarketingLanguageCode;
  isLocalizedMarketing: boolean;
  blogPost?: LocalizedBlogPost;
}

function buildHtmlDocument(baseHtml: string, target: PrerenderTarget): string {
  const { routePath, basePath, lang, isLocalizedMarketing, blogPost } = target;
  const resolved = resolveRouteMetadata(routePath);
  const routeMeta = resolved.meta;
  const effectiveLang = blogPost ? blogPost.resolvedLanguage : lang;

  let title = blogPost ? blogPost.seoTitle : routeMeta.title || SEO_CONFIG.defaultTitle;
  let description = blogPost
    ? blogPost.description
    : routeMeta.description || SEO_CONFIG.defaultDescription;

  if (isLocalizedMarketing && !blogPost) {
    const titleKey = `seo.routes.${basePath}.title`;
    const descKey = `seo.routes.${basePath}.description`;
    const translatedTitle = translateMarketing(titleKey, effectiveLang);
    const translatedDesc = translateMarketing(descKey, effectiveLang);
    if (translatedTitle !== titleKey) title = translatedTitle;
    if (translatedDesc !== descKey) description = translatedDesc;
  }

  const canonicalUrl = buildCanonicalUrl(routeMeta.canonicalPath || routePath);
  const ogImage = routeMeta.ogImage || SEO_CONFIG.defaultOgImage;
  const ogImageAlt = blogPost
    ? blogPost.coverImageAlt
    : routeMeta.ogImageAlt || SEO_CONFIG.defaultOgImageAlt;
  const ogLocale = OG_LOCALES[effectiveLang] || SEO_CONFIG.defaultLocale;
  const inLanguage = ogLocale.replace('_', '-');

  const alternateLinks = blogPost
    ? buildBlogPostHreflangLinks(blogPost.id, SEO_CONFIG.productionDomain)
    : isLocalizedMarketing
      ? buildMarketingHreflangLinks(basePath)
      : [];

  const hreflangTags = alternateLinks
    .map(
      ({ hreflang, href }) =>
        `    <link rel="alternate" hreflang="${escapeHtmlAttr(hreflang)}" href="${escapeHtmlAttr(href)}" data-ef-marketing-hreflang="true" />`
    )
    .join('\n');

  const uiLabels = getBlogUiLabels(effectiveLang);
  const localizedHomePath = effectiveLang === 'en' ? '/' : `/${effectiveLang.toLowerCase()}`;
  const localizedBlogIndexPath = buildBlogIndexPath(effectiveLang);

  const customSchemas = blogPost
    ? [
        getOrganizationSchema(),
        getArticleSchema({
          title: blogPost.title,
          description: blogPost.description,
          url: canonicalUrl,
          image: ogImage,
          publishedAt: blogPost.publishedAt,
          updatedAt: blogPost.updatedAt,
          authorName: blogPost.authorName,
          inLanguage,
        }),
        getBreadcrumbListSchema([
          { name: uiLabels.homeBreadcrumb, path: localizedHomePath },
          { name: uiLabels.journalBreadcrumb, path: localizedBlogIndexPath },
          { name: blogPost.title, path: buildBlogPostPath(blogPost.id, effectiveLang) },
        ]),
      ]
    : undefined;

  const schemas = buildPageStructuredData({
    type: routeMeta.structuredDataType,
    title,
    description,
    canonicalUrl,
    inLanguage,
    breadcrumbs: routeMeta.breadcrumbs,
    customSchemas,
    noindex: Boolean(routeMeta.noindex),
  });

  const keywordsTag =
    routeMeta.keywords && routeMeta.keywords.length > 0
      ? `\n    <meta name="keywords" content="${escapeHtmlAttr(routeMeta.keywords.join(', '))}" />`
      : '';

  const metaTags = `
    <meta name="description" content="${escapeHtmlAttr(description)}" />${keywordsTag}
    <link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />
${hreflangTags ? `${hreflangTags}\n` : ''}    <meta name="robots" content="${routeMeta.noindex ? 'noindex, nofollow' : 'index, follow'}" />
    <meta property="og:title" content="${escapeHtmlAttr(title)}" />
    <meta property="og:description" content="${escapeHtmlAttr(description)}" />
    <meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />
    <meta property="og:type" content="${escapeHtmlAttr(routeMeta.ogType || 'website')}" />
    <meta property="og:locale" content="${escapeHtmlAttr(ogLocale)}" />
    <meta property="og:site_name" content="${escapeHtmlAttr(SEO_CONFIG.siteName)}" />
    <meta property="og:image" content="${escapeHtmlAttr(ogImage)}" />
    <meta property="og:image:alt" content="${escapeHtmlAttr(ogImageAlt)}" />
    <meta name="twitter:card" content="${escapeHtmlAttr(routeMeta.twitterCard || SEO_CONFIG.twitterCard)}" />
    <meta name="twitter:title" content="${escapeHtmlAttr(title)}" />
    <meta name="twitter:description" content="${escapeHtmlAttr(description)}" />
    <meta name="twitter:image" content="${escapeHtmlAttr(ogImage)}" />
    <meta name="twitter:site" content="${escapeHtmlAttr(SEO_CONFIG.twitterSite)}" />
    <script id="eventframe-schema-jsonld" type="application/ld+json">${serializeJsonLd(schemas)}</script>
  `;

  let html = baseHtml;

  // Set <html lang="...">
  html = html.replace(/<html\s+lang="[^"]*"/i, `<html lang="${escapeHtmlAttr(effectiveLang)}"`);

  // Strip any fallback meta/canonical/alternate/title/jsonld tags before injecting exact single tags
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtmlAttr(title)}</title>`);
  html = html.replace(/<meta\s+name="description"[\s\S]*?>/gi, '');
  html = html.replace(/<meta\s+name="keywords"[\s\S]*?>/gi, '');
  html = html.replace(/<meta\s+name="robots"[\s\S]*?>/gi, '');
  html = html.replace(/<meta\s+property="og:[\s\S]*?>/gi, '');
  html = html.replace(/<meta\s+name="twitter:[\s\S]*?>/gi, '');
  html = html.replace(/<link\s+rel="canonical"[\s\S]*?>/gi, '');
  html = html.replace(/<link\s+rel="alternate"[\s\S]*?>/gi, '');
  html = html.replace(/<script\s+id="eventframe-schema-jsonld"[\s\S]*?<\/script>/gi, '');

  html = html.replace('</head>', `${metaTags}\n</head>`);

  const renderedMarkup = renderPageHtml(routePath, effectiveLang);
  html = html.replace(
    '<div id="root"></div>',
    `<div id="root" data-prerendered="true">${renderedMarkup}</div>`
  );

  return html;
}

async function prerender() {
  console.log('--- Starting EventFrame.io React SSR Prerender Step ---');

  const templatePath = path.join(distDir, 'index.html');
  if (!fs.existsSync(templatePath)) {
    console.error('Error: dist/index.html not found. Please run vite build first.');
    process.exit(1);
  }

  const baseHtml = fs.readFileSync(templatePath, 'utf8');
  const publicDir = path.join(rootDir, 'public');

  // Ensure robots.txt and _headers are present in dist
  if (fs.existsSync(path.join(publicDir, 'robots.txt'))) {
    fs.copyFileSync(path.join(publicDir, 'robots.txt'), path.join(distDir, 'robots.txt'));
    console.log('✓ Synced robots.txt to dist/robots.txt');
  }
  if (fs.existsSync(path.join(publicDir, '_headers'))) {
    fs.copyFileSync(path.join(publicDir, '_headers'), path.join(distDir, '_headers'));
    console.log('✓ Synced _headers to dist/_headers');
  }

  // Update reference public/sitemap.xml from shared builder, but remove dist/sitemap.xml
  // so Cloudflare Worker dynamically serves live /sitemap.xml including published weddings.
  const staticSitemapXml = buildSitemapXml();
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), staticSitemapXml, 'utf8');
  console.log('✓ Refreshed reference public/sitemap.xml from buildSitemapXml()');

  const distSitemapPath = path.join(distDir, 'sitemap.xml');
  if (fs.existsSync(distSitemapPath)) {
    fs.unlinkSync(distSitemapPath);
    console.log('✓ Removed dist/sitemap.xml so Cloudflare Worker /sitemap.xml handler serves live sitemap');
  }

  const targets: PrerenderTarget[] = [];

  // 1. All English & Localized Marketing Pages including /blog (en, zh-CN, zh-TW, ms)
  for (const basePath of LOCALIZED_MARKETING_BASE_PATHS) {
    for (const lang of MARKETING_HREFLANG_CODES) {
      const localizedPath = buildLocalizedRoutePath(basePath, lang);
      targets.push({
        routePath: localizedPath,
        basePath,
        lang,
        isLocalizedMarketing: true,
      });
    }
  }

  // 2. Editorial Blog Articles across all localized languages (en, zh-CN, zh-TW, ms)
  for (const lang of MARKETING_HREFLANG_CODES) {
    const localizedPosts = getAllBlogPosts(lang);
    for (const post of localizedPosts) {
      const routePath = buildBlogPostPath(post.id, post.resolvedLanguage);
      targets.push({
        routePath,
        basePath: `/blog/${post.slug}`,
        lang: post.resolvedLanguage,
        isLocalizedMarketing: true,
        blogPost: post,
      });
    }
  }

  for (const target of targets) {
    const html = buildHtmlDocument(baseHtml, target);
    const relativeOut =
      target.routePath === '/'
        ? 'index.html'
        : path.join(target.routePath.replace(/^\//, ''), 'index.html');

    const fullOutPath = path.join(distDir, relativeOut);
    const outDir = path.dirname(fullOutPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(fullOutPath, html, 'utf8');
    console.log(`✓ Prerendered ${target.routePath} (${target.lang}) -> dist/${relativeOut}`);
  }

  console.log(`--- React SSR Prerender Completed (${targets.length} pages generated) ---`);
}

prerender().catch((err) => {
  console.error('Prerender error:', err);
  process.exit(1);
});
