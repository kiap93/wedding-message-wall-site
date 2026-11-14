import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Globe,
  ShieldCheck,
  Key,
  Palette,
  ChevronDown,
} from 'lucide-react';
import MarketingLayout from '../../layouts/MarketingLayout';
import Button from '../../design-system/components/Button';
import { useMarketingTranslation } from '../../lib/i18n/MarketingTranslationContext';

export default function WhiteLabelWeddingSoftware() {
  const navigate = useNavigate();
  const { t, getLocalizedPath } = useMarketingTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    navigate(getLocalizedPath(href));
  };

  const whiteLabelPillars = [
    {
      title: t('whiteLabel.pillars.p1Title'),
      description: t('whiteLabel.pillars.p1Desc'),
      icon: <Globe className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('whiteLabel.pillars.p2Title'),
      description: t('whiteLabel.pillars.p2Desc'),
      icon: <Palette className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('whiteLabel.pillars.p3Title'),
      description: t('whiteLabel.pillars.p3Desc'),
      icon: <Key className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('whiteLabel.pillars.p4Title'),
      description: t('whiteLabel.pillars.p4Desc'),
      icon: <ShieldCheck className="w-5 h-5 text-[#8B806F]" />,
    },
  ];

  const faqs = [
    { q: t('whiteLabel.faqs.q1'), a: t('whiteLabel.faqs.a1') },
    { q: t('whiteLabel.faqs.q2'), a: t('whiteLabel.faqs.a2') },
    { q: t('whiteLabel.faqs.q3'), a: t('whiteLabel.faqs.a3') },
    { q: t('whiteLabel.faqs.q4'), a: t('whiteLabel.faqs.a4') },
  ];

  const relatedLinks = [
    { href: '/wedding-planner-software', title: t('common.cards.planner.title'), desc: t('common.cards.planner.desc') },
    { href: '/wedding-website-builder', title: t('common.cards.website.title'), desc: t('common.cards.website.desc') },
    { href: '/digital-wedding-invitations', title: t('common.cards.invitations.title'), desc: t('common.cards.invitations.desc') },
    { href: '/wedding-seating-chart', title: t('common.cards.seating.title'), desc: t('common.cards.seating.desc') },
    { href: '/wedding-reception-display', title: t('common.cards.display.title'), desc: t('common.cards.display.desc') },
  ];

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="pt-16 pb-20 md:pt-24 md:pb-28 border-b border-[#E8E8E5]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-[#736959] bg-[#EFECE6] px-2.5 py-1 rounded">
                <span>{t('whiteLabel.hero.badgeLeft')}</span>
                <span className="text-[#8B806F]">·</span>
                <span>{t('whiteLabel.hero.badgeRight')}</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#252525] leading-[1.12]">
                {t('whiteLabel.hero.title')}
              </h1>

              <p className="text-sm md:text-base text-[#777777] max-w-xl leading-relaxed">
                {t('whiteLabel.hero.subtitle')}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/login')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {t('whiteLabel.hero.primaryCta')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate(getLocalizedPath('/pricing'))}
                >
                  {t('whiteLabel.hero.secondaryCta')}
                </Button>
              </div>

              <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-[#777777]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('whiteLabel.hero.bullet1')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('whiteLabel.hero.bullet2')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('whiteLabel.hero.bullet3')}</span>
                </div>
              </div>
            </div>

            {/* Right Visual */}
            <div className="lg:col-span-5 relative">
              <div className="rounded-lg border border-[#E8E8E5] shadow-card bg-white p-4 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E5] text-xs">
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-[#8B806F]" />
                    <span className="font-mono text-[#252525] font-medium">atelier-weddings.eventframe.io</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#8B806F] bg-[#FAF9F7] px-2 py-0.5 rounded border border-[#E8E8E5]">
                    {t('whiteLabel.hero.statusBadge')}
                  </span>
                </div>

                <div className="aspect-[4/3] rounded overflow-hidden relative border border-[#E8E8E5] bg-[#FAF9F7]">
                  <img
                    src="/images/seo/editorial-wedding-couple-showcase.webp"
                    alt={t('whiteLabel.hero.imageAlt')}
                    className="w-full h-full object-cover"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    width={1200}
                    height={896}
                  />
                  <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-sm p-3 rounded border border-[#E8E8E5] shadow-sm flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-[#252525]">{t('whiteLabel.hero.studioName')}</div>
                      <div className="text-[10px] text-[#777777]">{t('whiteLabel.hero.clientMeta')}</div>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {t('whiteLabel.hero.livePortal')}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-[#FAF9F7] rounded text-xs text-[#777777] flex items-center justify-between gap-2">
                  <span>{t('whiteLabel.hero.clientLinkLabel')}</span>
                  <span className="font-mono text-[#252525] text-[11px] truncate">atelier-weddings.eventframe.io/couple/login</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 White-Label Pillars */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">
              {t('whiteLabel.pillars.eyebrow')}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[#252525] mt-2 leading-tight">
              {t('whiteLabel.pillars.title')}
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-3 leading-relaxed">
              {t('whiteLabel.pillars.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {whiteLabelPillars.map((pillar, idx) => (
              <div
                key={idx}
                className="p-6 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg shadow-subtle space-y-4"
              >
                <div className="w-10 h-10 rounded-md bg-white border border-[#E8E8E5] flex items-center justify-center">
                  {pillar.icon}
                </div>
                <h3 className="text-base font-semibold text-[#252525]">{pillar.title}</h3>
                <p className="text-xs sm:text-sm text-[#777777] leading-relaxed">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Couple Experience Section */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-5">
              <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">
                {t('whiteLabel.coupleExp.eyebrow')}
              </span>
              <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525] leading-tight">
                {t('whiteLabel.coupleExp.title')}
              </h2>
              <p className="text-xs md:text-sm text-[#777777] leading-relaxed">
                {t('whiteLabel.coupleExp.subtitle')}
              </p>

              <ul className="space-y-3 pt-2 text-xs sm:text-sm text-[#555555]">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#8B806F] shrink-0" />
                  <span>{t('whiteLabel.coupleExp.li1')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#8B806F] shrink-0" />
                  <span>{t('whiteLabel.coupleExp.li2')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#8B806F] shrink-0" />
                  <span>{t('whiteLabel.coupleExp.li3')}</span>
                </li>
              </ul>

              <div className="pt-4 flex flex-wrap gap-4 text-xs font-medium">
                <a
                  href={getLocalizedPath('/wedding-guest-management')}
                  onClick={(e) => handleLinkClick(e, '/wedding-guest-management')}
                  className="text-[#8B806F] hover:underline flex items-center gap-1"
                >
                  {t('whiteLabel.coupleExp.link1')}
                </a>
                <a
                  href={getLocalizedPath('/digital-wedding-invitations')}
                  onClick={(e) => handleLinkClick(e, '/digital-wedding-invitations')}
                  className="text-[#8B806F] hover:underline flex items-center gap-1"
                >
                  {t('whiteLabel.coupleExp.link2')}
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-lg overflow-hidden border border-[#E8E8E5] shadow-card bg-white p-3">
                <img
                  src="/images/seo/digital-wedding-invitations-stationery.webp"
                  alt={t('whiteLabel.coupleExp.imageAlt')}
                  className="w-full h-auto rounded object-cover"
                  loading="lazy"
                  decoding="async"
                  width={1200}
                  height={896}
                />
                <div className="p-3 text-xs text-[#777777] flex justify-between items-center border-t border-[#E8E8E5] mt-2">
                  <span>{t('whiteLabel.coupleExp.captionLeft')}</span>
                  <span className="font-mono text-[#252525]">{t('whiteLabel.coupleExp.captionRight')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Internal Navigation Grid */}
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
              {t('whiteLabel.faqTitle')}
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
            <h2 className="font-serif text-2xl text-[#252525]">{t('whiteLabel.bottomCta.title')}</h2>
            <p className="text-xs sm:text-sm text-[#777777] max-w-md mx-auto">
              {t('whiteLabel.bottomCta.subtitle')}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/login')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {t('whiteLabel.bottomCta.cta')}
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
