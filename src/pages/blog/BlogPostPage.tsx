import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronDown,
  Clock,
  Check,
  Info,
} from 'lucide-react';
import MarketingLayout from '../../layouts/MarketingLayout';
import Button from '../../design-system/components/Button';
import { OG_LOCALES, PageSEO } from '../../components/SEO';
import { SEO_CONFIG } from '../../seo/config';
import {
  getArticleSchema,
  getBreadcrumbListSchema,
  getOrganizationSchema,
} from '../../seo/structuredData';
import { useMarketingTranslation } from '../../lib/i18n/MarketingTranslationContext';
import {
  buildBlogIndexPath,
  buildBlogPostHreflangLinks,
  buildBlogPostPath,
  getAdjacentBlogPosts,
  getBlogPostBySlug,
  getBlogUiLabels,
  getRelatedBlogPosts,
} from '../../content/blog';

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { currentLanguage, getLocalizedPath } = useMarketingTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const post = slug ? getBlogPostBySlug(slug, currentLanguage) : undefined;
  const activeUiLang = post ? post.resolvedLanguage : currentLanguage;
  const ui = getBlogUiLabels(activeUiLang);
  const localizedHomePath = getLocalizedPath('/');
  const localizedBlogIndexPath = buildBlogIndexPath(activeUiLang);

  if (!post) {
    return (
      <MarketingLayout>
        <PageSEO
          title={ui.notFoundSeoTitle}
          description={ui.notFoundSeoDescription}
          noindex={true}
          nofollow={true}
          disableMarketingHreflang={true}
        />
        <div className="max-w-3xl mx-auto px-6 py-24 text-center space-y-4">
          <h1 className="font-serif text-3xl text-[#252525]">{ui.notFoundTitle}</h1>
          <p className="text-sm text-[#777777]">{ui.notFoundDescription}</p>
          <Button variant="primary" size="md" onClick={() => navigate(localizedBlogIndexPath)}>
            {ui.notFoundCta}
          </Button>
        </div>
      </MarketingLayout>
    );
  }

  const localizedPostPath = buildBlogPostPath(post.id, post.resolvedLanguage);
  const canonicalUrl = `${SEO_CONFIG.productionDomain}${localizedPostPath}`;
  const absoluteImageUrl = post.coverImage.startsWith('http')
    ? post.coverImage
    : `${SEO_CONFIG.productionDomain}${post.coverImage}`;
  const relatedPosts = getRelatedBlogPosts(post, post.resolvedLanguage);
  const { prev: previousPost, next: nextPost } = getAdjacentBlogPosts(post.id, post.resolvedLanguage);
  const hreflangLinks = buildBlogPostHreflangLinks(post.id, SEO_CONFIG.productionDomain);
  const inLanguage = (OG_LOCALES[post.resolvedLanguage] || 'en_US').replace('_', '-');

  const articleSchemas = [
    getOrganizationSchema(),
    getArticleSchema({
      title: post.title,
      description: post.description,
      url: canonicalUrl,
      image: absoluteImageUrl,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
      authorName: post.authorName,
      inLanguage,
    }),
    getBreadcrumbListSchema([
      { name: ui.homeBreadcrumb, path: localizedHomePath },
      { name: ui.journalBreadcrumb, path: localizedBlogIndexPath },
      { name: post.title, path: localizedPostPath },
    ]),
  ];

  return (
    <MarketingLayout>
      <PageSEO
        title={post.seoTitle}
        description={post.description}
        keywords={post.keywords.join(', ')}
        canonical={canonicalUrl}
        noindex={false}
        nofollow={false}
        ogType="article"
        ogImage={absoluteImageUrl}
        ogImageAlt={post.coverImageAlt}
        inLanguage={post.resolvedLanguage}
        hreflangLinks={hreflangLinks}
        customSchemas={articleSchemas}
      />

      <article className="bg-white border-b border-[#E8E8E5]">
        {/* Header & Breadcrumb */}
        <header className="pt-12 pb-10 md:pt-16 md:pb-12 border-b border-[#E8E8E5] bg-[#F7F7F5]">
          <div className="max-w-4xl mx-auto px-6 space-y-6">
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-2 text-xs text-[#777777]"
            >
              <a
                href={localizedHomePath}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(localizedHomePath);
                }}
                className="hover:text-[#252525]"
              >
                {ui.homeBreadcrumb}
              </a>
              <span>/</span>
              <a
                href={localizedBlogIndexPath}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(localizedBlogIndexPath);
                }}
                className="hover:text-[#252525]"
              >
                {ui.journalBreadcrumb}
              </a>
              <span>/</span>
              <span className="text-[#8B806F] font-medium">{post.category}</span>
            </nav>

            {post.isFallback && (
              <div className="flex items-center gap-2 rounded-lg border border-[#E2DCCE] bg-[#FAF7F0] px-4 py-2.5 text-xs text-[#736959]">
                <Info className="w-4 h-4 shrink-0 text-[#8B806F]" />
                <span>{ui.fallbackNotice}</span>
              </div>
            )}

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-[#252525] leading-[1.15]">
              {post.title}
            </h1>

            <p className="text-sm sm:text-base text-[#555555] leading-relaxed max-w-3xl">
              {post.excerpt}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#777777] pt-2">
              <span className="font-medium text-[#252525]">
                {post.authorName} · <span className="font-normal text-[#777777]">{post.authorRole}</span>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1 font-mono">
                <Calendar className="w-3.5 h-3.5 text-[#8B806F]" /> {ui.updatedPrefix} {post.updatedAt}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-[#8B806F]" /> {post.readingTimeMinutes}{' '}
                {ui.minReadSuffix}
              </span>
            </div>
          </div>
        </header>

        {/* Hero Cover */}
        <div className="max-w-4xl mx-auto px-6 -mt-2 pt-10">
          <figure className="rounded-xl overflow-hidden border border-[#E8E8E5] shadow-card bg-[#FAF9F7]">
            <img
              src={post.coverImage}
              alt={post.coverImageAlt}
              width={post.coverImageWidth}
              height={post.coverImageHeight}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="w-full h-auto block object-cover"
            />
          </figure>
        </div>

        {/* Body Sections */}
        <div className="max-w-3xl mx-auto px-6 py-12 space-y-12">
          {post.sections.map((section) => (
            <section key={section.id} id={section.id} className="space-y-4">
              <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#252525]">
                {section.heading}
              </h2>
              {section.paragraphs.map((para, pIdx) => (
                <p key={pIdx} className="text-sm sm:text-[15px] text-[#444444] leading-relaxed">
                  {para}
                </p>
              ))}
              {section.bullets && section.bullets.length > 0 && (
                <ul className="space-y-2.5 pt-2">
                  {section.bullets.map((bullet, bIdx) => (
                    <li key={bIdx} className="flex items-start gap-2.5 text-sm text-[#444444]">
                      <Check className="w-4 h-4 text-[#8B806F] shrink-0 mt-1" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
              {section.callout && (
                <div className="p-5 bg-[#FAF9F7] border border-[#E2DCCE] rounded-lg text-xs sm:text-sm text-[#555555] leading-relaxed">
                  {section.callout}
                </div>
              )}
            </section>
          ))}

          {/* Article FAQs */}
          {post.faqs.length > 0 && (
            <section className="pt-8 border-t border-[#E8E8E5] space-y-5">
              <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#252525]">
                {ui.faqHeading}
              </h2>
              <div className="space-y-3">
                {post.faqs.map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div
                      key={idx}
                      className="bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        className="w-full p-4 text-left flex items-center justify-between gap-4"
                      >
                        <span className="text-xs sm:text-sm font-semibold text-[#252525]">
                          {faq.q}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-[#777777] shrink-0 transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 pt-1 text-xs sm:text-sm text-[#666666] leading-relaxed border-t border-[#EFEFEA]">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Related EventFrame Tools */}
          <section className="p-6 sm:p-8 bg-[#FAF9F7] border border-[#E8E8E5] rounded-xl space-y-5">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#8B806F]">
                {ui.builtIntoEyebrow}
              </span>
              <h2 className="font-serif text-2xl text-[#252525] mt-1">
                {ui.practiceHeading}
              </h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {post.relatedToolLinks.map((tool) => {
                const toolHref = getLocalizedPath(tool.href);
                return (
                  <a
                    key={tool.href}
                    href={toolHref}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(toolHref);
                    }}
                    className="p-4 bg-white hover:border-[#252525] border border-[#E8E8E5] rounded-lg transition-colors space-y-1"
                  >
                    <div className="text-xs font-semibold text-[#252525]">{tool.label}</div>
                    <div className="text-[11px] text-[#777777] leading-relaxed">{tool.desc}</div>
                  </a>
                );
              })}
            </div>
            <div className="pt-2 flex flex-wrap gap-3">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/login')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {ui.createFreeDraftCta}
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate(localizedBlogIndexPath)}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                {ui.allGuidesCta}
              </Button>
            </div>
          </section>

          {/* Previous / Next Article Navigation */}
          {(previousPost || nextPost) && (
            <nav
              aria-label="Article pagination"
              className="pt-8 border-t border-[#E8E8E5] grid sm:grid-cols-2 gap-4"
            >
              {previousPost ? (
                <a
                  href={buildBlogPostPath(previousPost.id, previousPost.resolvedLanguage)}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(buildBlogPostPath(previousPost.id, previousPost.resolvedLanguage));
                  }}
                  className="p-5 bg-white hover:bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg transition-colors space-y-1.5"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-[#8B806F]">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{ui.previousArticleLabel}</span>
                  </div>
                  <div className="font-serif text-base text-[#252525] leading-snug">
                    {previousPost.title}
                  </div>
                </a>
              ) : (
                <div />
              )}

              {nextPost ? (
                <a
                  href={buildBlogPostPath(nextPost.id, nextPost.resolvedLanguage)}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(buildBlogPostPath(nextPost.id, nextPost.resolvedLanguage));
                  }}
                  className="p-5 bg-white hover:bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg transition-colors space-y-1.5 sm:text-right"
                >
                  <div className="flex items-center sm:justify-end gap-1.5 text-[11px] font-mono uppercase text-[#8B806F]">
                    <span>{ui.nextArticleLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                  <div className="font-serif text-base text-[#252525] leading-snug">
                    {nextPost.title}
                  </div>
                </a>
              ) : (
                <div />
              )}
            </nav>
          )}

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <section className="pt-8 border-t border-[#E8E8E5] space-y-5">
              <h2 className="font-serif text-2xl text-[#252525]">{ui.relatedReadingHeading}</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {relatedPosts.slice(0, 2).map((rel) => {
                  const relHref = buildBlogPostPath(rel.id, rel.resolvedLanguage);
                  return (
                    <a
                      key={rel.id}
                      href={relHref}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(relHref);
                      }}
                      className="p-5 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded-lg transition-colors space-y-2"
                    >
                      <span className="text-[10px] font-mono uppercase text-[#8B806F]">
                        {rel.category}
                      </span>
                      <h3 className="font-serif text-lg text-[#252525] leading-snug">{rel.title}</h3>
                      <p className="text-xs text-[#777777] line-clamp-2">{rel.excerpt}</p>
                    </a>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </article>
    </MarketingLayout>
  );
}
