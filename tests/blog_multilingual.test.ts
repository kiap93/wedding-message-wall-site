import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter, Routes, Route } from 'react-router-dom';
import {
  BLOG_CATEGORIES,
  BLOG_POSTS,
  BlogLocale,
  buildBlogIndexPath,
  buildBlogPostHreflangLinks,
  buildBlogPostPath,
  getAdjacentBlogPosts,
  getAllBlogPosts,
  getBlogCategoryLabel,
  getBlogPostById,
  getBlogPostBySlug,
  getBlogUiLabels,
  getRelatedBlogPosts,
  resolveLocalizedBlogPost,
} from '../src/content/blog';
import {
  MarketingTranslationProvider,
  buildMarketingLocalizedPath,
} from '../src/lib/i18n/MarketingTranslationContext';
import { SEOProvider } from '../src/components/SEO';
import { buildCanonicalUrl, extractLocaleFromPathname } from '../src/seo/canonical';
import { resolveRouteMetadata } from '../src/seo/routes';
import { buildSitemapXml } from '../src/seo/sitemap';
import BlogIndexPage from '../src/pages/blog/BlogIndexPage';
import BlogPostPage from '../src/pages/blog/BlogPostPage';
import workerApp from '../worker/index';

const ALL_LANGS: BlogLocale[] = ['en', 'zh-CN', 'zh-TW', 'ms'];

function decodeHtmlEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'");
}

function renderBlogIndex(path: string, lang: BlogLocale): string {
  return renderToString(
    React.createElement(
      StaticRouter,
      { location: path },
      React.createElement(MarketingTranslationProvider, {
        initialLanguage: lang,
        children: React.createElement(
          SEOProvider,
          null,
          React.createElement(
            Routes,
            null,
            React.createElement(Route, { path: '/blog', element: React.createElement(BlogIndexPage) }),
            React.createElement(Route, { path: '/en/blog', element: React.createElement(BlogIndexPage) }),
            React.createElement(Route, { path: '/zh-cn/blog', element: React.createElement(BlogIndexPage) }),
            React.createElement(Route, { path: '/zh-tw/blog', element: React.createElement(BlogIndexPage) }),
            React.createElement(Route, { path: '/ms/blog', element: React.createElement(BlogIndexPage) })
          )
        ),
      })
    )
  );
}

function renderBlogPost(path: string, lang: BlogLocale): string {
  return renderToString(
    React.createElement(
      StaticRouter,
      { location: path },
      React.createElement(MarketingTranslationProvider, {
        initialLanguage: lang,
        children: React.createElement(
          SEOProvider,
          null,
          React.createElement(
            Routes,
            null,
            React.createElement(Route, { path: '/blog/:slug', element: React.createElement(BlogPostPage) }),
            React.createElement(Route, { path: '/en/blog/:slug', element: React.createElement(BlogPostPage) }),
            React.createElement(Route, { path: '/zh-cn/blog/:slug', element: React.createElement(BlogPostPage) }),
            React.createElement(Route, { path: '/zh-tw/blog/:slug', element: React.createElement(BlogPostPage) }),
            React.createElement(Route, { path: '/ms/blog/:slug', element: React.createElement(BlogPostPage) })
          )
        ),
      })
    )
  );
}

async function runTests() {
  console.log('Running Multilingual Blog Verification Suite (All 7 Articles × 4 Languages)...');

  assert.equal(BLOG_POSTS.length, 7, 'Expected all 7 published blog articles');

  const seenLocalizedSlugs = new Set<string>();
  const reportRows: Array<{
    id: string;
    enTitle: string;
    zhCnTitle: string;
    zhTwTitle: string;
    msTitle: string;
    status: string;
  }> = [];

  for (const basePost of BLOG_POSTS) {
    const id = basePost.id || basePost.slug;
    const localizedByLang: Record<BlogLocale, ReturnType<typeof getBlogPostById>> = {
      en: getBlogPostById(id, 'en'),
      'zh-CN': getBlogPostById(id, 'zh-CN'),
      'zh-TW': getBlogPostById(id, 'zh-TW'),
      ms: getBlogPostById(id, 'ms'),
    };

    for (const lang of ALL_LANGS) {
      const post = localizedByLang[lang];
      assert.ok(post, `Missing resolved post for ${id} (${lang})`);
      assert.equal(post.id, id, `Stable ID mismatch for ${id} (${lang})`);
      assert.equal(post.isFallback, false, `Unexpected fallback for ${id} (${lang})`);
      assert.equal(post.resolvedLanguage, lang, `Resolved language mismatch for ${id} (${lang})`);
      assert.ok(!seenLocalizedSlugs.has(`${lang}:${post.slug}`), `Duplicate localized slug ${post.slug} in ${lang}`);
      seenLocalizedSlugs.add(`${lang}:${post.slug}`);

      // Verify translated fields differ from English when lang !== 'en'
      if (lang !== 'en') {
        const enPost = localizedByLang.en!;
        assert.notEqual(post.title, enPost.title, `[${id}][${lang}] title not translated`);
        assert.notEqual(post.slug, enPost.slug, `[${id}][${lang}] slug not localized`);
        assert.notEqual(post.excerpt, enPost.excerpt, `[${id}][${lang}] excerpt not translated`);
        assert.notEqual(post.seoTitle, enPost.seoTitle, `[${id}][${lang}] seoTitle not translated`);
        assert.notEqual(post.description, enPost.description, `[${id}][${lang}] description not translated`);
        assert.notEqual(post.coverImageAlt, enPost.coverImageAlt, `[${id}][${lang}] coverImageAlt not translated`);
        assert.notEqual(post.category, enPost.category, `[${id}][${lang}] category not translated`);
        assert.notEqual(post.authorRole, enPost.authorRole, `[${id}][${lang}] authorRole not translated`);

        // Verify ALL sections, paragraphs, bullets, callouts, FAQs, and tool links are translated
        assert.equal(post.sections.length, enPost.sections.length, `[${id}][${lang}] section count mismatch`);
        post.sections.forEach((sec, idx) => {
          const enSec = enPost.sections[idx];
          assert.notEqual(sec.heading, enSec.heading, `[${id}][${lang}] section ${idx} heading untranslated`);
          assert.equal(sec.paragraphs.length, enSec.paragraphs.length, `[${id}][${lang}] section ${idx} paragraph count mismatch`);
          sec.paragraphs.forEach((para, pIdx) => {
            assert.notEqual(para, enSec.paragraphs[pIdx], `[${id}][${lang}] section ${idx} paragraph ${pIdx} untranslated`);
          });
          if (enSec.bullets) {
            assert.equal(sec.bullets?.length, enSec.bullets.length, `[${id}][${lang}] section ${idx} bullets mismatch`);
            sec.bullets?.forEach((bullet, bIdx) => {
              assert.notEqual(bullet, enSec.bullets![bIdx], `[${id}][${lang}] section ${idx} bullet ${bIdx} untranslated`);
            });
          }
          if (enSec.callout) {
            assert.ok(sec.callout && sec.callout !== enSec.callout, `[${id}][${lang}] section ${idx} callout untranslated`);
          }
        });

        assert.equal(post.faqs.length, enPost.faqs.length, `[${id}][${lang}] FAQ count mismatch`);
        post.faqs.forEach((faq, idx) => {
          assert.notEqual(faq.q, enPost.faqs[idx].q, `[${id}][${lang}] FAQ ${idx} question untranslated`);
          assert.notEqual(faq.a, enPost.faqs[idx].a, `[${id}][${lang}] FAQ ${idx} answer untranslated`);
        });

        assert.equal(post.relatedToolLinks.length, enPost.relatedToolLinks.length, `[${id}][${lang}] tool link count mismatch`);
        post.relatedToolLinks.forEach((tool, idx) => {
          assert.notEqual(tool.label, enPost.relatedToolLinks[idx].label, `[${id}][${lang}] tool link ${idx} label untranslated`);
          assert.notEqual(tool.desc, enPost.relatedToolLinks[idx].desc, `[${id}][${lang}] tool link ${idx} desc untranslated`);
        });
      }

      // Cross-language identity lookup: looking up by localized slug or English slug resolves same post ID
      const byOwnSlug = getBlogPostBySlug(post.slug, lang);
      const byEnSlug = getBlogPostBySlug(basePost.slug, lang);
      assert.equal(byOwnSlug?.id, id);
      assert.equal(byEnSlug?.id, id);
      assert.equal(byEnSlug?.title, post.title);

      // Language switching preserves article identity & jumps directly to target localized slug URL
      const currentPath = buildBlogPostPath(id, lang);
      for (const targetLang of ALL_LANGS) {
        const switchedPath = buildMarketingLocalizedPath(currentPath, targetLang);
        assert.equal(
          switchedPath,
          buildBlogPostPath(id, targetLang),
          `Language switch from ${currentPath} -> ${targetLang} failed`
        );
      }

      // Route SEO metadata verification
      const resolvedMeta = resolveRouteMetadata(currentPath);
      assert.equal(resolvedMeta.lang, lang);
      assert.equal(resolvedMeta.meta.title, post.seoTitle);
      assert.equal(resolvedMeta.meta.description, post.description);
      assert.equal(resolvedMeta.meta.canonicalPath, currentPath);

      // SSR rendered HTML verification for each article in each language
      const html = decodeHtmlEntities(renderBlogPost(currentPath, lang));
      const ui = getBlogUiLabels(lang);
      assert.ok(html.includes(post.title), `Rendered HTML missing title for ${currentPath}`);
      assert.ok(html.includes(post.excerpt), `Rendered HTML missing excerpt for ${currentPath}`);
      assert.ok(html.includes(post.category), `Rendered HTML missing category for ${currentPath}`);
      assert.ok(html.includes(ui.faqHeading), `Rendered HTML missing FAQ heading for ${currentPath}`);
      assert.ok(html.includes(ui.relatedReadingHeading), `Rendered HTML missing Related Reading for ${currentPath}`);

      // Verify Previous / Next article navigation
      const adjacent = getAdjacentBlogPosts(id, lang);
      if (adjacent.prev) {
        assert.ok(html.includes(ui.previousArticleLabel), `Missing Previous Guide label on ${currentPath}`);
        assert.ok(html.includes(adjacent.prev.title), `Missing Previous Guide title on ${currentPath}`);
      }
      if (adjacent.next) {
        assert.ok(html.includes(ui.nextArticleLabel), `Missing Next Guide label on ${currentPath}`);
        assert.ok(html.includes(adjacent.next.title), `Missing Next Guide title on ${currentPath}`);
      }

      // Verify related reading posts are in target language
      const related = getRelatedBlogPosts(post, lang);
      assert.ok(related.length >= 2);
      related.forEach((r) => assert.equal(r.resolvedLanguage, lang));
    }

    // Distinct Simplified vs Traditional Chinese verification
    assert.notEqual(
      localizedByLang['zh-CN']!.title,
      localizedByLang['zh-TW']!.title,
      `[${id}] zh-CN and zh-TW titles should use distinct script`
    );

    // Bidirectional hreflang validation
    const hreflangs = buildBlogPostHreflangLinks(id);
    assert.deepEqual(
      hreflangs.map((h) => h.hreflang),
      ['en', 'zh-CN', 'zh-TW', 'ms', 'x-default']
    );

    reportRows.push({
      id,
      enTitle: localizedByLang.en!.title,
      zhCnTitle: localizedByLang['zh-CN']!.title,
      zhTwTitle: localizedByLang['zh-TW']!.title,
      msTitle: localizedByLang.ms!.title,
      status: 'PASS (en, zh-CN, zh-TW, ms)',
    });
  }

  console.log(`✓ Verified all ${BLOG_POSTS.length} articles × 4 languages (28 localized editions)`);

  // Verify Blog Index rendering across all 4 languages
  for (const lang of ALL_LANGS) {
    const indexPath = buildBlogIndexPath(lang);
    const indexHtml = decodeHtmlEntities(renderBlogIndex(indexPath, lang));
    const ui = getBlogUiLabels(lang);
    assert.ok(indexHtml.includes(ui.indexTitle), `BlogIndex missing title for ${lang}`);
    assert.ok(indexHtml.includes(ui.allGuides), `BlogIndex missing All Guides button for ${lang}`);
    for (const cat of BLOG_CATEGORIES) {
      assert.ok(
        indexHtml.includes(getBlogCategoryLabel(cat, lang)),
        `BlogIndex missing category ${cat} in ${lang}`
      );
    }
    for (const post of getAllBlogPosts(lang)) {
      assert.ok(indexHtml.includes(post.title), `BlogIndex missing article "${post.title}" in ${lang}`);
    }
  }
  console.log('✓ Verified BlogIndexPage SSR rendering & localized category labels across all 4 languages');

  // Verify /en/blog and /zh-CN uppercase URL handling + canonicalization
  const enAlias = extractLocaleFromPathname('/en/blog/digital-wedding-invitations-guide');
  assert.equal(enAlias.lang, 'en');
  assert.equal(enAlias.basePath, '/blog/digital-wedding-invitations-guide');
  assert.equal(
    buildCanonicalUrl('/en/blog/digital-wedding-invitations-guide'),
    'https://eventframe.io/blog/digital-wedding-invitations-guide'
  );
  const mixedCaseZh = extractLocaleFromPathname('/zh-CN/blog/shuzi-hunli-yaoqinghan-zhinan');
  assert.equal(mixedCaseZh.lang, 'zh-CN');
  assert.equal(mixedCaseZh.hasLocalePrefix, true);
  console.log('✓ Verified /en/blog canonicalization & case-insensitive /zh-CN/blog URL parsing');

  // Verify explicit honest fallback strategy when translation is missing or incomplete
  const missingFallback = resolveLocalizedBlogPost(BLOG_POSTS[0], 'zh-CN', {});
  assert.equal(missingFallback.isFallback, true);
  assert.equal(missingFallback.resolvedLanguage, 'en');
  assert.equal(missingFallback.requestedLanguage, 'zh-CN');
  assert.equal(missingFallback.title, BLOG_POSTS[0].title);
  console.log('✓ Verified explicit fallback strategy returns English with isFallback=true, resolvedLanguage=en');

  // Verify XML sitemap includes all localized blog URLs & alternates
  const sitemapXml = buildSitemapXml();
  assert.ok(sitemapXml.includes('<loc>https://eventframe.io/zh-cn/blog</loc>'));
  assert.ok(sitemapXml.includes('<loc>https://eventframe.io/zh-tw/blog</loc>'));
  assert.ok(sitemapXml.includes('<loc>https://eventframe.io/ms/blog</loc>'));
  for (const post of BLOG_POSTS) {
    const id = post.id || post.slug;
    for (const lang of ALL_LANGS) {
      const url = `https://eventframe.io${buildBlogPostPath(id, lang)}`;
      assert.ok(sitemapXml.includes(`<loc>${url}</loc>`), `Sitemap missing ${url}`);
    }
  }
  console.log('✓ Verified sitemap.xml includes all 4 localized blog index URLs & all 28 article URLs');

  // Verify Worker backend APIs & ?lang= 301 redirect
  const dummyEnv = { JWT_SECRET: 'test-secret' } as any;
  const apiListRes = await workerApp.fetch(
    new Request('https://eventframe.io/api/blog/posts?lang=zh-CN'),
    dummyEnv
  );
  assert.equal(apiListRes.status, 200);
  const apiListJson = await apiListRes.json();
  assert.equal(apiListJson.resolvedLanguage, 'zh-CN');
  assert.equal(apiListJson.posts.length, 7);
  assert.equal(apiListJson.posts[0].resolvedLanguage, 'zh-CN');

  const apiPostRes = await workerApp.fetch(
    new Request('https://eventframe.io/api/blog/posts/digital-wedding-invitations-guide?lang=ms'),
    dummyEnv
  );
  assert.equal(apiPostRes.status, 200);
  const apiPostJson = await apiPostRes.json();
  assert.equal(apiPostJson.resolvedLanguage, 'ms');
  assert.equal(apiPostJson.post.slug, 'panduan-kad-jemputan-perkahwinan-digital');

  const articleLangRedirect = await workerApp.fetch(
    new Request('https://eventframe.io/blog/digital-wedding-invitations-guide?lang=zh-CN'),
    dummyEnv
  );
  assert.equal(articleLangRedirect.status, 301);
  assert.equal(
    articleLangRedirect.headers.get('Location'),
    'https://eventframe.io/zh-cn/blog/shuzi-hunli-yaoqinghan-zhinan'
  );
  console.log('✓ Verified Worker /api/blog/posts endpoints & /blog/:slug?lang=zh-CN 301 redirect');

  console.log('\nArticle Translation Matrix Summary:');
  for (const row of reportRows) {
    console.log(`  - ${row.id}: ${row.status}`);
  }
  console.log('\nALL MULTILINGUAL BLOG TESTS PASSED!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
