import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WeddingTemplate } from '../types';
import { Loader2, ArrowRight, ExternalLink, Sparkles } from 'lucide-react';
import { fetchTemplates } from '../lib/templates';
import Button from '../design-system/components/Button';
import Badge from '../design-system/components/Badge';
import MarketingLayout from '../layouts/MarketingLayout';
import { useMarketingTranslation } from '../lib/i18n/MarketingTranslationContext';

export default function TemplateSelector() {
  const navigate = useNavigate();
  const { t, getLocalizedPath } = useMarketingTranslation();
  const [templates, setTemplates] = useState<WeddingTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<string>('all');

  useEffect(() => {
    async function load() {
      const data = await fetchTemplates();
      setTemplates(data);
      setIsLoading(false);
    }
    load();
  }, []);

  const handleSelect = (id: string) => {
    navigate(`/display?template=${id}`);
  };

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    navigate(getLocalizedPath(href));
  };

  const variants = ['all', 'masonry', 'hanging', 'floating', 'grid'];

  const filteredTemplates =
    selectedVariant === 'all'
      ? templates
      : templates.filter((item) => (item.variant || 'masonry') === selectedVariant);

  const getTemplateName = (template: WeddingTemplate) => {
    const key = `templates.items.${template.id}.name`;
    const translated = t(key);
    return translated === key ? template.name : translated;
  };

  const getTemplateDesc = (template: WeddingTemplate) => {
    const key = `templates.items.${template.id}.desc`;
    const translated = t(key);
    if (translated !== key) return translated;
    return template.description || t('templates.defaultDesc');
  };

  if (isLoading) {
    return (
      <MarketingLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#252525] animate-spin" />
        </div>
      </MarketingLayout>
    );
  }

  return (
    <MarketingLayout>
      <div className="py-12 sm:py-16 px-6">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Hero / Header */}
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#736959] bg-[#EFECE6] px-2.5 py-1 rounded">
              <Sparkles className="w-3.5 h-3.5 text-[#8B806F]" />
              <span>{t('templates.badge')}</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight text-[#252525] leading-tight">
              {t('templates.title')}
            </h1>

            <p className="text-xs sm:text-sm text-[#777777] leading-relaxed">
              {t('templates.subtitle')}
            </p>

            <div className="pt-2 flex flex-wrap gap-4 text-xs">
              <a
                href={getLocalizedPath('/digital-wedding-invitations')}
                onClick={(e) => handleLinkClick(e, '/digital-wedding-invitations')}
                className="text-[#8B806F] hover:text-[#252525] font-medium flex items-center gap-1 transition-colors"
              >
                {t('templates.linkStudio')}
              </a>
              <a
                href={getLocalizedPath('/wedding-reception-display')}
                onClick={(e) => handleLinkClick(e, '/wedding-reception-display')}
                className="text-[#8B806F] hover:text-[#252525] font-medium flex items-center gap-1 transition-colors"
              >
                {t('templates.linkDisplay')}
              </a>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-y border-[#E8E8E5]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#777777] mr-1">{t('templates.filterLabel')}</span>
              {variants.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSelectedVariant(v)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    selectedVariant === v
                      ? 'bg-[#252525] text-white font-medium'
                      : 'bg-white border border-[#E8E8E5] text-[#777777] hover:text-[#252525]'
                  }`}
                >
                  {t(`templates.variants.${v}`)}
                </button>
              ))}
            </div>
            <div className="text-xs text-[#777777]">
              {t('templates.showingPrefix')}{' '}
              <span className="font-mono text-[#252525] font-medium">{filteredTemplates.length}</span>{' '}
              {t('templates.showingSuffix')}
            </div>
          </div>

          {/* Template Grid */}
          <div className="space-y-12">
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {filteredTemplates.map((template) => {
                  const variantKey = template.variant || 'masonry';
                  const variantLabel = t(`templates.variants.${variantKey}`);
                  return (
                    <article
                      key={template.id}
                      className="bg-white border border-[#E8E8E5] hover:border-[#252525] rounded-lg p-5 transition-colors shadow-subtle flex flex-col justify-between min-h-[220px] group"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h2 className="text-sm font-semibold text-[#252525] group-hover:text-[#8B806F] transition-colors">
                            {getTemplateName(template)}
                          </h2>
                          <Badge variant={template.is_custom ? 'neutral' : 'taupe'} size="sm">
                            {template.is_custom ? t('templates.customBadge') : t('templates.standardBadge')}
                          </Badge>
                        </div>
                        <p className="text-xs text-[#777777] leading-relaxed line-clamp-3">
                          {getTemplateDesc(template)}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-[#EFEFEA] space-y-3">
                        <div className="flex items-center justify-between text-[11px] text-[#777777]">
                          <span className="font-mono">
                            {variantLabel} {t('templates.layoutSuffix')}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#8B806F]" />
                            <div className="w-2.5 h-2.5 rounded-full bg-[#252525]" />
                            <div className="w-2.5 h-2.5 rounded-full bg-[#E8E8E5]" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <a
                            href={`/display?template=${template.id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              handleSelect(template.id);
                            }}
                            className="font-medium text-[#252525] hover:underline flex items-center gap-1 text-[11px]"
                          >
                            {t('templates.previewTheme')} <ExternalLink className="w-3 h-3" />
                          </a>
                          <a
                            href="/login"
                            onClick={(e) => {
                              e.preventDefault();
                              navigate('/login');
                            }}
                            className="text-[11px] text-[#8B806F] hover:text-[#252525] font-medium"
                          >
                            {t('templates.applyToWedding')}
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            {/* Information Banner */}
            <div className="bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg p-8 grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-3">
                <span className="text-xs font-semibold text-[#8B806F] uppercase tracking-wider">
                  {t('templates.bannerEyebrow')}
                </span>
                <h3 className="font-serif text-2xl text-[#252525]">{t('templates.bannerTitle')}</h3>
                <p className="text-xs sm:text-sm text-[#777777] leading-relaxed">
                  {t('templates.bannerDesc')}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 md:justify-end">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate('/login')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {t('templates.createAccount')}
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => navigate(getLocalizedPath('/pricing'))}
                >
                  {t('common.viewPlansPricing')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
