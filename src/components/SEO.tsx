import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SEO_CONFIG } from '../seo/config';
import { getRouteMetadata } from '../seo/routes';
import { buildCanonicalUrl } from '../seo/canonical';
import { getStructuredDataForType } from '../seo/structuredData';

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

  useEffect(() => {
    // 1. Resolve base metadata for current route
    const routeMeta = getRouteMetadata(location.pathname);

    // 2. Merge overrides
    const finalTitle = propTitle || routeMeta.title || SEO_CONFIG.defaultTitle;
    const finalDescription = propDescription || routeMeta.description || SEO_CONFIG.defaultDescription;
    const finalNoindex = propNoindex !== undefined ? propNoindex : routeMeta.noindex;
    const finalNofollow = propNofollow !== undefined ? propNofollow : routeMeta.nofollow;
    const finalOgType = propOgType || routeMeta.ogType || 'website';
    const finalOgImage = propOgImage || routeMeta.ogImage || SEO_CONFIG.defaultOgImage;
    const finalOgImageAlt = propOgImageAlt || routeMeta.ogImageAlt || SEO_CONFIG.defaultOgImageAlt;
    const finalTwitterCard = propTwitterCard || routeMeta.twitterCard || SEO_CONFIG.twitterCard;
    const finalStructuredDataType = propStructuredDataType || routeMeta.structuredDataType;

    // 3. Resolve canonical URL safely
    const finalCanonicalUrl = propCanonical || buildCanonicalUrl(
      routeMeta.canonicalPath || location.pathname,
      location.search,
      customDomain
    );

    // 4. Update Document Title
    document.title = finalTitle;

    // 5. Update Standard Meta Tags
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

    // 7. Update Canonical Tag
    updateLinkTag('canonical', finalCanonicalUrl);

    // 8. Update Open Graph Tags
    updateMetaTag('property', 'og:title', finalTitle);
    updateMetaTag('property', 'og:description', finalDescription);
    updateMetaTag('property', 'og:url', finalCanonicalUrl);
    updateMetaTag('property', 'og:type', finalOgType);
    updateMetaTag('property', 'og:site_name', SEO_CONFIG.siteName);
    updateMetaTag('property', 'og:image', finalOgImage);
    updateMetaTag('property', 'og:image:alt', finalOgImageAlt);

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
