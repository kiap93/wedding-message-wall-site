/**
 * Wedding Terminology Glossary & Content Extraction / Change Detection Helpers
 */

export interface GlossaryTerm {
  source: string;
  translations: Record<string, string>;
  category: 'role' | 'event' | 'action' | 'etiquette';
}

export const WEDDING_GLOSSARY: GlossaryTerm[] = [
  {
    source: 'Bride',
    translations: {
      'zh-CN': '新娘',
      'zh-TW': '新娘',
      'ms': 'Pengantin Perempuan'
    },
    category: 'role'
  },
  {
    source: 'Groom',
    translations: {
      'zh-CN': '新郎',
      'zh-TW': '新郎',
      'ms': 'Pengantin Lelaki'
    },
    category: 'role'
  },
  {
    source: 'Wedding Ceremony',
    translations: {
      'zh-CN': '结婚典礼',
      'zh-TW': '結婚典禮',
      'ms': 'Upacara Akad Nikah'
    },
    category: 'event'
  },
  {
    source: 'Wedding Reception',
    translations: {
      'zh-CN': '婚宴盛席',
      'zh-TW': '婚宴盛席',
      'ms': 'Jamuan Resepsi Perkahwinan'
    },
    category: 'event'
  },
  {
    source: 'Joyfully Accepts',
    translations: {
      'zh-CN': '欣然赴约',
      'zh-TW': '欣然赴約',
      'ms': 'Hadir dengan Sukacita'
    },
    category: 'action'
  },
  {
    source: 'Regretfully Declines',
    translations: {
      'zh-CN': '遗憾缺席',
      'zh-TW': '遺憾缺席',
      'ms': 'Tidak Dapat Hadir'
    },
    category: 'action'
  },
  {
    source: 'Dress Code',
    translations: {
      'zh-CN': '着装要求',
      'zh-TW': '著裝規範',
      'ms': 'Etika Pakaian'
    },
    category: 'etiquette'
  },
  {
    source: 'RSVP Confirmation',
    translations: {
      'zh-CN': '出席回函确认',
      'zh-TW': '出席回函確認',
      'ms': 'Pengesahan Kehadiran'
    },
    category: 'action'
  }
];

/**
 * Fast string hash for source content change detection
 */
export function calculateSourceHash(text: string): string {
  if (!text) return 'empty';
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `h_${Math.abs(hash).toString(36)}`;
}

/**
 * Replace placeholders like {{deadline}}, {{groom}}, {{bride}}
 */
export function interpolateVariables(template: string, params?: Record<string, string | number>): string {
  if (!template || !params) return template || '';
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    return params[key] !== undefined ? String(params[key]) : match;
  });
}

export interface TranslatableItem {
  key: string;
  sourceText: string;
  sectionId?: string;
  sectionType?: string;
  field: string;
  label: string;
}

/**
 * Extract translatable content keys from a WebsiteConfig
 */
export function extractTranslatableItems(config: any): TranslatableItem[] {
  if (!config || !Array.isArray(config.sections)) return [];

  const items: TranslatableItem[] = [];

  // 1. Global site settings
  if (config.settings) {
    if (config.settings.announcementBar) {
      items.push({
        key: 'settings.announcementBar',
        sourceText: config.settings.announcementBar,
        field: 'announcementBar',
        label: 'Announcement Ribbon'
      });
    }
  }

  // 2. SEO defaults
  if (config.seo) {
    if (config.seo.pageTitle) {
      items.push({
        key: 'seo.pageTitle',
        sourceText: config.seo.pageTitle,
        field: 'pageTitle',
        label: 'SEO Page Title'
      });
    }
    if (config.seo.metaDescription) {
      items.push({
        key: 'seo.metaDescription',
        sourceText: config.seo.metaDescription,
        field: 'metaDescription',
        label: 'SEO Meta Description'
      });
    }
  }

  // 3. Section specific contents
  config.sections.forEach((section: any) => {
    const sId = section.id || section.type;
    const content = section.content || {};

    if (content.badge) {
      items.push({
        key: `section.${sId}.badge`,
        sourceText: content.badge,
        sectionId: sId,
        sectionType: section.type,
        field: 'badge',
        label: `${section.type.toUpperCase()}: Tag / Badge`
      });
    }

    if (content.headline) {
      items.push({
        key: `section.${sId}.headline`,
        sourceText: content.headline,
        sectionId: sId,
        sectionType: section.type,
        field: 'headline',
        label: `${section.type.toUpperCase()}: Main Headline`
      });
    }

    if (content.venueName) {
      items.push({
        key: `section.${sId}.venueName`,
        sourceText: content.venueName,
        sectionId: sId,
        sectionType: section.type,
        field: 'venueName',
        label: `${section.type.toUpperCase()}: Venue Name`
      });
    }

    if (content.address) {
      items.push({
        key: `section.${sId}.address`,
        sourceText: content.address,
        sectionId: sId,
        sectionType: section.type,
        field: 'address',
        label: `${section.type.toUpperCase()}: Address`
      });
    }

    if (content.buttonText) {
      items.push({
        key: `section.${sId}.buttonText`,
        sourceText: content.buttonText,
        sectionId: sId,
        sectionType: section.type,
        field: 'buttonText',
        label: `${section.type.toUpperCase()}: Button Text`
      });
    }

    if (content.thankYouMessage) {
      items.push({
        key: `section.${sId}.thankYouMessage`,
        sourceText: content.thankYouMessage,
        sectionId: sId,
        sectionType: section.type,
        field: 'thankYouMessage',
        label: `${section.type.toUpperCase()}: Thank You Message`
      });
    }

    if (content.subheadline) {
      items.push({
        key: `section.${sId}.subheadline`,
        sourceText: content.subheadline,
        sectionId: sId,
        sectionType: section.type,
        field: 'subheadline',
        label: `${section.type.toUpperCase()}: Subtitle / Description`
      });
    }

    if (content.bio) {
      items.push({
        key: `section.${sId}.bio`,
        sourceText: content.bio,
        sectionId: sId,
        sectionType: section.type,
        field: 'bio',
        label: `${section.type.toUpperCase()}: Couple Story Bio`
      });
    }

    if (content.groomBio) {
      items.push({
        key: `section.${sId}.groomBio`,
        sourceText: content.groomBio,
        sectionId: sId,
        sectionType: section.type,
        field: 'groomBio',
        label: `${section.type.toUpperCase()}: Groom Bio`
      });
    }

    if (content.brideBio) {
      items.push({
        key: `section.${sId}.brideBio`,
        sourceText: content.brideBio,
        sectionId: sId,
        sectionType: section.type,
        field: 'brideBio',
        label: `${section.type.toUpperCase()}: Bride Bio`
      });
    }

    if (content.directions) {
      items.push({
        key: `section.${sId}.directions`,
        sourceText: content.directions,
        sectionId: sId,
        sectionType: section.type,
        field: 'directions',
        label: `${section.type.toUpperCase()}: Driving Directions`
      });
    }

    if (content.attire) {
      items.push({
        key: `section.${sId}.attire`,
        sourceText: content.attire,
        sectionId: sId,
        sectionType: section.type,
        field: 'attire',
        label: `${section.type.toUpperCase()}: Attire Guidelines`
      });
    }

    if (content.parking) {
      items.push({
        key: `section.${sId}.parking`,
        sourceText: content.parking,
        sectionId: sId,
        sectionType: section.type,
        field: 'parking',
        label: `${section.type.toUpperCase()}: Parking Information`
      });
    }

    // Milestones (Story section)
    if (Array.isArray(content.milestones)) {
      content.milestones.forEach((m: any, idx: number) => {
        if (m.title) {
          items.push({
            key: `section.${sId}.milestones.${idx}.title`,
            sourceText: m.title,
            sectionId: sId,
            sectionType: section.type,
            field: `milestone_${idx}_title`,
            label: `Story Milestone ${idx + 1}: Title`
          });
        }
        if (m.description) {
          items.push({
            key: `section.${sId}.milestones.${idx}.description`,
            sourceText: m.description,
            sectionId: sId,
            sectionType: section.type,
            field: `milestone_${idx}_description`,
            label: `Story Milestone ${idx + 1}: Description`
          });
        }
      });
    }

    // Schedule Events
    if (Array.isArray(content.events)) {
      content.events.forEach((ev: any, idx: number) => {
        if (ev.title) {
          items.push({
            key: `section.${sId}.events.${idx}.title`,
            sourceText: ev.title,
            sectionId: sId,
            sectionType: section.type,
            field: `event_${idx}_title`,
            label: `Itinerary Event ${idx + 1}: Title`
          });
        }
        if (ev.description) {
          items.push({
            key: `section.${sId}.events.${idx}.description`,
            sourceText: ev.description,
            sectionId: sId,
            sectionType: section.type,
            field: `event_${idx}_description`,
            label: `Itinerary Event ${idx + 1}: Description`
          });
        }
      });
    }

    // FAQ Items
    if (Array.isArray(content.faqItems)) {
      content.faqItems.forEach((faq: any, idx: number) => {
        if (faq.question) {
          items.push({
            key: `section.${sId}.faqItems.${idx}.question`,
            sourceText: faq.question,
            sectionId: sId,
            sectionType: section.type,
            field: `faq_${idx}_question`,
            label: `FAQ ${idx + 1}: Question`
          });
        }
        if (faq.answer) {
          items.push({
            key: `section.${sId}.faqItems.${idx}.answer`,
            sourceText: faq.answer,
            sectionId: sId,
            sectionType: section.type,
            field: `faq_${idx}_answer`,
            label: `FAQ ${idx + 1}: Answer`
          });
        }
      });
    }
  });

  return items;
}
