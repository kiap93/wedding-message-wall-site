import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Clock, Calendar } from 'lucide-react';
import MarketingLayout from '../../layouts/MarketingLayout';
import Button from '../../design-system/components/Button';
import { useMarketingTranslation } from '../../lib/i18n/MarketingTranslationContext';
import {
  BLOG_CATEGORIES,
  BlogCategory,
  buildBlogPostPath,
  getAllBlogPosts,
  getBlogCategoryLabel,
  getBlogUiLabels,
} from '../../content/blog';

export default function BlogIndexPage() {
  const navigate = useNavigate();
  const { currentLanguage } = useMarketingTranslation();
  const [selectedCategory, setSelectedCategory] = useState<'all' | BlogCategory>('all');

  const allPosts = getAllBlogPosts(currentLanguage);
  const ui = getBlogUiLabels(currentLanguage);

  const filteredPosts =
    selectedCategory === 'all'
      ? allPosts
      : allPosts.filter((post) => post.categoryId === selectedCategory);

  const featuredPost = allPosts[0];
  const featuredHref = featuredPost
    ? buildBlogPostPath(featuredPost.id, featuredPost.resolvedLanguage)
    : '/blog';

  return (
    <MarketingLayout>
      {/* Header */}
      <section className="pt-16 pb-14 md:pt-20 md:pb-16 border-b border-[#E8E8E5]">
        <div className="max-w-6xl mx-auto px-6 space-y-6">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[#736959] bg-[#EFECE6] px-2.5 py-1 rounded">
            <BookOpen className="w-3.5 h-3.5 text-[#8B806F]" />
            <span>{ui.journalBadge}</span>
          </div>

          <div className="max-w-3xl space-y-3">
            <h1 className="font-serif text-4xl sm:text-5xl font-normal tracking-tight text-[#252525] leading-[1.12]">
              {ui.indexTitle}
            </h1>
            <p className="text-sm md:text-base text-[#777777] leading-relaxed">
              {ui.indexSubtitle}
            </p>
          </div>
        </div>
      </section>

      {/* Featured Guide */}
      {featuredPost && (
        <section className="py-12 md:py-16 border-b border-[#E8E8E5] bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <article className="grid lg:grid-cols-12 gap-8 items-center bg-[#FAF9F7] border border-[#E8E8E5] rounded-xl p-6 sm:p-8 shadow-subtle">
              <div className="lg:col-span-6 overflow-hidden rounded-lg border border-[#E8E8E5] bg-white">
                <a
                  href={featuredHref}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(featuredHref);
                  }}
                >
                  <img
                    src={featuredPost.coverImage}
                    alt={featuredPost.coverImageAlt}
                    width={featuredPost.coverImageWidth}
                    height={featuredPost.coverImageHeight}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    className="w-full h-auto object-cover aspect-[16/10]"
                  />
                </a>
              </div>
              <div className="lg:col-span-6 space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-[#8B806F]">
                  <span className="uppercase">{featuredPost.category}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {featuredPost.readingTimeMinutes} {ui.minReadSuffix}
                  </span>
                </div>
                <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#252525] leading-snug">
                  <a
                    href={featuredHref}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(featuredHref);
                    }}
                    className="hover:text-[#8B806F] transition-colors"
                  >
                    {featuredPost.title}
                  </a>
                </h2>
                <p className="text-xs sm:text-sm text-[#777777] leading-relaxed">
                  {featuredPost.excerpt}
                </p>
                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => navigate(featuredHref)}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    {ui.readFullGuide}
                  </Button>
                </div>
              </div>
            </article>
          </div>
        </section>
      )}

      {/* Category Filters & Article Grid */}
      <section className="py-16 md:py-20 bg-[#FAF9F7]">
        <div className="max-w-6xl mx-auto px-6 space-y-10">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E8E8E5]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-[#252525] text-white border-[#252525] font-medium'
                    : 'bg-white text-[#777777] border-[#E8E8E5] hover:text-[#252525]'
                }`}
              >
                {ui.allGuides} ({allPosts.length})
              </button>
              {BLOG_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                    selectedCategory === category
                      ? 'bg-[#252525] text-white border-[#252525] font-medium'
                      : 'bg-white text-[#777777] border-[#E8E8E5] hover:text-[#252525]'
                  }`}
                >
                  {getBlogCategoryLabel(category, currentLanguage)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => {
              const postHref = buildBlogPostPath(post.id, post.resolvedLanguage);
              return (
                <article
                  key={post.id}
                  className="bg-white border border-[#E8E8E5] hover:border-[#252525] rounded-xl overflow-hidden shadow-subtle flex flex-col justify-between transition-colors"
                >
                  <div>
                    <a
                      href={postHref}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(postHref);
                      }}
                      className="block aspect-[16/10] overflow-hidden border-b border-[#EFEFEA] bg-[#FAF9F7]"
                    >
                      <img
                        src={post.coverImage}
                        alt={post.coverImageAlt}
                        width={post.coverImageWidth}
                        height={post.coverImageHeight}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    </a>
                    <div className="p-6 space-y-3">
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#8B806F]">
                        <span>{post.category}</span>
                        <span>
                          {post.readingTimeMinutes} {ui.minReadSuffix}
                        </span>
                      </div>
                      <h2 className="font-serif text-xl font-normal text-[#252525] leading-snug">
                        <a
                          href={postHref}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(postHref);
                          }}
                          className="hover:text-[#8B806F] transition-colors"
                        >
                          {post.title}
                        </a>
                      </h2>
                      <p className="text-xs text-[#777777] leading-relaxed line-clamp-3">
                        {post.excerpt}
                      </p>
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-[#EFEFEA] flex items-center justify-between text-xs">
                    <span className="text-[11px] text-[#777777] flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3" /> {post.updatedAt}
                    </span>
                    <a
                      href={postHref}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(postHref);
                      }}
                      className="font-medium text-[#252525] hover:text-[#8B806F] flex items-center gap-1"
                    >
                      {ui.readArticle} <ArrowRight className="w-3 h-3" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
