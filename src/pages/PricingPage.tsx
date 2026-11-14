import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Calculator,
  ShieldCheck,
  Sparkles,
  Calendar,
} from 'lucide-react';
import MarketingLayout from '../layouts/MarketingLayout';
import Button from '../design-system/components/Button';
import { EVENT_PRICING, calculateEventCost, formatPrice } from '../config/pricing';
import { useMarketingTranslation } from '../lib/i18n/MarketingTranslationContext';

export default function PricingPage() {
  const navigate = useNavigate();
  const { t, getLocalizedPath } = useMarketingTranslation();
  const [eventCount, setEventCount] = useState<number>(3);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    navigate(getLocalizedPath(href));
  };

  const includedCapabilities = [
    t('pricingPage.included.i1'),
    t('pricingPage.included.i2'),
    t('pricingPage.included.i3'),
    t('pricingPage.included.i4'),
    t('pricingPage.included.i5'),
    t('pricingPage.included.i6'),
    t('pricingPage.included.i7'),
    t('pricingPage.included.i8'),
  ];

  const faqs = [
    { q: t('pricingPage.faqs.q1'), a: t('pricingPage.faqs.a1') },
    { q: t('pricingPage.faqs.q2'), a: t('pricingPage.faqs.a2') },
    { q: t('pricingPage.faqs.q3'), a: t('pricingPage.faqs.a3') },
    { q: t('pricingPage.faqs.q4'), a: t('pricingPage.faqs.a4') },
    { q: t('pricingPage.faqs.q5'), a: t('pricingPage.faqs.a5') },
  ];

  const relatedLinks = [
    { href: '/wedding-website-builder', title: t('common.cards.website.title'), desc: t('common.cards.website.desc') },
    { href: '/wedding-seating-chart', title: t('common.cards.seating.title'), desc: t('common.cards.seating.desc') },
    { href: '/digital-wedding-invitations', title: t('common.cards.invitations.title'), desc: t('common.cards.invitations.desc') },
    { href: '/wedding-rsvp-management', title: t('common.cards.rsvp.title'), desc: t('common.cards.rsvp.desc') },
    { href: '/wedding-reception-display', title: t('common.cards.display.title'), desc: t('common.cards.display.desc') },
  ];

  const estimatedTotal = calculateEventCost(eventCount);

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="pt-16 pb-16 md:pt-24 md:pb-20 border-b border-[#E8E8E5]">
        <div className="max-w-5xl mx-auto px-6 text-center space-y-6">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[#736959] bg-[#EFECE6] px-3 py-1 rounded">
            <span>{t('pricingPage.hero.badgeLeft')}</span>
            <span className="text-[#8B806F]">·</span>
            <span>{t('pricingPage.hero.badgeRight')}</span>
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#252525] leading-[1.1]">
            {t('pricingPage.hero.title', { price: formatPrice(EVENT_PRICING.pricePerEvent) })}
          </h1>

          <p className="text-sm md:text-base text-[#777777] max-w-2xl mx-auto leading-relaxed">
            {t('pricingPage.hero.subtitle')}
          </p>

          <div className="flex flex-wrap justify-center gap-6 pt-2 text-xs text-[#777777]">
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[#8B806F]" />
              <span>{t('pricingPage.hero.bullet1')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[#8B806F]" />
              <span>{t('pricingPage.hero.bullet2')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[#8B806F]" />
              <span>{t('pricingPage.hero.bullet3')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Pay-Per-Event License Card + Interactive Estimator */}
      <section className="py-16 md:py-24 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-5xl mx-auto px-6 space-y-12">
          <div className="bg-[#FAF9F7] border-2 border-[#252525] rounded-2xl p-8 sm:p-10 shadow-card relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#252525] text-white text-[11px] font-mono px-4 py-1.5 rounded-bl-xl tracking-wider">
              {t('home.pricing.ribbon')}
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#E8E8E5] pb-8 pt-4 sm:pt-0">
              <div>
                <span className="text-xs font-mono text-[#8B806F] uppercase font-semibold">
                  {t('home.pricing.cardEyebrow')}
                </span>
                <h2 className="font-serif text-3xl font-normal text-[#252525] mt-1">
                  {t('home.pricing.cardTitle')}
                </h2>
                <p className="text-xs sm:text-sm text-[#777777] mt-1.5 max-w-md">
                  {t('pricingPage.card.desc')}
                </p>
              </div>

              <div className="flex items-baseline gap-2 bg-white border border-[#E8E8E5] rounded-xl px-6 py-4 shadow-subtle shrink-0">
                <span className="text-4xl sm:text-5xl font-mono font-bold text-[#252525]">
                  {formatPrice(EVENT_PRICING.pricePerEvent)}
                </span>
                <span className="text-xs text-[#777777]">{t('home.pricing.perEvent')}</span>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 py-8 border-b border-[#E8E8E5]">
              {includedCapabilities.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#252525]">
                  <Check className="w-4 h-4 text-[#8B806F] shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {/* Interactive Agency Cost Estimator */}
            <div className="py-8 border-b border-[#E8E8E5] grid md:grid-cols-12 gap-8 items-center">
              <div className="md:col-span-7 space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#8B806F] font-semibold">
                  <Calculator className="w-4 h-4" />
                  <span>{t('pricingPage.calculator.eyebrow')}</span>
                </div>
                <h3 className="font-serif text-2xl text-[#252525]">
                  {t('pricingPage.calculator.title')}
                </h3>
                <p className="text-xs text-[#777777] leading-relaxed">
                  {t('pricingPage.calculator.desc')}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {[1, 2, 3, 5, 10, 20].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setEventCount(count)}
                      className={`px-3.5 py-1.5 text-xs font-mono rounded border transition-colors ${
                        eventCount === count
                          ? 'bg-[#252525] text-white border-[#252525]'
                          : 'bg-white text-[#555555] border-[#E8E8E5] hover:border-[#252525]'
                      }`}
                    >
                      {count} {count === 1 ? t('pricingPage.calculator.eventSingular') : t('pricingPage.calculator.eventPlural')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-5 bg-white border border-[#E8E8E5] rounded-xl p-5 space-y-2 shadow-subtle">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#777777]">
                  {t('pricingPage.calculator.summaryLabel')}
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-mono font-bold text-[#252525]">
                    {formatPrice(estimatedTotal)}
                  </span>
                  <span className="text-xs text-[#8B806F] font-mono">
                    {eventCount} × {formatPrice(EVENT_PRICING.pricePerEvent, false)}
                  </span>
                </div>
                <p className="text-[11px] text-[#777777] pt-1 border-t border-[#EFEFEA]">
                  {t('pricingPage.calculator.validityNote', { months: EVENT_PRICING.validityMonths })}
                </p>
              </div>
            </div>

            <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-[#777777] text-center sm:text-left">
                {t('home.pricing.freeDraftNote')}
              </div>
              <div className="flex flex-wrap gap-3 w-full sm:w-auto justify-center">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/login')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {t('home.pricing.cta')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate(getLocalizedPath('/templates'))}
                >
                  {t('common.browseThemeGallery')}
                </Button>
              </div>
            </div>
          </div>

          {/* Value Pillars */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg space-y-2">
              <Calendar className="w-5 h-5 text-[#8B806F]" />
              <h3 className="text-sm font-semibold text-[#252525]">{t('pricingPage.pillars.p1Title')}</h3>
              <p className="text-xs text-[#777777] leading-relaxed">{t('pricingPage.pillars.p1Desc')}</p>
            </div>
            <div className="p-6 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg space-y-2">
              <Sparkles className="w-5 h-5 text-[#8B806F]" />
              <h3 className="text-sm font-semibold text-[#252525]">{t('pricingPage.pillars.p2Title')}</h3>
              <p className="text-xs text-[#777777] leading-relaxed">{t('pricingPage.pillars.p2Desc')}</p>
            </div>
            <div className="p-6 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg space-y-2">
              <ShieldCheck className="w-5 h-5 text-[#8B806F]" />
              <h3 className="text-sm font-semibold text-[#252525]">{t('pricingPage.pillars.p3Title')}</h3>
              <p className="text-xs text-[#777777] leading-relaxed">{t('pricingPage.pillars.p3Desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Internal Cross-Links */}
      <section className="py-16 border-b border-[#E8E8E5] bg-[#FAF9F7]">
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
                href={getLocalizedPath(link.href)}
                onClick={(e) => handleLinkClick(e, link.href)}
                className="p-4 bg-white hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1"
              >
                <div className="font-semibold text-[#252525]">{link.title}</div>
                <div className="text-[11px] text-[#777777]">{link.desc}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center space-y-2 mb-12">
            <span className="text-xs font-medium text-[#8B806F] tracking-wider uppercase">
              {t('common.faqEyebrow')}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525]">
              {t('pricingPage.faqTitle')}
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg overflow-hidden"
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
        </div>
      </section>
    </MarketingLayout>
  );
}
