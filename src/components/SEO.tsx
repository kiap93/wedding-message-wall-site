import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SEO_CONFIG } from '../seo/config';
import { getRouteMetadata } from '../seo/routes';
import {
  buildCanonicalUrl,
  buildMarketingHreflangLinks,
  normalizePathname,
} from '../seo/canonical';
import { getStructuredDataForType } from '../seo/structuredData';
import {
  useMarketingTranslation,
  isPublicMarketingPath,
} from '../lib/i18n/MarketingTranslationContext';

export interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
  nofollow?: boolean;
  ogImage?: string;
  ogImageAlt?: string;
  ogType?: 'website' | 'article';
  twitterCard?: 'summary' | 'summary_large_image';
  structuredDataType?: 'SoftwareApplication' | 'WebSite' | 'Organization';
  customDomain?: string | null;
}

const OG_LOCALES: Record<string, string> = {
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
    .querySelectorAll('link[data-ef-marketing-hreflang="true"]')
    .forEach((el) => el.remove());

  if (!links) return;

  links.forEach(({ hreflang, href }) => {
    const linkEl = document.createElement('link');
    linkEl.setAttribute('rel', 'alternate');
    linkEl.setAttribute('hreflang', hreflang);
    linkEl.setAttribute('href', href);
    linkEl.setAttribute('data-ef-marketing-hreflang', 'true');
    document.head.appendChild(linkEl);
  });
}

function updateJsonLd(schema: any) {
  let script = document.getElementById('eventframe-schema-jsonld') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'eventframe-schema-jsonld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(schema);
}

export const SEO: React.FC<SEOProps> = ({
  title: propTitle,
  description: propDescription,
  canonical: propCanonical,
  noindex: propNoindex,
  nofollow: propNofollow,
  ogImage: propOgImage,
  ogImageAlt: propOgImageAlt,
  ogType: propOgType,
  twitterCard: propTwitterCard,
  structuredDataType: propStructuredDataType,
  customDomain,
}) => {
  const location = useLocation();
  const { currentLanguage, t } = useMarketingTranslation();

  useEffect(() => {
    const normalizedPath = normalizePathname(location.pathname);
    const isMarketingRoute = isPublicMarketingPath(normalizedPath);

    // 1. Resolve base metadata for current route
    const routeMeta = getRouteMetadata(location.pathname);

    // 2. Resolve localized SEO metadata for public marketing pages
    let localizedTitle: string | undefined;
    let localizedDescription: string | undefined;
    if (isMarketingRoute) {
      const routeKey = routeMeta.canonicalPath || normalizedPath;
      const titleKey = `seo.routes.${routeKey}.title`;
      const descKey = `seo.routes.${routeKey}.description`;
      const translatedTitle = t(titleKey);
      const translatedDesc = t(descKey);
      if (translatedTitle !== titleKey) localizedTitle = translatedTitle;
      if (translatedDesc !== descKey) localizedDescription = translatedDesc;

      document.documentElement.lang = currentLanguage;
    }

    // 3. Merge overrides
    const finalTitle =
      propTitle || localizedTitle || routeMeta.title || SEO_CONFIG.defaultTitle;
    const finalDescription =
      propDescription ||
      localizedDescription ||
      routeMeta.description ||
      SEO_CONFIG.defaultDescription;
    const finalNoindex = propNoindex !== undefined ? propNoindex : routeMeta.noindex;
    const finalNofollow = propNofollow !== undefined ? propNofollow : routeMeta.nofollow;
    const finalOgType = propOgType || routeMeta.ogType || 'website';
    const finalOgImage = propOgImage || routeMeta.ogImage || SEO_CONFIG.defaultOgImage;
    const finalOgImageAlt =
      propOgImageAlt || routeMeta.ogImageAlt || SEO_CONFIG.defaultOgImageAlt;
    const finalTwitterCard =
      propTwitterCard || routeMeta.twitterCard || SEO_CONFIG.twitterCard;
    const finalStructuredDataType =
      propStructuredDataType || routeMeta.structuredDataType;

    // 4. Resolve canonical URL safely (include ?lang= for active non-default marketing language)
    let canonicalSearch = location.search;
    if (isMarketingRoute) {
      const params = new URLSearchParams(location.search);
      if (currentLanguage === 'en') {
        params.delete('lang');
      } else {
        params.set('lang', currentLanguage);
      }
      const str = params.toString();
      canonicalSearch = str ? `?${str}` : '';
    }

    const finalCanonicalUrl =
      propCanonical ||
      buildCanonicalUrl(
        routeMeta.canonicalPath || location.pathname,
        canonicalSearch,
        customDomain
      );

    // 5. Update Document Title & Description
    document.title = finalTitle;
    updateMetaTag('name', 'description', finalDescription);

    // 6. Update Robots Directives
    let robotsValue = 'index, follow';
    if (finalNoindex && finalNofollow) {
      robotsValue = 'noindex, nofollow';
    } else if (finalNoindex) {
      robotsValue = 'noindex, follow';
    } else if (finalNofollow) {
      robotsValue = 'index, nofollow';
    }
    updateMetaTag('name', 'robots', robotsValue);

    // 7. Update Canonical & Alternate hreflang Tags
    updateLinkTag('canonical', finalCanonicalUrl);
    if (isMarketingRoute) {
      syncMarketingHreflangTags(
        buildMarketingHreflangLinks(routeMeta.canonicalPath || normalizedPath, customDomain)
      );
    } else {
      syncMarketingHreflangTags(null);
    }

    // 8. Update Open Graph Tags
    updateMetaTag('property', 'og:title', finalTitle);
    updateMetaTag('property', 'og:description', finalDescription);
    updateMetaTag('property', 'og:url', finalCanonicalUrl);
    updateMetaTag('property', 'og:type', finalOgType);
    updateMetaTag('property', 'og:site_name', SEO_CONFIG.siteName);
    updateMetaTag('property', 'og:image', finalOgImage);
    updateMetaTag('property', 'og:image:alt', finalOgImageAlt);
    updateMetaTag(
      'property',
      'og:locale',
      isMarketingRoute ? OG_LOCALES[currentLanguage] || SEO_CONFIG.defaultLocale : SEO_CONFIG.defaultLocale
    );

    // 9. Update Twitter / X Cards
    updateMetaTag('name', 'twitter:card', finalTwitterCard);
    updateMetaTag('name', 'twitter:title', finalTitle);
    updateMetaTag('name', 'twitter:description', finalDescription);
    updateMetaTag('name', 'twitter:image', finalOgImage);
    updateMetaTag('name', 'twitter:site', SEO_CONFIG.twitterSite);

    // 10. Inject Structured Data JSON-LD
    const schemas = getStructuredDataForType(finalStructuredDataType);
    updateJsonLd(schemas);
  }, [
    location.pathname,
    location.search,
    currentLanguage,
    t,
    propTitle,
    propDescription,
    propCanonical,
    propNoindex,
    propNofollow,
    propOgImage,
    propOgImageAlt,
    propOgType,
    propTwitterCard,
    propStructuredDataType,
    customDomain,
  ]);

  return null;
};

export default SEO;
