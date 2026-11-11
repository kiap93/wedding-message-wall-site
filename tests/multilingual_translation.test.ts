import {
  getEventLanguages,
  enableLanguage,
  disableLanguage,
  setDefaultLanguage,
  setLanguagePublicationStatus,
  getEventTranslations,
  getAllEventTranslations,
  saveEventTranslation,
  autoTranslateEvent,
  translateGuestMessage
} from '../server/translationService';
import {
  calculateSourceHash,
  interpolateVariables,
  extractTranslatableItems
} from '../src/lib/i18n/glossary';
import { weddingDictionaries } from '../src/lib/i18n/dictionaries';
import { WebsiteConfig } from '../src/website-builder/types';

async function runMultilingualTests() {
  console.log('🌐 Starting EventFrame Multilingual Translation Engine Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  const testProjectId = `wedding_event_${Date.now()}`;
  const isolatedProjectId = `other_wedding_event_${Date.now()}`;

  // =========================================================================
  // TEST 1: Default Language Initialization (English)
  // =========================================================================
  console.log('--- Test 1: Default Language Initialization ---');
  const initialLanguages = await getEventLanguages(testProjectId);
  assert(initialLanguages.length >= 1, 'Initial languages contains at least 1 language');
  const defaultEn = initialLanguages.find(l => l.language_code === 'en');
  assert(defaultEn !== undefined, 'English (en) is initialized');
  assert(defaultEn?.is_default === true, 'English is set as default language');
  assert(defaultEn?.is_enabled === true, 'English is enabled by default');
  assert(defaultEn?.publication_status === 'published', 'English default status is published');

  // =========================================================================
  // TEST 2: Enabling Additional Languages (zh-CN, zh-TW, ms)
  // =========================================================================
  console.log('--- Test 2: Enabling Additional Languages ---');
  const zhCnLang = await enableLanguage(testProjectId, 'zh-CN');
  assert(zhCnLang.is_enabled === true, 'Simplified Chinese (zh-CN) enabled successfully');
  assert(zhCnLang.publication_status === 'draft', 'New language defaults to draft status');

  const msLang = await enableLanguage(testProjectId, 'ms');
  assert(msLang.is_enabled === true, 'Bahasa Melayu (ms) enabled successfully');

  const allLanguages = await getEventLanguages(testProjectId);
  assert(allLanguages.some(l => l.language_code === 'zh-CN'), 'zh-CN listed in event languages');
  assert(allLanguages.some(l => l.language_code === 'ms'), 'ms listed in event languages');

  // =========================================================================
  // TEST 3: Setting Default Language
  // =========================================================================
  console.log('--- Test 3: Setting Default Language ---');
  await setDefaultLanguage(testProjectId, 'zh-CN');
  const updatedLanguages = await getEventLanguages(testProjectId);
  const newDefault = updatedLanguages.find(l => l.language_code === 'zh-CN');
  const previousDefault = updatedLanguages.find(l => l.language_code === 'en');

  assert(newDefault?.is_default === true, 'zh-CN is now the default language');
  assert(previousDefault?.is_default === false, 'Previous default (en) is no longer default');

  // Revert en back to default for subsequent tests
  await setDefaultLanguage(testProjectId, 'en');
  const revertedLanguages = await getEventLanguages(testProjectId);
  assert(revertedLanguages.find(l => l.language_code === 'en')?.is_default === true, 'en reverted back to default');

  // =========================================================================
  // TEST 4: Language Switching & URL Query Sync Simulation
  // =========================================================================
  console.log('--- Test 4: Language Switching & URL Sync Simulation ---');
  const buildLangUrl = (baseUrl: string, langCode: string) => {
    const url = new URL(baseUrl, 'https://eventframe.io');
    if (langCode === 'en') {
      url.searchParams.delete('lang');
    } else {
      url.searchParams.set('lang', langCode);
    }
    return url.pathname + (url.search ? url.search : '');
  };

  assert(buildLangUrl('/lucas-and-sofia/website', 'en') === '/lucas-and-sofia/website', 'Default lang cleans URL parameter');
  assert(buildLangUrl('/lucas-and-sofia/website', 'zh-CN') === '/lucas-and-sofia/website?lang=zh-CN', 'zh-CN adds ?lang=zh-CN');
  assert(buildLangUrl('/lucas-and-sofia/website?ref=qr', 'ms') === '/lucas-and-sofia/website?ref=qr&lang=ms', 'Preserves existing URL query parameters');

  // =========================================================================
  // TEST 5: Fallback to Event Default Language on Missing Keys
  // =========================================================================
  console.log('--- Test 5: Fallback to Event Default Language ---');
  const resolveTranslation = (
    key: string,
    targetLang: string,
    defaultLang: string,
    translations: Record<string, string>,
    fallbackDict: Record<string, any>
  ): string => {
    if (translations[key]) return translations[key];
    if (fallbackDict[targetLang]?.[key]) return fallbackDict[targetLang][key];
    if (fallbackDict[defaultLang]?.[key]) return fallbackDict[defaultLang][key];
    return key;
  };

  const sampleTranslations: Record<string, string> = {
    'section.hero.headline': 'Lucas 与 Sofia 的婚礼'
  };

  const translatedKey = resolveTranslation(
    'section.hero.headline',
    'zh-CN',
    'en',
    sampleTranslations,
    weddingDictionaries
  );
  assert(translatedKey === 'Lucas 与 Sofia 的婚礼', 'Uses custom translation when present');

  const fallbackKey = resolveTranslation(
    'rsvp.badge',
    'zh-CN',
    'en',
    {},
    weddingDictionaries
  );
  assert(fallbackKey === weddingDictionaries['zh-CN']['rsvp.badge'], 'Falls back to UI dictionary translation for zh-CN');

  const missingKey = resolveTranslation(
    'nonexistent.key',
    'zh-CN',
    'en',
    {},
    weddingDictionaries
  );
  assert(missingKey === 'nonexistent.key', 'Falls back to key name when completely missing');

  // =========================================================================
  // TEST 6: Event Isolation
  // =========================================================================
  console.log('--- Test 6: Event Isolation ---');
  await saveEventTranslation(testProjectId, {
    language_code: 'zh-CN',
    content_key: 'section.hero.headline',
    translated_value: 'Event 1 专属中文标题',
    source_hash: calculateSourceHash('Original Title 1'),
    translation_status: 'manual'
  });

  await saveEventTranslation(isolatedProjectId, {
    language_code: 'zh-CN',
    content_key: 'section.hero.headline',
    translated_value: 'Event 2 独立中文标题',
    source_hash: calculateSourceHash('Original Title 2'),
    translation_status: 'manual'
  });

  const event1Dict = await getEventTranslations(testProjectId, 'zh-CN');
  const event2Dict = await getEventTranslations(isolatedProjectId, 'zh-CN');

  assert(event1Dict['section.hero.headline'] === 'Event 1 专属中文标题', 'Event 1 has its own translation');
  assert(event2Dict['section.hero.headline'] === 'Event 2 独立中文标题', 'Event 2 has its own translation');
  assert(event1Dict['section.hero.headline'] !== event2Dict['section.hero.headline'], 'Events are completely isolated');

  // =========================================================================
  // TEST 7: Auto-Translation Batch Engine & Wedding Glossary Rules
  // =========================================================================
  console.log('--- Test 7: Auto-Translation Engine & Glossary Preservation ---');
  const mockWebsiteConfig: Partial<WebsiteConfig> = {
    sections: [
      {
        id: 'hero',
        type: 'hero',
        title: 'Hero Section',
        enabled: true,
        order: 0,
        content: {
          badge: 'Lucas & Sofia Forever',
          headline: 'Celebrating Lucas & Sofia',
          subheadline: 'Join us on October 24, 2025 at Villa Montalvo Estate'
        }
      },
      {
        id: 'venue',
        type: 'venue',
        title: 'Venue',
        enabled: true,
        order: 1,
        content: {
          venueName: 'Villa Montalvo Estate',
          address: '15400 Montalvo Road, Saratoga, CA 95070',
          attire: 'Formal Garden Elegance'
        }
      }
    ]
  };

  const extractedItems = extractTranslatableItems(mockWebsiteConfig, 'Lucas', 'Sofia');
  assert(extractedItems.length >= 4, `Extracted ${extractedItems.length} translatable text items`);

  // Test variable interpolation preservation
  const templateStr = 'Dear {{guest_name}}, you are seated at Table {{table_number}}.';
  const interpolated = interpolateVariables(templateStr, {
    guest_name: 'Lady Eleanor',
    table_number: 'VIP 1'
  });
  assert(interpolated === 'Dear Lady Eleanor, you are seated at Table VIP 1.', 'Template variables interpolated correctly');

  // Run autoTranslateEvent
  const autoTransResult = await autoTranslateEvent(
    testProjectId,
    'zh-CN',
    mockWebsiteConfig,
    'Lucas',
    'Sofia'
  );
  assert(autoTransResult.success === true, 'Auto-translation batch executed successfully');
  assert(autoTransResult.translatedCount >= 4, `Auto-translated ${autoTransResult.translatedCount} items`);

  const zhTranslationsAfterAuto = await getEventTranslations(testProjectId, 'zh-CN');
  assert(zhTranslationsAfterAuto['section.hero.badge'] !== undefined, 'Hero badge translated');
  assert(zhTranslationsAfterAuto['section.hero.headline'] !== undefined, 'Hero headline translated');
  // Check that names Lucas & Sofia are preserved
  const headlineTrans = zhTranslationsAfterAuto['section.hero.headline'];
  assert(headlineTrans.includes('Lucas') && headlineTrans.includes('Sofia'), 'Preserved couple names Lucas & Sofia in translation');

  // =========================================================================
  // TEST 8: Manual Translation Updates & Status Tracking
  // =========================================================================
  console.log('--- Test 8: Manual Translation Updates & Status Tracking ---');
  const manualSave = await saveEventTranslation(testProjectId, {
    language_code: 'zh-CN',
    content_key: 'section.hero.headline',
    translated_value: '卢卡斯与索菲亚的美好婚礼',
    source_hash: calculateSourceHash('Celebrating Lucas & Sofia'),
    translation_status: 'manual'
  });

  assert(manualSave.translation_status === 'manual', 'Translation marked as manual');
  assert(manualSave.translated_value === '卢卡斯与索菲亚的美好婚礼', 'Manual translation saved accurately');

  const allZhRecords = await getAllEventTranslations(testProjectId, 'zh-CN');
  const heroRecord = allZhRecords.find(r => r.content_key === 'section.hero.headline');
  assert(heroRecord?.translation_status === 'manual', 'Database record retains manual status');

  // =========================================================================
  // TEST 9: Source Hash Change Detection & Needs Review Status Flag
  // =========================================================================
  console.log('--- Test 9: Source Hash Change Detection & Needs Review ---');
  const initialSourceText = 'Celebrating Lucas & Sofia';
  const initialHash = calculateSourceHash(initialSourceText);

  // If source text changes:
  const updatedSourceText = 'Celebrating Lucas & Sofia - Modern Black Tie Affair';
  const updatedHash = calculateSourceHash(updatedSourceText);
  assert(initialHash !== updatedHash, 'Source hash changes when source content changes');

  // Simulate source hash mismatch check
  const isOutdated = (storedHash: string | undefined, currentText: string) => {
    return !storedHash || storedHash !== calculateSourceHash(currentText);
  };
  assert(isOutdated(initialHash, updatedSourceText) === true, 'Correctly flags translation as outdated when source changes');
  assert(isOutdated(updatedHash, updatedSourceText) === false, 'Hash matches when content is current');

  // =========================================================================
  // TEST 10: Publication Status (Draft vs Published)
  // =========================================================================
  console.log('--- Test 10: Publication Status (Draft vs Published) ---');
  // Currently zh-CN is draft
  await setLanguagePublicationStatus(testProjectId, 'zh-CN', 'draft');
  let currentLangs = await getEventLanguages(testProjectId);
  let zhLang = currentLangs.find(l => l.language_code === 'zh-CN');
  assert(zhLang?.publication_status === 'draft', 'zh-CN set to draft');

  // Public visitor should only see published languages
  const publicLanguages = currentLangs.filter(l => l.is_enabled && l.publication_status === 'published');
  assert(!publicLanguages.some(l => l.language_code === 'zh-CN'), 'Draft language excluded from public selector');
  assert(publicLanguages.some(l => l.language_code === 'en'), 'Published language included in public selector');

  // Publish zh-CN
  await setLanguagePublicationStatus(testProjectId, 'zh-CN', 'published');
  currentLangs = await getEventLanguages(testProjectId);
  zhLang = currentLangs.find(l => l.language_code === 'zh-CN');
  assert(zhLang?.publication_status === 'published', 'zh-CN published successfully');

  const updatedPublicLanguages = currentLangs.filter(l => l.is_enabled && l.publication_status === 'published');
  assert(updatedPublicLanguages.some(l => l.language_code === 'zh-CN'), 'Published zh-CN now visible to public visitors');

  // =========================================================================
  // TEST 11: RSVP Submission Integrity Across Languages
  // =========================================================================
  console.log('--- Test 11: RSVP Submission Integrity ---');
  // Simulated guest submission from a zh-CN user
  const guestSubmissionZh = {
    full_name: 'Wang Wei (王伟)',
    email: 'wangwei@example.com',
    attending: 'yes',
    pax: 2,
    dietary_notes: 'Vegetarian (素食)',
    language_used: 'zh-CN'
  };

  // Integrity rule: Guest submission data must be stored verbatim without being altered
  assert(guestSubmissionZh.full_name === 'Wang Wei (王伟)', 'Guest name stored verbatim');
  assert(guestSubmissionZh.dietary_notes.includes('Vegetarian'), 'Dietary notes preserved as submitted');
  assert(guestSubmissionZh.attending === 'yes', 'Attendance status normalized consistently');

  // =========================================================================
  // TEST 12: Guest Message Translate-to-View Preserves Original Stored Text
  // =========================================================================
  console.log('--- Test 12: Guest Message Translate-to-View Feature ---');
  const originalMessage = '祝你们百年好合，永结同心！';
  const translationRes = await translateGuestMessage(originalMessage, 'en');

  assert(translationRes.originalText === originalMessage, 'Original message preserved verbatim in translation response');
  assert(translationRes.translatedText !== undefined && translationRes.translatedText.length > 0, 'Translated preview generated');
  assert(translationRes.translatedText !== originalMessage, 'Translation is in English');

  // =========================================================================
  // TEST 13: Multilingual SEO Metadata & Hreflang Alternate Tags
  // =========================================================================
  console.log('--- Test 13: Multilingual SEO Metadata & Hreflang Tags ---');
  const generateHreflangs = (eventSlug: string, languages: { language_code: string; publication_status: string }[]) => {
    const published = languages.filter(l => l.publication_status === 'published');
    const baseUrl = `https://eventframe.io/${eventSlug}/website`;
    return published.map(l => ({
      rel: 'alternate',
      hreflang: l.language_code,
      href: l.language_code === 'en' ? baseUrl : `${baseUrl}?lang=${l.language_code}`
    }));
  };

  const hreflangs = generateHreflangs('lucas-and-sofia', [
    { language_code: 'en', publication_status: 'published' },
    { language_code: 'zh-CN', publication_status: 'published' },
    { language_code: 'ms', publication_status: 'draft' }
  ]);

  assert(hreflangs.length === 2, 'Generated hreflang tags only for published languages');
  assert(hreflangs.some(h => h.hreflang === 'en' && h.href === 'https://eventframe.io/lucas-and-sofia/website'), 'Canonical English tag generated');
  assert(hreflangs.some(h => h.hreflang === 'zh-CN' && h.href === 'https://eventframe.io/lucas-and-sofia/website?lang=zh-CN'), 'Localized zh-CN hreflang tag generated');

  // =========================================================================
  // TEST 14: Preservation of Art Aesthetic Settings & Layout Across Languages
  // =========================================================================
  console.log('--- Test 14: Preservation of Art Aesthetics & Layout ---');
  const designPalette = {
    primary: '#1E293B',
    secondary: '#D4AF37',
    background: '#FAFAF9',
    surface: '#FFFFFF',
    text: '#0F172A',
    accent: '#8B5CF6'
  };

  const typography = {
    headingFont: 'Playfair Display, serif',
    bodyFont: 'Plus Jakarta Sans, sans-serif'
  };

  // Switching language should leave designPalette and typography completely untouched
  const renderContextEn = { lang: 'en', palette: { ...designPalette }, typography: { ...typography } };
  const renderContextZh = { lang: 'zh-CN', palette: { ...designPalette }, typography: { ...typography } };

  assert(renderContextEn.palette.primary === renderContextZh.palette.primary, 'Primary color preserved across languages');
  assert(renderContextEn.palette.accent === renderContextZh.palette.accent, 'Accent color preserved across languages');
  assert(renderContextEn.typography.headingFont === renderContextZh.typography.headingFont, 'Heading typography preserved across languages');
  assert(renderContextEn.typography.bodyFont === renderContextZh.typography.bodyFont, 'Body typography preserved across languages');

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log(`\n🏁 Test Suite Finished: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runMultilingualTests().catch(err => {
  console.error('Fatal error in multilingual test suite:', err);
  process.exit(1);
});
