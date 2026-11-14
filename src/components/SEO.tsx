import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SEO_CONFIG } from '../seo/config';
import { resolveRouteMetadata } from '../seo/routes';
import {
  buildCanonicalUrl,
  buildMarketingHreflangLinks,
  isLocalizedMarketingBasePath,
  normalizePathname,
} from '../seo/canonical';
import { buildPageStructuredData } from '../seo/structuredData';
import { StructuredDataType } from '../seo/metadata';
import { useMarketingTranslation } from '../lib/i18n/MarketingTranslationContext';

export interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  noindex?: boolean;
  nofollow?: boolean;
  ogImage?: string;
  ogImageAlt?: string;
  ogType?: 'website' | 'article';
  twitterCard?: 'summary' | 'summary_large_image';
  structuredDataType?: StructuredDataType;
  customSchemas?: Record<string, any>[];
  hreflangLinks?: Array<{ hreflang: string; href: string }>;
  inLanguage?: string;
  disableMarketingHreflang?: boolean;
  customDomain?: string | null;
}

interface SEOOverrideContextValue {
  override: SEOProps | null;
  setOverride: React.Dispatch<React.SetStateAction<SEOProps | null>>;
}

const SEOOverrideContext = createContext<SEOOverrideContextValue | null>(null);

export const SEOProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [override, setOverride] = useState<SEOProps | null>(null);
  return (
    <SEOOverrideContext.Provider value={{ override, setOverride }}>
      {children}
    </SEOOverrideContext.Provider>
  );
};

/**
 * Registers dynamic route-specific SEO overrides (e.g., published WeddingWebsite or BlogPostPage)
 * with the single global <SEO /> component so only one canonical, robots, and JSON-LD block exists.
 */
export const PageSEO: React.FC<SEOProps> = (props) => {
  const ctx = useContext(SEOOverrideContext);
  const {
    title,
    description,
    keywords,
    canonical,
    noindex,
    nofollow,
    ogImage,
    ogImageAlt,
    ogType,
    twitterCard,
    structuredDataType,
    customSchemas,
    hreflangLinks,
    inLanguage,
    disableMarketingHreflang,
    customDomain,
  } = props;

  useEffect(() => {
    if (!ctx) return;
    ctx.setOverride({
      title,
      description,
      keywords,
      canonical,
      noindex,
      nofollow,
      ogImage,
      ogImageAlt,
      ogType,
      twitterCard,
      structuredDataType,
      customSchemas,
      hreflangLinks,
      inLanguage,
      disableMarketingHreflang,
      customDomain,
    });
    return () => {
      ctx.setOverride(null);
    };
  }, [
    ctx,
    title,
    description,
    keywords,
    canonical,
    noindex,
    nofollow,
    ogImage,
    ogImageAlt,
    ogType,
    twitterCard,
    structuredDataType,
    customSchemas,
    hreflangLinks,
    inLanguage,
    disableMarketingHreflang,
    customDomain,
  ]);

  return null;
};

export const OG_LOCALES: Record<string, string> = {
  en: 'en_US',
  'zh-CN': 'zh_CN',
  'zh-TW': 'zh_TW',
  ms: 'ms_MY',
};

function updateMetaTag(attributeName: string, attributeValue: string, content: string) {
  let element = document.querySelector(`meta[${attributeName}="${attributeValue}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attributeName, attributeValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function removeMetaTag(attributeName: string, attributeValue: string) {
  const el = document.querySelector(`meta[${attributeName}="${attributeValue}"]`);
  if (el) el.remove();
}

function updateLinkTag(rel: string, href: string) {
  let element = document.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

function syncMarketingHreflangTags(links: Array<{ hreflang: string; href: string }> | null) {
  document
    .querySelectorAll('link[rel="alternate"][hreflang]')
    .forEach((el) => el.remove());

  if (!links || links.length === 0) return;

  links.forEach(({ hreflang, href }) => {
    const linkEl = document.createElement('link');
    linkEl.setAttribute('rel', 'alternate');
    linkEl.setAttribute('hreflang', hreflang);
    linkEl.setAttribute('href', href);
    linkEl.setAttribute('data-ef-marketing-hreflang', 'true');
    document.head.appendChild(linkEl);
  });
}

function updateJsonLd(schemas: Record<string, any>[]) {
  // Remove any legacy secondary script tags to enforce single authoritative JSON-LD block
  const legacyWeddingScript = document.getElementById('eventframe-wedding-jsonld');
  if (legacyWeddingScript) legacyWeddingScript.remove();

  let script = document.getElementById('eventframe-schema-jsonld') as HTMLScriptElement | null;
  if (!schemas || schemas.length === 0) {
    if (script) script.remove();
    return;
  }

  if (!script) {
    script = document.createElement('script');
    script.id = 'eventframe-schema-jsonld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(schemas);
}

export const SEO: React.FC<SEOProps> = (props) => {
  const location = useLocation();
  const { currentLanguage, t } = useMarketingTranslation();
  const overrideCtx = useContext(SEOOverrideContext);
  const activeOverride = overrideCtx?.override || null;

  useEffect(() => {
    const merged: SEOProps = { ...props, ...(activeOverride || {}) };
    const normalizedPath = normalizePathname(location.pathname);
    const { meta: routeMeta, lang: pathLang, basePath } = resolveRouteMetadata(normalizedPath);
    const isLocalizedMarketing = isLocalizedMarketingBasePath(basePath);
    const effectiveLang = merged.inLanguage
      ? merged.inLanguage
      : isLocalizedMarketing
        ? pathLang !== 'en'
          ? pathLang
          : currentLanguage
        : 'en';

    // Localized marketing route title/description lookup
    let localizedTitle: string | undefined;
    let localizedDescription: string | undefined;
    if (isLocalizedMarketing) {
      const titleKey = `seo.routes.${basePath}.title`;
      const descKey = `seo.routes.${basePath}.description`;
      const translatedTitle = t(titleKey);
      const translatedDesc = t(descKey);
      if (translatedTitle !== titleKey) localizedTitle = translatedTitle;
      if (translatedDesc !== descKey) localizedDescription = translatedDesc;
      document.documentElement.lang = effectiveLang;
    }

    const finalTitle =
      merged.title || localizedTitle || routeMeta.title || SEO_CONFIG.defaultTitle;
    const finalDescription =
      merged.description ||
      localizedDescription ||
      routeMeta.description ||
      SEO_CONFIG.defaultDescription;
    const finalNoindex = merged.noindex !== undefined ? merged.noindex : routeMeta.noindex;
    const finalNofollow = merged.nofollow !== undefined ? merged.nofollow : routeMeta.nofollow;
    const finalOgType = merged.ogType || routeMeta.ogType || 'website';
    const finalOgImage = merged.ogImage || routeMeta.ogImage || SEO_CONFIG.defaultOgImage;
    const finalOgImageAlt =
      merged.ogImageAlt || routeMeta.ogImageAlt || SEO_CONFIG.defaultOgImageAlt;
    const finalTwitterCard =
      merged.twitterCard || routeMeta.twitterCard || SEO_CONFIG.twitterCard;
    const finalStructuredDataType =
      merged.structuredDataType || routeMeta.structuredDataType;

    const canonicalTarget =
      merged.canonical ||
      buildCanonicalUrl(
        routeMeta.canonicalPath || normalizedPath,
        isLocalizedMarketing ? undefined : location.search,
        merged.customDomain
      );

    // 1. Title & Description & Keywords
    document.title = finalTitle;
    updateMetaTag('name', 'description', finalDescription);
    if (merged.keywords) {
      updateMetaTag('name', 'keywords', merged.keywords);
    } else if (routeMeta.keywords && routeMeta.keywords.length > 0) {
      updateMetaTag('name', 'keywords', routeMeta.keywords.join(', '));
    } else {
      removeMetaTag('name', 'keywords');
    }

    // 2. Robots
    let robotsValue = 'index, follow';
    if (finalNoindex && finalNofollow) {
      robotsValue = 'noindex, nofollow';
    } else if (finalNoindex) {
      robotsValue = 'noindex, follow';
    } else if (finalNofollow) {
      robotsValue = 'index, nofollow';
    }
    updateMetaTag('name', 'robots', robotsValue);

    // 3. Canonical & hreflang alternates
    updateLinkTag('canonical', canonicalTarget);
    if (isLocalizedMarketing && !merged.disableMarketingHreflang && !finalNoindex) {
      syncMarketingHreflangTags(
        merged.hreflangLinks && merged.hreflangLinks.length > 0
          ? merged.hreflangLinks
          : buildMarketingHreflangLinks(basePath, merged.customDomain)
      );
    } else {
      syncMarketingHreflangTags(null);
    }

    // 4. Open Graph
    updateMetaTag('property', 'og:title', finalTitle);
    updateMetaTag('property', 'og:description', finalDescription);
    updateMetaTag('property', 'og:url', canonicalTarget);
    updateMetaTag('property', 'og:type', finalOgType);
    updateMetaTag('property', 'og:site_name', SEO_CONFIG.siteName);
    updateMetaTag('property', 'og:image', finalOgImage);
    updateMetaTag('property', 'og:image:alt', finalOgImageAlt);
    updateMetaTag(
      'property',
      'og:locale',
      OG_LOCALES[effectiveLang] || SEO_CONFIG.defaultLocale
    );

    // 5. Twitter Cards
    updateMetaTag('name', 'twitter:card', finalTwitterCard);
    updateMetaTag('name', 'twitter:title', finalTitle);
    updateMetaTag('name', 'twitter:description', finalDescription);
    updateMetaTag('name', 'twitter:image', finalOgImage);
    updateMetaTag('name', 'twitter:site', SEO_CONFIG.twitterSite);

    // 6. Authoritative Single Structured Data JSON-LD Block
    const schemas = buildPageStructuredData({
      type: finalStructuredDataType,
      title: finalTitle,
      description: finalDescription,
      canonicalUrl: canonicalTarget,
      inLanguage: OG_LOCALES[effectiveLang]?.replace('_', '-') || 'en-US',
      breadcrumbs: routeMeta.breadcrumbs,
      customSchemas: merged.customSchemas,
      noindex: Boolean(finalNoindex),
    });
    updateJsonLd(schemas);
  }, [location.pathname, location.search, currentLanguage, t, props, activeOverride]);

  return null;
};

export default SEO;
