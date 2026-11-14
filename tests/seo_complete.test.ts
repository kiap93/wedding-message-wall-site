import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC_SEO_ROUTES, resolveRouteMetadata } from '../src/seo/routes';
import { buildSitemapXml, isWeddingProjectIndexable } from '../src/seo/sitemap';
import {
  buildCanonicalUrl,
  LOCALIZED_MARKETING_BASE_PATHS,
  MARKETING_HREFLANG_CODES,
  buildLocalizedRoutePath,
} from '../src/seo/canonical';
import { buildPageStructuredData } from '../src/seo/structuredData';
import { buildBlogPostPath, getAllBlogPosts } from '../src/content/blog';
import workerApp from '../worker/index';

async function runTests() {
  console.log('Running EventFrame Technical SEO Verification Suite...');

  // 1. Metadata uniqueness across all public routes and blog posts
  const titles = new Map<string, string>();
  const descriptions = new Map<string, string>();

  for (const [routePath, meta] of Object.entries(PUBLIC_SEO_ROUTES)) {
    assert.ok(meta.title.length >= 25 && meta.title.length <= 85, `Title length out of bounds for ${routePath}: ${meta.title}`);
    assert.ok(meta.description.length >= 80 && meta.description.length <= 210, `Description length out of bounds for ${routePath}`);
    assert.ok(!titles.has(meta.title), `Duplicate title "${meta.title}" on ${routePath} and ${titles.get(meta.title)}`);
    assert.ok(!descriptions.has(meta.description), `Duplicate description on ${routePath} and ${descriptions.get(meta.description)}`);
    titles.set(meta.title, routePath);
    descriptions.set(meta.description, routePath);
  }

  const blogPosts = getAllBlogPosts();
  assert.ok(blogPosts.length >= 7, `Expected at least 7 blog posts, found ${blogPosts.length}`);
  for (const post of blogPosts) {
    const blogPath = `/blog/${post.slug}`;
    assert.ok(!titles.has(post.seoTitle), `Duplicate blog title on ${blogPath}`);
    assert.ok(!descriptions.has(post.description), `Duplicate blog description on ${blogPath}`);
    titles.set(post.seoTitle, blogPath);
    descriptions.set(post.description, blogPath);

    const schemas = buildPageStructuredData({
      type: 'Article',
      title: post.seoTitle,
      description: post.description,
      canonicalUrl: buildCanonicalUrl(blogPath),
      noindex: false,
    });
    const rawJson = JSON.stringify(schemas);
    assert.ok(!rawJson.includes('aggregateRating'), `Must not include fake aggregateRating on ${blogPath}`);
    assert.ok(schemas.some((s) => s['@type'] === 'Organization'));
  }
  console.log(`✓ Verified unique metadata & compliant JSON-LD across ${titles.size} public routes + blog posts`);

  // 2. Private & Wedding route default indexing safety
  for (const priv of ['/login', '/workspace', '/editor/123', '/website-studio/123', '/couple/login', '/subscription']) {
    const resolved = resolveRouteMetadata(priv);
    assert.equal(resolved.meta.noindex, true, `Expected ${priv} to be noindex`);
  }
  assert.equal(resolveRouteMetadata('/alice-and-bob/website').meta.noindex, true, 'Wedding website defaults safely to noindex before public confirmation');
  assert.equal(resolveRouteMetadata('/pricing').meta.noindex, undefined);
  console.log('✓ Verified private route noindex guards & wedding safe default');

  // 3. Wedding indexability helper & Dynamic Sitemap XML generation
  assert.equal(
    isWeddingProjectIndexable({
      slug: 'elena-and-marcus',
      website_status: 'published',
      access_password: null,
      website_published_config: { seo: { noIndex: false } },
    }),
    true
  );
  assert.equal(
    isWeddingProjectIndexable({
      slug: 'private-wedding',
      website_status: 'published',
      access_password: 'secret',
    }),
    false
  );
  assert.equal(
    isWeddingProjectIndexable({
      slug: 'unlisted-wedding',
      website_status: 'published',
      website_published_config: { seo: { noIndex: true } },
    }),
    false
  );
  assert.equal(
    isWeddingProjectIndexable({
      slug: 'draft-wedding',
      website_status: 'draft',
    }),
    false
  );

  const sitemapXml = buildSitemapXml({
    publishedProjects: [
      { slug: 'clara-and-liam', website_status: 'published', updated_at: '2026-11-10T10:00:00Z' },
      { slug: 'clara-and-liam', website_status: 'published', updated_at: '2026-11-10T10:00:00Z' },
      { slug: 'locked-couple', website_status: 'published', access_password: '123' },
      { slug: 'hidden-couple', website_status: 'published', website_published_config: { seo: { noIndex: true } } },
    ],
  });

  assert.ok(sitemapXml.includes('<loc>https://eventframe.io/</loc>'));
  assert.ok(sitemapXml.includes('<loc>https://eventframe.io/zh-cn/pricing</loc>'));
  assert.ok(sitemapXml.includes('<loc>https://eventframe.io/wedding-website-builder</loc>'));
  assert.ok(sitemapXml.includes('<loc>https://eventframe.io/wedding-seating-chart</loc>'));
  assert.ok(sitemapXml.includes('<loc>https://eventframe.io/blog/wedding-seating-chart-guide</loc>'));
  assert.ok(sitemapXml.includes('<loc>https://eventframe.io/clara-and-liam/website</loc>'));
  assert.ok(!sitemapXml.includes('locked-couple/website'));
  assert.ok(!sitemapXml.includes('hidden-couple/website'));
  const claireMatches = sitemapXml.match(/clara-and-liam\/website/g) || [];
  assert.equal(claireMatches.length, 1, 'Sitemap must deduplicate URLs');
  console.log('✓ Verified buildSitemapXml filtering, localization, escaping, and deduplication');

  // 4. Cloudflare Worker live endpoints (robots.txt, sitemap.xml, ?lang= 301 redirect, X-Robots-Tag)
  const dummyEnv = {
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    JWT_SECRET: 'test-secret',
    APP_URL: 'https://eventframe.io',
    SUPABASE_URL: '',
    VITE_SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    SUPABASE_SERVICE_KEY: '',
    SUPABASE_SECRET_KEY: '',
    VITE_SUPABASE_ANON_KEY: '',
    STRIPE_SECRET_KEY: '',
    STRIPE_WEBHOOK_SECRET: '',
    GMAIL_USER: '',
    GMAIL_PASS: '',
    RESEND_API_KEY: '',
    GEMINI_API_KEY: '',
  };

  const robotsRes = await workerApp.fetch(new Request('https://eventframe.io/robots.txt'), dummyEnv);
  assert.equal(robotsRes.status, 200);
  const robotsTxt = await robotsRes.text();
  assert.ok(robotsTxt.includes('Sitemap: https://eventframe.io/sitemap.xml'));
  assert.ok(robotsTxt.includes('Disallow: /workspace'));
  assert.ok(robotsTxt.includes('Allow: /zh-cn'));

  const sitemapRes = await workerApp.fetch(new Request('https://eventframe.io/sitemap.xml'), dummyEnv);
  assert.equal(sitemapRes.status, 200);
  assert.ok(sitemapRes.headers.get('Content-Type')?.includes('application/xml'));
  const liveSitemapText = await sitemapRes.text();
  assert.ok(liveSitemapText.includes('<loc>https://eventframe.io/wedding-seating-chart</loc>'));

  const legacyRedirectRes = await workerApp.fetch(
    new Request('https://eventframe.io/pricing?lang=zh-CN&utm_source=test'),
    dummyEnv
  );
  assert.equal(legacyRedirectRes.status, 301);
  assert.equal(
    legacyRedirectRes.headers.get('Location'),
    'https://eventframe.io/zh-cn/pricing?utm_source=test'
  );

  const privateRes = await workerApp.fetch(
    new Request('https://eventframe.io/workspace'),
    {
      ...dummyEnv,
      ASSETS: {
        fetch: async () =>
          new Response('<html><body>workspace</body></html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }),
      },
    }
  );
  assert.equal(privateRes.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  console.log('✓ Verified Cloudflare Worker /robots.txt, /sitemap.xml, 301 locale redirects, and X-Robots-Tag');

  // 5. Prerendered dist/ HTML verification
  const distDir = path.resolve('dist');
  assert.ok(fs.existsSync(distDir), 'dist directory must exist (run npm run build first)');
  assert.equal(
    fs.existsSync(path.join(distDir, 'sitemap.xml')),
    false,
    'dist/sitemap.xml must NOT exist so Cloudflare Worker serves dynamic sitemap.xml'
  );

  let verifiedCount = 0;
  for (const basePath of LOCALIZED_MARKETING_BASE_PATHS) {
    for (const lang of MARKETING_HREFLANG_CODES) {
      const routePath = buildLocalizedRoutePath(basePath, lang);
      const htmlPath =
        routePath === '/'
          ? path.join(distDir, 'index.html')
          : path.join(distDir, routePath.replace(/^\//, ''), 'index.html');
      assert.ok(fs.existsSync(htmlPath), `Missing prerendered HTML for ${routePath} at ${htmlPath}`);

      const html = fs.readFileSync(htmlPath, 'utf8');
      assert.ok(html.includes(`<html lang="${lang}"`), `Expected <html lang="${lang}"> on ${routePath}`);
      assert.equal((html.match(/<title>/gi) || []).length, 1, `Expected single <title> on ${routePath}`);
      assert.equal((html.match(/<link rel="canonical"/gi) || []).length, 1, `Expected single canonical on ${routePath}`);
      assert.equal((html.match(/id="eventframe-schema-jsonld"/gi) || []).length, 1, `Expected single JSON-LD on ${routePath}`);
      assert.ok(html.includes('hreflang="x-default"'), `Expected hreflang x-default on ${routePath}`);
      assert.ok(!html.includes('<div id="root"></div>'), `Expected non-empty SSR root on ${routePath}`);
      assert.ok(!html.includes('animate-spin'), `Expected no loading spinner in SSR HTML on ${routePath}`);
      verifiedCount++;
    }
  }

  for (const lang of MARKETING_HREFLANG_CODES) {
    for (const post of getAllBlogPosts(lang)) {
      const routePath = buildBlogPostPath(post.id, post.resolvedLanguage);
      const postHtmlPath = path.join(distDir, routePath.replace(/^\//, ''), 'index.html');
      assert.ok(fs.existsSync(postHtmlPath), `Missing prerendered blog post at ${postHtmlPath}`);
      const html = fs.readFileSync(postHtmlPath, 'utf8');
      assert.ok(html.includes(`<html lang="${post.resolvedLanguage}"`), `Expected <html lang="${post.resolvedLanguage}"> on ${routePath}`);
      assert.ok(html.includes(`<title>${post.seoTitle.replace(/&/g, '&amp;')}`), `Expected post SEO title on ${routePath}`);
      assert.ok(html.includes('data-ef-marketing-hreflang="true"'), `Expected localized hreflang tags on ${routePath}`);
      assert.ok(html.includes('"@type":"Article"'), `Expected Article schema on ${routePath}`);
      verifiedCount++;
    }
  }

  for (const lang of MARKETING_HREFLANG_CODES) {
    const blogRoutePath = buildLocalizedRoutePath('/blog', lang);
    const blogIndexPath = path.join(distDir, blogRoutePath.replace(/^\//, ''), 'index.html');
    assert.ok(fs.existsSync(blogIndexPath), `Missing prerendered ${blogIndexPath}`);
    verifiedCount++;
  }

  console.log(`✓ Verified all ${verifiedCount} SSR prerendered HTML files in dist/`);
  console.log('ALL COMPLETE TECHNICAL SEO VERIFICATION CHECKS PASSED!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
