import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import i18n from '../src/lib/i18n/i18n';
import enDict from '../src/lib/i18n/marketing/en.json';
import zhCnDict from '../src/lib/i18n/marketing/zh-CN.json';
import zhTwDict from '../src/lib/i18n/marketing/zh-TW.json';
import msDict from '../src/lib/i18n/marketing/ms.json';
import {
  resolveInitialMarketingLanguage,
  buildMarketingLocalizedPath,
  translateMarketing,
  isPublicMarketingPath,
  normalizeMarketingLanguage,
} from '../src/lib/i18n/MarketingTranslationContext';
import {
  buildCanonicalUrl,
  buildMarketingHreflangLinks,
} from '../src/seo/canonical';
import { PUBLIC_SEO_ROUTES } from '../src/seo/routes';

function flattenKeys(obj: Record<string, any>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenKeys(value, fullKey));
    } else {
      result[fullKey] = String(value ?? '');
    }
  }
  return result;
}

function extractPlaceholders(str: string): string[] {
  const matches = str.match(/\{\{[^}]+\}\}/g) || [];
  return matches.sort();
}

async function runTests() {
  console.log('Running Marketing i18n & SEO verification suite...');

  // 1. Dictionary Parity & Completeness
  const enFlat = flattenKeys(enDict);
  const locales: Array<[string, Record<string, any>]> = [
    ['zh-CN', zhCnDict],
    ['zh-TW', zhTwDict],
    ['ms', msDict],
  ];

  const enKeys = Object.keys(enFlat).sort();
  assert.ok(enKeys.length > 200, `Expected >200 marketing keys, found ${enKeys.length}`);

  for (const [code, dict] of locales) {
    const flat = flattenKeys(dict);
    const keys = Object.keys(flat).sort();
    const missing = enKeys.filter((k) => !(k in flat));
    const extra = keys.filter((k) => !(k in enFlat));

    assert.deepEqual(missing, [], `[${code}] Missing keys: ${missing.join(', ')}`);
    assert.deepEqual(extra, [], `[${code}] Extra unexpected keys: ${extra.join(', ')}`);

    for (const key of enKeys) {
      assert.ok(flat[key].trim().length > 0, `[${code}] Empty value for key: ${key}`);
      const expectedVars = extractPlaceholders(enFlat[key]);
      const actualVars = extractPlaceholders(flat[key]);
      assert.deepEqual(
        actualVars,
        expectedVars,
        `[${code}] Placeholder mismatch on key "${key}": expected ${expectedVars}, got ${actualVars}`
      );
    }
  }
  console.log(`✓ Verified 100% key and placeholder parity across ${enKeys.length} keys for en, zh-CN, zh-TW, ms`);

  // 2. Namespace isolation between marketing and event translation
  assert.equal(translateMarketing('home.hero.title', 'en'), enDict.home.hero.title);
  assert.equal(translateMarketing('home.hero.title', 'zh-CN'), zhCnDict.home.hero.title);
  assert.equal(translateMarketing('home.hero.title', 'zh-TW'), zhTwDict.home.hero.title);
  assert.equal(translateMarketing('home.hero.title', 'ms'), msDict.home.hero.title);

  // Simulate event page changing global i18n language to 'ms'
  await i18n.changeLanguage('ms');
  // Marketing translations must stay strictly governed by marketing language argument
  assert.equal(translateMarketing('nav.signIn', 'en'), 'Sign In');
  assert.equal(translateMarketing('nav.signIn', 'zh-CN'), '登录');
  assert.equal(translateMarketing('nav.signIn', 'zh-TW'), '登入');
  assert.equal(translateMarketing('home.pricing.title', 'zh-CN', { price: '$5.00' }), '一场婚礼，一次付费，仅需 $5.00。');

  // Missing key fallback safely falls back to key or en
  assert.equal(translateMarketing('non.existent.key', 'zh-CN'), 'non.existent.key');
  console.log('✓ Verified i18next namespace isolation and English fallback behavior');

  // 3. Language resolution & URL/storage precedence
  assert.equal(resolveInitialMarketingLanguage('', null), 'en');
  assert.equal(resolveInitialMarketingLanguage('?lang=fr', 'zh-TW'), 'zh-TW');
  assert.equal(resolveInitialMarketingLanguage('?lang=zh-CN', 'ms'), 'zh-CN');
  assert.equal(resolveInitialMarketingLanguage('?utm_source=google', 'zh-TW'), 'zh-TW');
  assert.equal(resolveInitialMarketingLanguage('?lang=invalid', null), 'en');
  assert.equal(normalizeMarketingLanguage('de'), 'en');
  assert.equal(normalizeMarketingLanguage('zh-TW'), 'zh-TW');
  console.log('✓ Verified URL query & localStorage resolution rules (no browser overwrite)');

  // 4. Route & query parameter preservation
  assert.equal(buildMarketingLocalizedPath('/pricing?utm_source=ig', 'zh-CN'), '/pricing?utm_source=ig&lang=zh-CN');
  assert.equal(buildMarketingLocalizedPath('/pricing?lang=zh-CN&utm_source=ig', 'en'), '/pricing?utm_source=ig');
  assert.equal(buildMarketingLocalizedPath('/?ref=hero#pricing', 'ms'), '/?ref=hero&lang=ms#pricing');
  // App/event routes must not receive marketing ?lang= param injection
  assert.equal(buildMarketingLocalizedPath('/display?template=garden', 'zh-CN'), '/display?template=garden');
  assert.equal(buildMarketingLocalizedPath('/login', 'zh-CN'), '/login');
  assert.equal(isPublicMarketingPath('/wedding-planner-software'), true);
  assert.equal(isPublicMarketingPath('/workspace'), false);
  console.log('✓ Verified localized path builder & query param preservation');

  // 5. SEO canonicals, route titles/descriptions, and hreflang links
  assert.equal(buildCanonicalUrl('/', '?lang=en&utm_source=fb'), 'https://eventframe.io/');
  assert.equal(buildCanonicalUrl('/', '?lang=zh-CN&utm_source=fb'), 'https://eventframe.io/?lang=zh-CN');
  assert.equal(buildCanonicalUrl('/pricing', '?lang=zh-TW'), 'https://eventframe.io/pricing?lang=zh-TW');

  const homeHreflangs = buildMarketingHreflangLinks('/');
  assert.deepEqual(
    homeHreflangs.map((l) => l.hreflang),
    ['en', 'zh-CN', 'zh-TW', 'ms', 'x-default']
  );
  assert.equal(homeHreflangs.find((l) => l.hreflang === 'en')?.href, 'https://eventframe.io/');
  assert.equal(homeHreflangs.find((l) => l.hreflang === 'zh-CN')?.href, 'https://eventframe.io/?lang=zh-CN');
  assert.equal(homeHreflangs.find((l) => l.hreflang === 'x-default')?.href, 'https://eventframe.io/');

  // Ensure every PUBLIC_SEO_ROUTES entry has translated SEO metadata in all dictionaries
  for (const route of Object.keys(PUBLIC_SEO_ROUTES)) {
    for (const lang of ['en', 'zh-CN', 'zh-TW', 'ms'] as const) {
      const title = translateMarketing(`seo.routes.${route}.title`, lang);
      const desc = translateMarketing(`seo.routes.${route}.description`, lang);
      assert.ok(title && !title.startsWith('seo.routes.'), `Missing SEO title for ${route} (${lang})`);
      assert.ok(desc && !desc.startsWith('seo.routes.'), `Missing SEO description for ${route} (${lang})`);
    }
  }
  console.log('✓ Verified SEO canonical URLs, hreflang alternates, and localized metadata for all public routes');

  // 6. Architecture separation & header placement verification
  const marketingLayoutSrc = fs.readFileSync(path.resolve('src/layouts/MarketingLayout.tsx'), 'utf8');
  const marketingCtxSrc = fs.readFileSync(path.resolve('src/lib/i18n/MarketingTranslationContext.tsx'), 'utf8');
  assert.ok(!marketingLayoutSrc.includes('i18n/TranslationContext'), 'MarketingLayout must NOT import event TranslationContext');
  assert.ok(!marketingCtxSrc.includes('i18n/TranslationContext'), 'MarketingTranslationContext must NOT import event TranslationContext');
  assert.ok(!marketingLayoutSrc.includes('useEventTranslation'), 'MarketingLayout must NOT depend on useEventTranslation');

  const selectorIdx = marketingLayoutSrc.indexOf('<MarketingLanguageSelector variant="header"');
  const signInIdx = marketingLayoutSrc.indexOf("t('nav.signIn')");
  assert.ok(selectorIdx !== -1 && signInIdx !== -1 && selectorIdx < signInIdx, 'MarketingLanguageSelector must appear before Sign In in MarketingLayout header');
  assert.ok(marketingLayoutSrc.includes('<MarketingLanguageSelector variant="mobile"'), 'MarketingLayout mobile drawer must include MarketingLanguageSelector');
  console.log('✓ Verified MarketingLayout architectural isolation and header/mobile selector placement');

  console.log('ALL MARKETING I18N & SEO TESTS PASSED!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
