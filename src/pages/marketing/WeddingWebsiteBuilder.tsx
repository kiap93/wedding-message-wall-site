import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Layout,
  Palette,
  Smartphone,
  ShieldCheck,
  ChevronDown,
  Globe,
} from 'lucide-react';
import MarketingLayout from '../../layouts/MarketingLayout';
import Button from '../../design-system/components/Button';
import { useMarketingTranslation } from '../../lib/i18n/MarketingTranslationContext';

export default function WeddingWebsiteBuilder() {
  const navigate = useNavigate();
  const { t, getLocalizedPath } = useMarketingTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    navigate(getLocalizedPath(href));
  };

  const capabilities = [
    {
      title: t('websiteBuilderPage.features.f1Title'),
      description: t('websiteBuilderPage.features.f1Desc'),
      icon: <Layout className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('websiteBuilderPage.features.f2Title'),
      description: t('websiteBuilderPage.features.f2Desc'),
      icon: <Palette className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('websiteBuilderPage.features.f3Title'),
      description: t('websiteBuilderPage.features.f3Desc'),
      icon: <Smartphone className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('websiteBuilderPage.features.f4Title'),
      description: t('websiteBuilderPage.features.f4Desc'),
      icon: <ShieldCheck className="w-5 h-5 text-[#8B806F]" />,
    },
  ];

  const sectionModules = [
    { name: t('websiteBuilderPage.modules.m1Name'), desc: t('websiteBuilderPage.modules.m1Desc') },
    { name: t('websiteBuilderPage.modules.m2Name'), desc: t('websiteBuilderPage.modules.m2Desc') },
    { name: t('websiteBuilderPage.modules.m3Name'), desc: t('websiteBuilderPage.modules.m3Desc') },
    { name: t('websiteBuilderPage.modules.m4Name'), desc: t('websiteBuilderPage.modules.m4Desc') },
    { name: t('websiteBuilderPage.modules.m5Name'), desc: t('websiteBuilderPage.modules.m5Desc') },
    { name: t('websiteBuilderPage.modules.m6Name'), desc: t('websiteBuilderPage.modules.m6Desc') },
  ];

  const faqs = [
    { q: t('websiteBuilderPage.faqs.q1'), a: t('websiteBuilderPage.faqs.a1') },
    { q: t('websiteBuilderPage.faqs.q2'), a: t('websiteBuilderPage.faqs.a2') },
    { q: t('websiteBuilderPage.faqs.q3'), a: t('websiteBuilderPage.faqs.a3') },
    { q: t('websiteBuilderPage.faqs.q4'), a: t('websiteBuilderPage.faqs.a4') },
  ];

  const relatedLinks = [
    { href: '/digital-wedding-invitations', title: t('common.cards.invitations.title'), desc: t('common.cards.invitations.desc') },
    { href: '/wedding-rsvp-management', title: t('common.cards.rsvp.title'), desc: t('common.cards.rsvp.desc') },
    { href: '/wedding-seating-chart', title: t('common.cards.seating.title'), desc: t('common.cards.seating.desc') },
    { href: '/wedding-reception-display', title: t('common.cards.display.title'), desc: t('common.cards.display.desc') },
    { href: '/blog/wedding-website-vs-digital-invitation', title: t('websiteBuilderPage.guideLinkTitle'), desc: t('websiteBuilderPage.guideLinkDesc') },
  ];

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="pt-16 pb-20 md:pt-24 md:pb-28 border-b border-[#E8E8E5]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-[#736959] bg-[#EFECE6] px-2.5 py-1 rounded">
                <span>{t('websiteBuilderPage.hero.badgeLeft')}</span>
                <span className="text-[#8B806F]">·</span>
                <span>{t('websiteBuilderPage.hero.badgeRight')}</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#252525] leading-[1.12]">
                {t('websiteBuilderPage.hero.title')}
              </h1>

              <p className="text-sm md:text-base text-[#777777] max-w-xl leading-relaxed">
                {t('websiteBuilderPage.hero.subtitle')}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/login')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {t('websiteBuilderPage.hero.primaryCta')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate(getLocalizedPath('/templates'))}
                >
                  {t('websiteBuilderPage.hero.secondaryCta')}
                </Button>
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-[#777777]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('websiteBuilderPage.hero.bullet1')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('websiteBuilderPage.hero.bullet2')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('websiteBuilderPage.hero.bullet3')}</span>
                </div>
              </div>
            </div>

            {/* Product Studio Screenshot */}
            <div className="lg:col-span-6">
              <div className="rounded-lg border border-[#E8E8E5] shadow-card bg-white p-2.5 space-y-2.5">
                <div className="overflow-hidden rounded border border-[#E8E8E5] bg-[#FAF9F7]">
                  <img
                    src="/images/seo/wedding-website-builder-studio.webp"
                    alt={t('websiteBuilderPage.hero.imageAlt')}
                    className="w-full h-auto block object-cover"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    width={1200}
                    height={670}
                  />
                </div>
                <div className="px-3 py-2 bg-[#FAF9F7] rounded flex items-center justify-between text-xs">
                  <span className="font-medium text-[#252525] flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#8B806F]" />
                    <span>{t('websiteBuilderPage.hero.captionLeft')}</span>
                  </span>
                  <span className="font-mono text-[11px] text-[#8B806F]">
                    {t('websiteBuilderPage.hero.captionRight')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Builder Capabilities */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">
              {t('websiteBuilderPage.features.eyebrow')}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[#252525] mt-2 leading-tight">
              {t('websiteBuilderPage.features.title')}
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-3 leading-relaxed">
              {t('websiteBuilderPage.features.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {capabilities.map((cap, idx) => (
              <div
                key={idx}
                className="p-6 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg shadow-subtle space-y-3"
              >
                <div className="w-10 h-10 rounded-md bg-white border border-[#E8E8E5] flex items-center justify-center">
                  {cap.icon}
                </div>
                <h3 className="text-sm font-semibold text-[#252525]">{cap.title}</h3>
                <p className="text-xs text-[#777777] leading-relaxed">{cap.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modular Section Architecture */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">
              {t('websiteBuilderPage.modules.eyebrow')}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525] mt-2">
              {t('websiteBuilderPage.modules.title')}
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-2 leading-relaxed">
              {t('websiteBuilderPage.modules.subtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sectionModules.map((mod, idx) => (
              <div key={idx} className="bg-white border border-[#E8E8E5] rounded-lg p-6 shadow-subtle space-y-2">
                <h3 className="text-sm font-semibold text-[#252525]">{mod.name}</h3>
                <p className="text-xs text-[#777777] leading-relaxed">{mod.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Related Links */}
      <section className="py-16 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-8">
            <h2 className="text-xs font-semibold text-[#8B806F] uppercase tracking-wider">
              {t('common.relatedSolutions')}
            </h2>
            <p className="text-base font-serif text-[#252525] mt-1">{t('common.exploreSuite')}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {relatedLinks.map((link) => (
              <a
                key={link.href}
                href={link.href.startsWith('/blog') ? link.href : getLocalizedPath(link.href)}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(link.href.startsWith('/blog') ? link.href : getLocalizedPath(link.href));
                }}
                className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1"
              >
                <div className="font-semibold text-[#252525]">{link.title}</div>
                <div className="text-[11px] text-[#777777]">{link.desc}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-28 bg-[#FAF9F7]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center space-y-2 mb-12">
            <span className="text-xs font-medium text-[#8B806F] tracking-wider uppercase">
              {t('common.faqEyebrow')}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525]">
              {t('websiteBuilderPage.faqTitle')}
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-white border border-[#E8E8E5] rounded-lg overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4"
                  >
                    <span className="text-xs sm:text-sm font-semibold text-[#252525]">{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#777777] shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-[#777777] leading-relaxed border-t border-[#EFEFEA]">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-16 text-center space-y-4">
            <h2 className="font-serif text-2xl text-[#252525]">{t('websiteBuilderPage.bottomCta.title')}</h2>
            <p className="text-xs sm:text-sm text-[#777777] max-w-md mx-auto">
              {t('websiteBuilderPage.bottomCta.subtitle')}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/login')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {t('websiteBuilderPage.bottomCta.cta')}
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
      </section>
    </MarketingLayout>
  );
}
