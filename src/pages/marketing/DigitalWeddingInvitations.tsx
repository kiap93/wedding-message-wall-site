import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Smartphone,
  Layers,
  Type,
  ChevronDown,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import MarketingLayout from '../../layouts/MarketingLayout';
import Button from '../../design-system/components/Button';
import { useMarketingTranslation } from '../../lib/i18n/MarketingTranslationContext';

export default function DigitalWeddingInvitations() {
  const navigate = useNavigate();
  const { t, getLocalizedPath } = useMarketingTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    navigate(getLocalizedPath(href));
  };

  const invitationFeatures = [
    {
      title: t('invitations.capabilities.f1Title'),
      description: t('invitations.capabilities.f1Desc'),
      icon: <Layers className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('invitations.capabilities.f2Title'),
      description: t('invitations.capabilities.f2Desc'),
      icon: <Smartphone className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('invitations.capabilities.f3Title'),
      description: t('invitations.capabilities.f3Desc'),
      icon: <Sliders className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('invitations.capabilities.f4Title'),
      description: t('invitations.capabilities.f4Desc'),
      icon: <Type className="w-5 h-5 text-[#8B806F]" />,
    },
  ];

  const stationeryAesthetics = [
    { name: t('invitations.themes.a1Name'), desc: t('invitations.themes.a1Desc'), variant: t('templates.variants.masonry') },
    { name: t('invitations.themes.a2Name'), desc: t('invitations.themes.a2Desc'), variant: t('templates.variants.hanging') },
    { name: t('invitations.themes.a3Name'), desc: t('invitations.themes.a3Desc'), variant: t('templates.variants.masonry') },
    { name: t('invitations.themes.a4Name'), desc: t('invitations.themes.a4Desc'), variant: t('templates.variants.grid') },
    { name: t('invitations.themes.a5Name'), desc: t('invitations.themes.a5Desc'), variant: t('templates.variants.masonry') },
    { name: t('invitations.themes.a6Name'), desc: t('invitations.themes.a6Desc'), variant: t('templates.variants.floating') },
  ];

  const faqs = [
    { q: t('invitations.faqs.q1'), a: t('invitations.faqs.a1') },
    { q: t('invitations.faqs.q2'), a: t('invitations.faqs.a2') },
    { q: t('invitations.faqs.q3'), a: t('invitations.faqs.a3') },
    { q: t('invitations.faqs.q4'), a: t('invitations.faqs.a4') },
  ];

  const relatedLinks = [
    { href: '/wedding-website-builder', title: t('common.cards.website.title'), desc: t('common.cards.website.desc') },
    { href: '/wedding-rsvp-management', title: t('common.cards.rsvp.title'), desc: t('common.cards.rsvp.desc') },
    { href: '/wedding-seating-chart', title: t('common.cards.seating.title'), desc: t('common.cards.seating.desc') },
    { href: '/wedding-guest-management', title: t('common.cards.guest.title'), desc: t('common.cards.guest.desc') },
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
                <span>{t('invitations.hero.badgeLeft')}</span>
                <span className="text-[#8B806F]">·</span>
                <span>{t('invitations.hero.badgeRight')}</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#252525] leading-[1.12]">
                {t('invitations.hero.title')}
              </h1>

              <p className="text-sm md:text-base text-[#777777] max-w-xl leading-relaxed">
                {t('invitations.hero.subtitle')}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate(getLocalizedPath('/templates'))}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {t('invitations.hero.primaryCta')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/login')}
                >
                  {t('invitations.hero.secondaryCta')}
                </Button>
              </div>

              <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-[#777777]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('invitations.hero.bullet1')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('invitations.hero.bullet2')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('invitations.hero.bullet3')}</span>
                </div>
              </div>
            </div>

            {/* Right Visual */}
            <div className="lg:col-span-5 relative">
              <div className="rounded-lg border border-[#E8E8E5] shadow-card bg-white p-3 space-y-3">
                <div className="aspect-[4/3] rounded overflow-hidden relative border border-[#E8E8E5] bg-[#FAF9F7]">
                  <img
                    src="/images/seo/digital-wedding-invitations-stationery.webp"
                    alt={t('invitations.hero.imageAlt')}
                    className="w-full h-full object-cover"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    width={1200}
                    height={896}
                  />
                  <div className="absolute top-3 right-3 bg-white/95 px-2.5 py-1 rounded text-[11px] font-mono text-[#8B806F] border border-[#E8E8E5] shadow-xs">
                    {t('invitations.hero.badgeTag')}
                  </div>
                </div>
                <div className="p-3 bg-[#FAF9F7] rounded text-xs flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-[#252525]">{t('invitations.hero.cardCouple')}</span>
                    <span className="text-[11px] text-[#777777] block">{t('invitations.hero.cardMeta')}</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {t('invitations.hero.rsvpReady')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Canvas Capabilities */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">
              {t('invitations.capabilities.eyebrow')}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[#252525] mt-2 leading-tight">
              {t('invitations.capabilities.title')}
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-3 leading-relaxed">
              {t('invitations.capabilities.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {invitationFeatures.map((feat, idx) => (
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

      {/* Available Themes Preview */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div>
              <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">
                {t('invitations.themes.eyebrow')}
              </span>
              <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525] mt-1">
                {t('invitations.themes.title')}
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(getLocalizedPath('/templates'))}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              {t('invitations.themes.browseBtn')}
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {stationeryAesthetics.map((style, idx) => (
              <div
                key={idx}
                className="bg-white border border-[#E8E8E5] rounded-lg p-6 shadow-subtle flex flex-col justify-between space-y-4 hover:border-[#252525] transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[#252525]">{style.name}</h3>
                    <span className="text-[10px] font-mono text-[#8B806F] bg-[#FAF9F7] px-2 py-0.5 rounded border border-[#E8E8E5]">
                      {style.variant}
                    </span>
                  </div>
                  <p className="text-xs text-[#777777] leading-relaxed">{style.desc}</p>
                </div>
                <div className="pt-3 border-t border-[#EFEFEA] flex items-center justify-between text-xs text-[#777777]">
                  <span className="text-[11px]">{t('invitations.themes.includesRsvp')}</span>
                  <a
                    href={getLocalizedPath('/templates')}
                    onClick={(e) => handleLinkClick(e, '/templates')}
                    className="text-[#252525] font-medium hover:underline flex items-center gap-1 text-[11px]"
                  >
                    {t('invitations.themes.previewSuite')} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Related Internal Links */}
      <section className="py-16 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-8">
            <h2 className="text-xs font-semibold text-[#8B806F] uppercase tracking-wider">
              {t('common.relatedSolutions')}
            </h2>
            <p className="text-base font-serif text-[#252525] mt-1">{t('invitations.relatedSubtitle')}</p>
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
              {t('invitations.faqTitle')}
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
            <h2 className="font-serif text-2xl text-[#252525]">{t('invitations.bottomCta.title')}</h2>
            <p className="text-xs sm:text-sm text-[#777777] max-w-md mx-auto">
              {t('invitations.bottomCta.subtitle')}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate(getLocalizedPath('/templates'))}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {t('invitations.bottomCta.primaryCta')}
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate('/login')}
              >
                {t('invitations.bottomCta.secondaryCta')}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
