import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Ruler,
  LayoutGrid,
  Users,
  Maximize2,
  ChevronDown,
} from 'lucide-react';
import MarketingLayout from '../../layouts/MarketingLayout';
import Button from '../../design-system/components/Button';
import { useMarketingTranslation } from '../../lib/i18n/MarketingTranslationContext';

export default function WeddingSeatingChart() {
  const navigate = useNavigate();
  const { t, getLocalizedPath } = useMarketingTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const seatingFeatures = [
    {
      title: t('seatingPage.features.f1Title'),
      description: t('seatingPage.features.f1Desc'),
      icon: <Ruler className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('seatingPage.features.f2Title'),
      description: t('seatingPage.features.f2Desc'),
      icon: <LayoutGrid className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('seatingPage.features.f3Title'),
      description: t('seatingPage.features.f3Desc'),
      icon: <Users className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('seatingPage.features.f4Title'),
      description: t('seatingPage.features.f4Desc'),
      icon: <Maximize2 className="w-5 h-5 text-[#8B806F]" />,
    },
  ];

  const venuePresets = [
    { name: t('seatingPage.presets.p1Name'), size: '15m × 10m (150 m²)', desc: t('seatingPage.presets.p1Desc') },
    { name: t('seatingPage.presets.p2Name'), size: '20m × 15m (300 m²)', desc: t('seatingPage.presets.p2Desc') },
    { name: t('seatingPage.presets.p3Name'), size: '30m × 20m (600 m²)', desc: t('seatingPage.presets.p3Desc') },
    { name: t('seatingPage.presets.p4Name'), size: '35m × 12m (420 m²)', desc: t('seatingPage.presets.p4Desc') },
  ];

  const faqs = [
    { q: t('seatingPage.faqs.q1'), a: t('seatingPage.faqs.a1') },
    { q: t('seatingPage.faqs.q2'), a: t('seatingPage.faqs.a2') },
    { q: t('seatingPage.faqs.q3'), a: t('seatingPage.faqs.a3') },
    { q: t('seatingPage.faqs.q4'), a: t('seatingPage.faqs.a4') },
  ];

  const relatedLinks = [
    { href: '/wedding-guest-management', title: t('common.cards.guest.title'), desc: t('common.cards.guest.desc') },
    { href: '/wedding-rsvp-management', title: t('common.cards.rsvp.title'), desc: t('common.cards.rsvp.desc') },
    { href: '/wedding-website-builder', title: t('common.cards.website.title'), desc: t('common.cards.website.desc') },
    { href: '/wedding-planner-software', title: t('common.cards.studio.title'), desc: t('common.cards.studio.desc') },
    { href: '/blog/wedding-seating-chart-guide', title: t('seatingPage.guideLinkTitle'), desc: t('seatingPage.guideLinkDesc') },
  ];

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="pt-16 pb-20 md:pt-24 md:pb-28 border-b border-[#E8E8E5]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-[#736959] bg-[#EFECE6] px-2.5 py-1 rounded">
                <span>{t('seatingPage.hero.badgeLeft')}</span>
                <span className="text-[#8B806F]">·</span>
                <span>{t('seatingPage.hero.badgeRight')}</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#252525] leading-[1.12]">
                {t('seatingPage.hero.title')}
              </h1>

              <p className="text-sm md:text-base text-[#777777] max-w-xl leading-relaxed">
                {t('seatingPage.hero.subtitle')}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/login')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {t('seatingPage.hero.primaryCta')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate(getLocalizedPath('/wedding-guest-management'))}
                >
                  {t('seatingPage.hero.secondaryCta')}
                </Button>
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-[#777777]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('seatingPage.hero.bullet1')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('seatingPage.hero.bullet2')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('seatingPage.hero.bullet3')}</span>
                </div>
              </div>
            </div>

            {/* Product Floor Plan UI Preview */}
            <div className="lg:col-span-6">
              <div className="rounded-lg border border-[#E8E8E5] shadow-card bg-white p-2.5 space-y-2.5">
                <div className="overflow-hidden rounded border border-[#E8E8E5] bg-[#FAF9F7]">
                  <img
                    src="/images/seo/wedding-seating-chart-floor-plan.webp"
                    alt={t('seatingPage.hero.imageAlt')}
                    className="w-full h-auto block object-cover"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    width={1200}
                    height={670}
                  />
                </div>
                <div className="px-3 py-2 bg-[#FAF9F7] rounded flex items-center justify-between text-xs">
                  <span className="font-medium text-[#252525]">{t('seatingPage.hero.captionLeft')}</span>
                  <span className="font-mono text-[11px] text-[#8B806F]">
                    {t('seatingPage.hero.captionRight')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Core Floor Plan & Seating Capabilities */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">
              {t('seatingPage.features.eyebrow')}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[#252525] mt-2 leading-tight">
              {t('seatingPage.features.title')}
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-3 leading-relaxed">
              {t('seatingPage.features.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {seatingFeatures.map((feat, idx) => (
              <div
                key={idx}
                className="p-6 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg shadow-subtle space-y-3"
              >
                <div className="w-10 h-10 rounded-md bg-white border border-[#E8E8E5] flex items-center justify-center">
                  {feat.icon}
                </div>
                <h3 className="text-sm font-semibold text-[#252525]">{feat.title}</h3>
                <p className="text-xs text-[#777777] leading-relaxed">{feat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Venue Dimension Presets */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">
              {t('seatingPage.presets.eyebrow')}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525] mt-2">
              {t('seatingPage.presets.title')}
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-2 leading-relaxed">
              {t('seatingPage.presets.subtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {venuePresets.map((preset, idx) => (
              <div key={idx} className="bg-white border border-[#E8E8E5] rounded-lg p-6 shadow-subtle space-y-2">
                <div className="text-[11px] font-mono text-[#8B806F]">{preset.size}</div>
                <h3 className="text-sm font-semibold text-[#252525]">{preset.name}</h3>
                <p className="text-xs text-[#777777] leading-relaxed">{preset.desc}</p>
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
              {t('seatingPage.faqTitle')}
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
            <h2 className="font-serif text-2xl text-[#252525]">{t('seatingPage.bottomCta.title')}</h2>
            <p className="text-xs sm:text-sm text-[#777777] max-w-md mx-auto">
              {t('seatingPage.bottomCta.subtitle')}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/login')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {t('seatingPage.bottomCta.cta')}
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
