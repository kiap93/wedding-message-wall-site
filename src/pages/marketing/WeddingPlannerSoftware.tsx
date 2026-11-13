import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Calendar,
  Layers,
  MessageSquare,
  Sliders,
  ChevronDown,
} from 'lucide-react';
import MarketingLayout from '../../layouts/MarketingLayout';
import Button from '../../design-system/components/Button';
import { useMarketingTranslation } from '../../lib/i18n/MarketingTranslationContext';
import heroWeddingImage from '../../assets/images/hero_wedding_editorial_1793501242401.jpg';
import celebrationVenueImage from '../../assets/images/celebration_venue_mood_1793501242406.jpg';

export default function WeddingPlannerSoftware() {
  const navigate = useNavigate();
  const { t, getLocalizedPath } = useMarketingTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    navigate(getLocalizedPath(href));
  };

  const plannerCapabilities = [
    {
      title: t('planners.capabilities.c1Title'),
      description: t('planners.capabilities.c1Desc'),
      icon: <Calendar className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('planners.capabilities.c2Title'),
      description: t('planners.capabilities.c2Desc'),
      icon: <Layers className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('planners.capabilities.c3Title'),
      description: t('planners.capabilities.c3Desc'),
      icon: <Sliders className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('planners.capabilities.c4Title'),
      description: t('planners.capabilities.c4Desc'),
      icon: <MessageSquare className="w-5 h-5 text-[#8B806F]" />,
    },
  ];

  const faqs = [
    { q: t('planners.faqs.q1'), a: t('planners.faqs.a1') },
    { q: t('planners.faqs.q2'), a: t('planners.faqs.a2') },
    { q: t('planners.faqs.q3'), a: t('planners.faqs.a3') },
    { q: t('planners.faqs.q4'), a: t('planners.faqs.a4') },
  ];

  const crossLinks = [
    { href: '/white-label-wedding-software', title: t('common.cards.whiteLabel.title'), desc: t('common.cards.whiteLabel.desc') },
    { href: '/digital-wedding-invitations', title: t('common.cards.invitations.title'), desc: t('common.cards.invitations.desc') },
    { href: '/wedding-rsvp-management', title: t('common.cards.rsvp.title'), desc: t('common.cards.rsvp.desc') },
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
                <span>{t('planners.hero.badgeLeft')}</span>
                <span className="text-[#8B806F]">·</span>
                <span>{t('planners.hero.badgeRight')}</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#252525] leading-[1.12]">
                {t('planners.hero.title')}
              </h1>

              <p className="text-sm md:text-base text-[#777777] max-w-xl leading-relaxed">
                {t('planners.hero.subtitle')}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/login')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {t('planners.hero.primaryCta')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate(getLocalizedPath('/templates'))}
                >
                  {t('planners.hero.secondaryCta')}
                </Button>
              </div>

              <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-[#777777]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('planners.hero.bullet1')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('planners.hero.bullet2')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('planners.hero.bullet3')}</span>
                </div>
              </div>
            </div>

            {/* Right Visual */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-lg overflow-hidden border border-[#E8E8E5] shadow-card bg-white p-2">
                <div className="aspect-[4/3] overflow-hidden rounded">
                  <img
                    src={heroWeddingImage}
                    alt={t('planners.hero.imageAlt')}
                    className="w-full h-full object-cover"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    width={800}
                    height={600}
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-4 flex items-center justify-between border-t border-[#E8E8E5] mt-2 bg-[#FAF9F7] rounded">
                  <div>
                    <div className="text-xs font-semibold text-[#252525]">{t('planners.hero.cardTitle')}</div>
                    <div className="text-[11px] text-[#777777]">{t('planners.hero.cardMeta')}</div>
                  </div>
                  <span className="text-[10px] font-mono tabular-nums text-[#8B806F] bg-white px-2 py-0.5 rounded border border-[#E8E8E5]">
                    {t('planners.hero.cardBadge')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Studio Capabilities */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">
              {t('planners.capabilities.eyebrow')}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[#252525] mt-2 leading-tight">
              {t('planners.capabilities.title')}
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-3 leading-relaxed">
              {t('planners.capabilities.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {plannerCapabilities.map((cap, idx) => (
              <div
                key={idx}
                className="p-6 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg shadow-subtle flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-md bg-white border border-[#E8E8E5] flex items-center justify-center">
                    {cap.icon}
                  </div>
                  <h3 className="text-base font-semibold text-[#252525]">{cap.title}</h3>
                  <p className="text-xs sm:text-sm text-[#777777] leading-relaxed">{cap.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Deep-Dive & Screenshot */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">
                {t('planners.workflow.eyebrow')}
              </span>
              <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525] leading-tight">
                {t('planners.workflow.title')}
              </h2>
              <p className="text-xs md:text-sm text-[#777777] leading-relaxed">
                {t('planners.workflow.subtitle')}
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#252525] text-white text-[11px] font-mono flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <div>
                    <h4 className="text-xs font-semibold text-[#252525]">{t('planners.workflow.s1Title')}</h4>
                    <p className="text-xs text-[#777777] mt-0.5">{t('planners.workflow.s1Desc')}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#252525] text-white text-[11px] font-mono flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <div>
                    <h4 className="text-xs font-semibold text-[#252525]">{t('planners.workflow.s2Title')}</h4>
                    <p className="text-xs text-[#777777] mt-0.5">{t('planners.workflow.s2Desc')}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#252525] text-white text-[11px] font-mono flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <div>
                    <h4 className="text-xs font-semibold text-[#252525]">{t('planners.workflow.s3Title')}</h4>
                    <p className="text-xs text-[#777777] mt-0.5">{t('planners.workflow.s3Desc')}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-wrap gap-4 text-xs font-medium">
                <a
                  href={getLocalizedPath('/white-label-wedding-software')}
                  onClick={(e) => handleLinkClick(e, '/white-label-wedding-software')}
                  className="text-[#8B806F] hover:underline flex items-center gap-1"
                >
                  {t('planners.workflow.link1')}
                </a>
                <a
                  href={getLocalizedPath('/wedding-rsvp-management')}
                  onClick={(e) => handleLinkClick(e, '/wedding-rsvp-management')}
                  className="text-[#8B806F] hover:underline flex items-center gap-1"
                >
                  {t('planners.workflow.link2')}
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-lg overflow-hidden border border-[#E8E8E5] shadow-card bg-white p-2">
                <div className="aspect-[16/10] overflow-hidden rounded relative">
                  <img
                    src={celebrationVenueImage}
                    alt={t('planners.workflow.imageAlt')}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    width={800}
                    height={500}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex items-end p-6">
                    <div className="text-white space-y-1">
                      <div className="text-xs font-mono text-white/80">{t('planners.workflow.screenTag')}</div>
                      <div className="text-sm font-medium">{t('planners.workflow.quote')}</div>
                      <div className="text-[11px] text-white/60">{t('planners.workflow.author')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Internal Solution Cross-Links */}
      <section className="py-16 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-[#8B806F] uppercase tracking-wider">
              {t('planners.crossLinksTitle')}
            </h3>
            <p className="text-base font-serif text-[#252525] mt-1">
              {t('planners.crossLinksSubtitle')}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {crossLinks.map((link) => (
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
              {t('planners.faqEyebrow')}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525]">
              {t('planners.faqTitle')}
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
            <h3 className="font-serif text-2xl text-[#252525]">{t('planners.bottomCta.title')}</h3>
            <p className="text-xs sm:text-sm text-[#777777] max-w-md mx-auto">
              {t('planners.bottomCta.subtitle')}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/login')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {t('planners.bottomCta.cta')}
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
