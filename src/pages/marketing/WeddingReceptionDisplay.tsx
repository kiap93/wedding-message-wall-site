import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Monitor,
  QrCode,
  Palette,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import MarketingLayout from '../../layouts/MarketingLayout';
import Button from '../../design-system/components/Button';
import { useMarketingTranslation } from '../../lib/i18n/MarketingTranslationContext';

export default function WeddingReceptionDisplay() {
  const navigate = useNavigate();
  const { t, getLocalizedPath } = useMarketingTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    navigate(getLocalizedPath(href));
  };

  const displayFeatures = [
    {
      title: t('displayPage.features.f1Title'),
      description: t('displayPage.features.f1Desc'),
      icon: <Monitor className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('displayPage.features.f2Title'),
      description: t('displayPage.features.f2Desc'),
      icon: <QrCode className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('displayPage.features.f3Title'),
      description: t('displayPage.features.f3Desc'),
      icon: <Palette className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('displayPage.features.f4Title'),
      description: t('displayPage.features.f4Desc'),
      icon: <ShieldCheck className="w-5 h-5 text-[#8B806F]" />,
    },
  ];

  const animationLayouts = [
    { name: t('displayPage.layouts.l1Name'), desc: t('displayPage.layouts.l1Desc') },
    { name: t('displayPage.layouts.l2Name'), desc: t('displayPage.layouts.l2Desc') },
    { name: t('displayPage.layouts.l3Name'), desc: t('displayPage.layouts.l3Desc') },
    { name: t('displayPage.layouts.l4Name'), desc: t('displayPage.layouts.l4Desc') },
  ];

  const faqs = [
    { q: t('displayPage.faqs.q1'), a: t('displayPage.faqs.a1') },
    { q: t('displayPage.faqs.q2'), a: t('displayPage.faqs.a2') },
    { q: t('displayPage.faqs.q3'), a: t('displayPage.faqs.a3') },
    { q: t('displayPage.faqs.q4'), a: t('displayPage.faqs.a4') },
  ];

  const relatedLinks = [
    { href: '/templates', title: t('common.cards.themes.title'), desc: t('common.cards.themes.desc') },
    { href: '/wedding-website-builder', title: t('common.cards.website.title'), desc: t('common.cards.website.desc') },
    { href: '/wedding-seating-chart', title: t('common.cards.seating.title'), desc: t('common.cards.seating.desc') },
    { href: '/wedding-guest-management', title: t('common.cards.guest.title'), desc: t('common.cards.guest.desc') },
    { href: '/wedding-rsvp-management', title: t('common.cards.rsvp.title'), desc: t('common.cards.rsvp.desc') },
  ];

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="pt-16 pb-20 md:pt-24 md:pb-28 border-b border-[#E8E8E5]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-[#736959] bg-[#EFECE6] px-2.5 py-1 rounded">
                <span>{t('displayPage.hero.badgeLeft')}</span>
                <span className="text-[#8B806F]">·</span>
                <span>{t('displayPage.hero.badgeRight')}</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#252525] leading-[1.12]">
                {t('displayPage.hero.title')}
              </h1>

              <p className="text-sm md:text-base text-[#777777] max-w-xl leading-relaxed">
                {t('displayPage.hero.subtitle')}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate(getLocalizedPath('/templates'))}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {t('displayPage.hero.primaryCta')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/login')}
                >
                  {t('displayPage.hero.secondaryCta')}
                </Button>
              </div>

              <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-[#777777]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('displayPage.hero.bullet1')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('displayPage.hero.bullet2')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('displayPage.hero.bullet3')}</span>
                </div>
              </div>
            </div>

            {/* Right Visual */}
            <div className="lg:col-span-5 relative">
              <div className="rounded-lg border border-[#E8E8E5] shadow-card bg-white p-3 space-y-3">
                <div className="aspect-[16/9] rounded overflow-hidden relative border border-[#E8E8E5] bg-[#FAF9F7]">
                  <img
                    src="/images/seo/wedding-reception-live-display.webp"
                    alt={t('displayPage.hero.imageAlt')}
                    className="w-full h-full object-cover"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    width={1200}
                    height={670}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex flex-col justify-between p-4">
                    <div className="flex justify-between items-center text-white">
                      <span className="text-[10px] font-mono tracking-wider bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded border border-white/20">
                        {t('displayPage.hero.screenTag')}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-500/30">
                        {t('displayPage.hero.liveStream')}
                      </span>
                    </div>
                    <div className="text-white space-y-1">
                      <div className="text-sm font-medium">{t('displayPage.hero.quote')}</div>
                      <div className="text-[11px] text-white/70">{t('displayPage.hero.author')}</div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#FAF9F7] rounded text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <QrCode className="w-4 h-4 text-[#8B806F] shrink-0" />
                    <span className="text-[#252525] font-medium truncate">{t('displayPage.hero.scanPrompt')}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#8B806F] bg-white px-2 py-0.5 rounded border border-[#E8E8E5] shrink-0">
                    {t('displayPage.hero.scanReady')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Feature Pillars */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">
              {t('displayPage.features.eyebrow')}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[#252525] mt-2 leading-tight">
              {t('displayPage.features.title')}
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-3 leading-relaxed">
              {t('displayPage.features.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayFeatures.map((feat, idx) => (
              <div
                key={idx}
                className="p-6 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg shadow-subtle flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-md bg-white border border-[#E8E8E5] flex items-center justify-center">
                    {feat.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-[#252525]">{feat.title}</h3>
                  <p className="text-xs text-[#777777] leading-relaxed">{feat.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Animation Layouts Grid */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div>
              <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">
                {t('displayPage.layouts.eyebrow')}
              </span>
              <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525] mt-1">
                {t('displayPage.layouts.title')}
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(getLocalizedPath('/templates'))}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              {t('displayPage.layouts.previewBtn')}
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {animationLayouts.map((layout, idx) => (
              <div
                key={idx}
                className="bg-white border border-[#E8E8E5] rounded-lg p-6 shadow-subtle flex flex-col justify-between space-y-4"
              >
                <div>
                  <h3 className="text-sm font-semibold text-[#252525]">{layout.name}</h3>
                  <p className="text-xs text-[#777777] leading-relaxed mt-2">{layout.desc}</p>
                </div>
                <div className="pt-3 border-t border-[#EFEFEA] flex justify-between items-center text-[11px] text-[#8B806F]">
                  <span>{t('displayPage.layouts.supports')}</span>
                  <span className="font-mono">{t('displayPage.layouts.autoLoop')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Internal Navigation Links */}
      <section className="py-16 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-8">
            <h2 className="text-xs font-semibold text-[#8B806F] uppercase tracking-wider">
              {t('common.relatedSolutions')}
            </h2>
            <p className="text-base font-serif text-[#252525] mt-1">{t('displayPage.relatedSubtitle')}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {relatedLinks.map((link) => (
              <a
                key={link.href}
                href={getLocalizedPath(link.href)}
                onClick={(e) => handleLinkClick(e, link.href)}
                className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1"
              >
                <div className="font-semibold text-[#252525]">{link.title}</div>
                <div className="text-[11px] text-[#777777]">{link.desc}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 md:py-28 bg-[#FAF9F7]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center space-y-2 mb-12">
            <span className="text-xs font-medium text-[#8B806F] tracking-wider uppercase">
              {t('common.faqEyebrow')}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525]">
              {t('displayPage.faqTitle')}
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-white border border-[#E8E8E5] rounded-lg overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4"
                  >
                    <span className="text-xs sm:text-sm font-semibold text-[#252525]">{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#777777] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
            <h2 className="font-serif text-2xl text-[#252525]">{t('displayPage.bottomCta.title')}</h2>
            <p className="text-xs sm:text-sm text-[#777777] max-w-md mx-auto">
              {t('displayPage.bottomCta.subtitle')}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/login')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {t('displayPage.bottomCta.cta')}
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate(getLocalizedPath('/templates'))}
              >
                {t('common.browseThemeGallery')}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
