import { GoogleGenAI } from '@google/genai';
import { getSupabaseAdmin, isSupabaseAvailable, markSupabaseUnavailable } from './supabaseAdmin';
import { 
  EventLanguage, 
  EventTranslation, 
  TranslationStatus, 
  TranslationPublicationStatus,
  SUPPORTED_LANGUAGES 
} from '../src/types';
import { extractTranslatableItems, calculateSourceHash, WEDDING_GLOSSARY } from '../src/lib/i18n/glossary';
import { UI_DICTIONARIES } from '../src/lib/i18n/dictionaries';

// ---------------------------------------------------------------------------
// 1. IN-MEMORY STORE FALLBACK (For tests and unconfigured database environments)
// ---------------------------------------------------------------------------

interface EventTranslationStore {
  languages: Map<string, EventLanguage>; // key: language_code
  translations: Map<string, EventTranslation>; // key: `${language_code}:${content_key}`
}

const memoryStore: Map<string, EventTranslationStore> = new Map();

function getEventMemoryStore(projectId: string): EventTranslationStore {
  if (!memoryStore.has(projectId)) {
    const defaultLangs = new Map<string, EventLanguage>();
    // Default English is always enabled and published
    defaultLangs.set('en', {
      id: `lang_${projectId}_en`,
      event_id: projectId,
      language_code: 'en',
      is_enabled: true,
      is_default: true,
      publication_status: 'published',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    memoryStore.set(projectId, {
      languages: defaultLangs,
      translations: new Map()
    });
  }
  return memoryStore.get(projectId)!;
}

function trySupabase() {
  if (!isSupabaseAvailable()) return null;
  return getSupabaseAdmin();
}

function genId(prefix: string = 'trn'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ---------------------------------------------------------------------------
// 2. TRANSLATION PROVIDER ABSTRACTION & GEMINI IMPLEMENTATION
// ---------------------------------------------------------------------------

export interface TranslationProvider {
  translateBatch(
    items: { key: string; text: string }[],
    targetLang: string,
    sourceLang?: string,
    context?: { groom?: string; bride?: string; eventTitle?: string }
  ): Promise<{ key: string; translatedText: string }[]>;
}

export class GeminiTranslationProvider implements TranslationProvider {
  private ai: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        this.ai = new GoogleGenAI({ apiKey });
      } catch (e) {
        console.warn('[TranslationService] Could not initialize GoogleGenAI:', e);
      }
    }
  }

  async translateBatch(
    items: { key: string; text: string }[],
    targetLang: string,
    sourceLang: string = 'en',
    context?: { groom?: string; bride?: string; eventTitle?: string }
  ): Promise<{ key: string; translatedText: string }[]> {
    if (!items || items.length === 0) return [];

    // Language Name mapping
    const langNames: Record<string, string> = {
      'zh-CN': 'Simplified Chinese (Mandarin, Mainland China wedding register)',
      'zh-TW': 'Traditional Chinese (Taiwan / Hong Kong wedding register)',
      'ms': 'Bahasa Melayu (Formal Malay wedding / Walimatulurus register)',
      'en': 'English (Formal wedding register)'
    };

    const targetLangName = langNames[targetLang] || targetLang;

    // Check if Gemini API is available
    if (this.ai && process.env.GEMINI_API_KEY && process.env.NODE_ENV !== 'test') {
      try {
        const glossaryRules = WEDDING_GLOSSARY.map((g) => {
          const trans = g.translations[targetLang] || '';
          return trans ? `- "${g.source}" -> "${trans}"` : null;
        }).filter(Boolean).join('\n');

        const prompt = `You are a professional wedding website localization and stationery translation expert.
Translate the following wedding website content keys from ${sourceLang} into ${targetLangName}.

STRICT WEDDING LOCALIZATION RULES:
1. PRESERVE EXACTLY:
   - Personal names (e.g. Groom: "${context?.groom || ''}", Bride: "${context?.bride || ''}")
   - Dates, hours, clock times, phone numbers, email addresses, and URLs
   - Dynamic template variables in double curly brackets like {{deadline}}, {{groom}}, {{bride}}
   - Any HTML tags or Markdown formatting
2. CULTURAL & AESTHETIC REGISTER:
   - Use natural, warm, romantic, and formal wedding terminology rather than robotic literal translations.
   - For Simplified/Traditional Chinese, use traditional wedding idioms (e.g., 百年好合, 执子之手, 良辰吉日, 敬备喜筵).
   - For Bahasa Melayu, use customary royal/formal Malay wedding phrasing (e.g., Walimatulurus, Raikan Cinta, Raja Sehari, Memohon Restu).
3. GLOSSARY PREFERENCES:
${glossaryRules}

INPUT JSON:
${JSON.stringify(items, null, 2)}

OUTPUT REQUIREMENT:
Return ONLY a valid JSON array of objects with "key" and "translatedText", matching each input key exactly. No markdown fences, no explanation.`;

        const response = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        });

        const rawText = response.text?.trim() || '';
        const cleaned = rawText.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
        const parsed = JSON.parse(cleaned);

        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p: any) => ({
            key: p.key,
            translatedText: p.translatedText || ''
          }));
        }
      } catch (err: any) {
        console.warn('[GeminiTranslationProvider] API call failed, falling back to heuristic glossary:', err.message);
      }
    }

    // Heuristic Fallback using curated UI dictionaries & glossary rules
    const targetDict = UI_DICTIONARIES[targetLang] || {};
    return items.map((item) => {
      // 1. Exact match in UI dictionaries
      if (targetDict[item.key]) {
        return { key: item.key, translatedText: targetDict[item.key] };
      }

      // 2. Check wedding glossary terms (forward and reverse lookup)
      let translated = item.text;
      
      // Common wedding blessings & guest message phrases
      const BLESSING_MAPS: Record<string, Record<string, string>> = {
        en: {
          '祝你们百年好合，永结同心！': 'Wishing you a harmonious union lasting a hundred years, and two hearts forever united in love!',
          '祝你们百年好合，永结同心': 'Wishing you a harmonious union lasting a hundred years, and two hearts forever united in love',
          '百年好合': 'a hundred years of harmony and love',
          '永结同心': 'two hearts forever united in love',
          '白头偕老': 'grow old together in blissful happiness',
          '新婚快乐': 'Happy Wedding and wonderful celebration',
          '恭喜新婚': 'Heartfelt congratulations on your wedding',
          '恭喜': 'Warm congratulations',
          'Selamat Pengantin Baru': 'Congratulations on your wedding celebration',
          'Tahniah atas perkahwinan anda': 'Congratulations on your sacred wedding day',
          'Semoga berbahagia hingga ke anak cucu': 'May your love blossom and bring enduring happiness for generations'
        },
        'zh-CN': {
          'Wishing you a lifetime of boundless adventure': '愿你们俩一生充满无限冒险、深情欢笑与永恒爱意！',
          'Congratulations': '热烈恭喜两位新人！',
          'Happy Wedding': '新婚快乐，喜结良缘！'
        }
      };

      if (BLESSING_MAPS[targetLang]) {
        for (const [srcPhrase, dstPhrase] of Object.entries(BLESSING_MAPS[targetLang])) {
          if (translated.includes(srcPhrase)) {
            translated = translated.replace(new RegExp(srcPhrase, 'g'), dstPhrase);
          }
        }
      }

      WEDDING_GLOSSARY.forEach((term) => {
        if (targetLang === 'en') {
          // Reverse check from non-English to English
          Object.values(term.translations).forEach((foreignWord) => {
            if (foreignWord && translated.includes(foreignWord)) {
              translated = translated.replace(new RegExp(foreignWord, 'g'), term.source);
            }
          });
        } else {
          const replacement = term.translations[targetLang];
          if (replacement && translated.toLowerCase().includes(term.source.toLowerCase())) {
            const regex = new RegExp(term.source, 'gi');
            translated = translated.replace(regex, replacement);
          }
        }
      });

      // 3. Section headline / subheadline heuristics
      if (item.key.includes('hero.subheadline') && targetDict['hero.default_subheadline']) {
        translated = targetDict['hero.default_subheadline'];
      } else if (item.key.includes('rsvp.headline') && targetDict['rsvp.headline']) {
        translated = targetDict['rsvp.headline'];
      } else if (item.key.includes('story.headline') && targetDict['story.headline']) {
        translated = targetDict['story.headline'];
      } else if (item.key.includes('schedule.headline') && targetDict['schedule.headline']) {
        translated = targetDict['schedule.headline'];
      } else if (item.key.includes('venue.headline') && targetDict['venue.headline']) {
        translated = targetDict['venue.headline'];
      }

      return { key: item.key, translatedText: translated };
    });
  }
}

const defaultProvider: TranslationProvider = new GeminiTranslationProvider();

// ---------------------------------------------------------------------------
// 3. EVENT LANGUAGES MANAGEMENT SERVICE
// ---------------------------------------------------------------------------

export async function getEventLanguages(projectId: string): Promise<EventLanguage[]> {
  const supabase = trySupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('event_languages')
        .select('*')
        .eq('event_id', projectId)
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        // Calculate translation completion stats
        const { data: transData } = await supabase
          .from('event_translations')
          .select('language_code, translation_status')
          .eq('event_id', projectId);

        const transStats = new Map<string, { total: number; translated: number; review: number }>();
        (transData || []).forEach((t: any) => {
          const curr = transStats.get(t.language_code) || { total: 0, translated: 0, review: 0 };
          curr.total++;
          if (t.translation_status === 'translated' || t.translation_status === 'auto_translated') curr.translated++;
          if (t.translation_status === 'needs_review') curr.review++;
          transStats.set(t.language_code, curr);
        });

        return data.map((l: any) => {
          const stats = transStats.get(l.language_code) || { total: 0, translated: 0, review: 0 };
          const pct = stats.total > 0 ? Math.round((stats.translated / stats.total) * 100) : (l.is_default ? 100 : 0);
          return {
            ...l,
            total_keys: stats.total,
            translated_keys: stats.translated,
            needs_review_count: stats.review,
            completion_percentage: l.is_default ? 100 : pct
          };
        });
      }

      // Initialize default English if none exist
      const defaultLang = await enableLanguage(projectId, 'en', true);
      return [{ ...defaultLang, completion_percentage: 100, total_keys: 0, translated_keys: 0, needs_review_count: 0 }];
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[TranslationService] Supabase read languages fallback to memory store:', err.message);
    }
  }

  // Memory store fallback
  const store = getEventMemoryStore(projectId);
  const result: EventLanguage[] = [];

  store.languages.forEach((lang) => {
    let total = 0;
    let translated = 0;
    let review = 0;

    store.translations.forEach((t) => {
      if (t.language_code === lang.language_code) {
        total++;
        if (t.translation_status === 'translated' || t.translation_status === 'auto_translated') translated++;
        if (t.translation_status === 'needs_review') review++;
      }
    });

    const pct = total > 0 ? Math.round((translated / total) * 100) : (lang.is_default ? 100 : 0);
    result.push({
      ...lang,
      total_keys: total,
      translated_keys: translated,
      needs_review_count: review,
      completion_percentage: lang.is_default ? 100 : pct
    });
  });

  return result;
}

export async function enableLanguage(
  projectId: string, 
  langCode: string, 
  isDefault: boolean = false
): Promise<EventLanguage> {
  const newLang: EventLanguage = {
    id: genId('lang'),
    event_id: projectId,
    language_code: langCode,
    is_enabled: true,
    is_default: isDefault,
    publication_status: isDefault ? 'published' : 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const supabase = trySupabase();
  if (supabase) {
    try {
      if (isDefault) {
        // Reset any existing default
        await supabase
          .from('event_languages')
          .update({ is_default: false })
          .eq('event_id', projectId);
      }

      const { data, error } = await supabase
        .from('event_languages')
        .upsert(
          {
            event_id: projectId,
            language_code: langCode,
            is_enabled: true,
            is_default: isDefault,
            publication_status: newLang.publication_status,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'event_id, language_code' }
        )
        .select()
        .single();

      if (!error && data) return data;
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[TranslationService] Supabase enable language fallback:', err.message);
    }
  }

  const store = getEventMemoryStore(projectId);
  if (isDefault) {
    store.languages.forEach((l) => { l.is_default = false; });
  }

  const existing = store.languages.get(langCode);
  if (existing) {
    existing.is_enabled = true;
    existing.is_default = isDefault || existing.is_default;
    existing.updated_at = new Date().toISOString();
    return existing;
  }

  store.languages.set(langCode, newLang);
  return newLang;
}

export async function disableLanguage(projectId: string, langCode: string): Promise<boolean> {
  // Never disable default language
  const langs = await getEventLanguages(projectId);
  const target = langs.find((l) => l.language_code === langCode);
  if (target?.is_default) {
    throw new Error('Cannot disable the default language.');
  }

  const supabase = trySupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from('event_languages')
        .update({ is_enabled: false, publication_status: 'draft', updated_at: new Date().toISOString() })
        .eq('event_id', projectId)
        .eq('language_code', langCode);

      if (!error) return true;
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[TranslationService] Supabase disable language fallback:', err.message);
    }
  }

  const store = getEventMemoryStore(projectId);
  const existing = store.languages.get(langCode);
  if (existing) {
    existing.is_enabled = false;
    existing.publication_status = 'draft';
    existing.updated_at = new Date().toISOString();
    return true;
  }
  return false;
}

export async function setDefaultLanguage(projectId: string, langCode: string): Promise<boolean> {
  const supabase = trySupabase();
  if (supabase) {
    try {
      // 1. Set all to false
      await supabase
        .from('event_languages')
        .update({ is_default: false })
        .eq('event_id', projectId);

      // 2. Set chosen to true, enabled and published
      const { error } = await supabase
        .from('event_languages')
        .update({ is_default: true, is_enabled: true, publication_status: 'published', updated_at: new Date().toISOString() })
        .eq('event_id', projectId)
        .eq('language_code', langCode);

      if (!error) return true;
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[TranslationService] Supabase setDefaultLanguage fallback:', err.message);
    }
  }

  const store = getEventMemoryStore(projectId);
  store.languages.forEach((l) => {
    l.is_default = (l.language_code === langCode);
    if (l.language_code === langCode) {
      l.is_enabled = true;
      l.publication_status = 'published';
    }
  });
  return true;
}

export async function setLanguagePublicationStatus(
  projectId: string, 
  langCode: string, 
  status: TranslationPublicationStatus
): Promise<boolean> {
  const supabase = trySupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from('event_languages')
        .update({ publication_status: status, updated_at: new Date().toISOString() })
        .eq('event_id', projectId)
        .eq('language_code', langCode);

      if (!error) return true;
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[TranslationService] Supabase setPublicationStatus fallback:', err.message);
    }
  }

  const store = getEventMemoryStore(projectId);
  const existing = store.languages.get(langCode);
  if (existing) {
    existing.publication_status = status;
    existing.updated_at = new Date().toISOString();
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 4. EVENT TRANSLATIONS STORAGE & RETRIEVAL SERVICE
// ---------------------------------------------------------------------------

export async function getEventTranslations(projectId: string, langCode: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  const supabase = trySupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('event_translations')
        .select('content_key, translated_value')
        .eq('event_id', projectId)
        .eq('language_code', langCode);

      if (!error && data) {
        data.forEach((row: any) => {
          result[row.content_key] = row.translated_value;
        });
        return result;
      }
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[TranslationService] Supabase getTranslations fallback:', err.message);
    }
  }

  const store = getEventMemoryStore(projectId);
  store.translations.forEach((t) => {
    if (t.language_code === langCode) {
      result[t.content_key] = t.translated_value;
    }
  });

  return result;
}

export async function getAllEventTranslations(projectId: string, langCode?: string): Promise<EventTranslation[]> {
  const supabase = trySupabase();
  if (supabase) {
    try {
      let query = supabase
        .from('event_translations')
        .select('*')
        .eq('event_id', projectId);

      if (langCode) query = query.eq('language_code', langCode);

      const { data, error } = await query.order('content_key', { ascending: true });
      if (!error && data) return data;
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[TranslationService] Supabase getAllTranslations fallback:', err.message);
    }
  }

  const store = getEventMemoryStore(projectId);
  const result: EventTranslation[] = [];
  store.translations.forEach((t) => {
    if (!langCode || t.language_code === langCode) {
      result.push(t);
    }
  });

  return result.sort((a, b) => a.content_key.localeCompare(b.content_key));
}

export async function saveEventTranslation(
  projectId: string,
  langCodeOrPayload: string | {
    language_code: string;
    content_key: string;
    translated_value: string;
    source_hash?: string;
    translation_status?: TranslationStatus;
  },
  contentKeyArg?: string,
  translatedValueArg?: string,
  sourceHashArg?: string,
  statusArg?: TranslationStatus
): Promise<EventTranslation> {
  let langCode: string;
  let contentKey: string;
  let translatedValue: string;
  let sourceHash: string;
  let status: TranslationStatus;

  if (typeof langCodeOrPayload === 'object' && langCodeOrPayload !== null) {
    langCode = langCodeOrPayload.language_code;
    contentKey = langCodeOrPayload.content_key;
    translatedValue = langCodeOrPayload.translated_value;
    sourceHash = langCodeOrPayload.source_hash || calculateSourceHash(translatedValue);
    status = langCodeOrPayload.translation_status || 'translated';
  } else {
    langCode = typeof langCodeOrPayload === 'string' ? langCodeOrPayload : '';
    contentKey = contentKeyArg || '';
    translatedValue = translatedValueArg || '';
    sourceHash = sourceHashArg || calculateSourceHash(translatedValue);
    status = statusArg || 'translated';
  }

  const translationRecord: EventTranslation = {
    id: genId('trn'),
    event_id: projectId,
    language_code: langCode,
    content_key: contentKey,
    translated_value: translatedValue,
    source_hash: sourceHash,
    translation_status: status,
    updated_at: new Date().toISOString()
  };

  const supabase = trySupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('event_translations')
        .upsert(
          {
            event_id: projectId,
            language_code: langCode,
            content_key: contentKey,
            translated_value: translatedValue,
            source_hash: translationRecord.source_hash,
            translation_status: status,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'event_id, language_code, content_key' }
        )
        .select()
        .single();

      if (!error && data) return data;
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[TranslationService] Supabase saveTranslation fallback:', err.message);
    }
  }

  const store = getEventMemoryStore(projectId);
  const key = `${langCode}:${contentKey}`;
  store.translations.set(key, translationRecord);
  return translationRecord;
}

// ---------------------------------------------------------------------------
// 5. AUTO TRANSLATION ENGINE WITH CONTENT CHANGE DETECTION
// ---------------------------------------------------------------------------

export async function autoTranslateEvent(
  projectId: string,
  targetLang: string,
  websiteConfig: any,
  projectDataOrGroom?: any,
  brideNameParam?: string
): Promise<{ success: boolean; translatedCount: number; errors?: string[] }> {
  let groomName: string | undefined;
  let brideName: string | undefined;

  if (typeof projectDataOrGroom === 'string') {
    groomName = projectDataOrGroom;
    brideName = brideNameParam;
  } else if (projectDataOrGroom && typeof projectDataOrGroom === 'object') {
    groomName = projectDataOrGroom.groom_name || projectDataOrGroom.groom;
    brideName = projectDataOrGroom.bride_name || projectDataOrGroom.bride;
  }

  // Extract all translatable items from the current website config
  const items = extractTranslatableItems(websiteConfig);
  if (items.length === 0) {
    return { success: true, translatedCount: 0 };
  }

  // Fetch current stored translations to check hashes
  const existingTranslations = await getAllEventTranslations(projectId, targetLang);
  const existingMap = new Map<string, EventTranslation>();
  existingTranslations.forEach((t) => existingMap.set(t.content_key, t));

  // Determine items requiring translation vs items with changed source
  const itemsToTranslate: { key: string; text: string }[] = [];
  const itemsNeedingReview: string[] = [];

  for (const item of items) {
    const existing = existingMap.get(item.key);
    const currentHash = calculateSourceHash(item.sourceText);

    if (!existing) {
      // Missing translation -> needs auto-translation
      itemsToTranslate.push({ key: item.key, text: item.sourceText });
    } else if (existing.source_hash && existing.source_hash !== currentHash) {
      // Source content changed! Flag as needing review or retranslate
      itemsNeedingReview.push(item.key);
      itemsToTranslate.push({ key: item.key, text: item.sourceText });
    }
  }

  if (itemsToTranslate.length === 0) {
    return { success: true, translatedCount: 0 };
  }

  // Execute batch translation via provider
  const translated = await defaultProvider.translateBatch(
    itemsToTranslate,
    targetLang,
    'en',
    {
      groom: groomName,
      bride: brideName,
      eventTitle: typeof projectDataOrGroom === 'object' ? projectDataOrGroom?.name : undefined
    }
  );

  let successCount = 0;
  for (const t of translated) {
    const sourceItem = items.find((i) => i.key === t.key);
    const hash = sourceItem ? calculateSourceHash(sourceItem.sourceText) : '';
    await saveEventTranslation(
      projectId,
      targetLang,
      t.key,
      t.translatedText,
      hash,
      'auto_translated'
    );
    successCount++;
  }

  return { success: true, translatedCount: successCount };
}

// ---------------------------------------------------------------------------
// 6. GUEST MESSAGE TRANSLATE-TO-VIEW (Optional guest message viewing)
// ---------------------------------------------------------------------------

export async function translateGuestMessage(
  messageText: string,
  targetLang: string
): Promise<{ originalText: string; translatedText: string }> {
  if (!messageText || messageText.trim() === '') {
    return { originalText: messageText, translatedText: '' };
  }
  const result = await defaultProvider.translateBatch(
    [{ key: 'msg', text: messageText }],
    targetLang,
    'auto'
  );
  const translated = result[0]?.translatedText || messageText;
  return {
    originalText: messageText,
    translatedText: translated
  };
}

