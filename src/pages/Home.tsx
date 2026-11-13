import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Layers,
  Sliders,
  ChevronDown,
  Globe,
  MessageSquare,
} from 'lucide-react';
import { EVENT_PRICING, formatPrice } from '../config/pricing';
import MarketingLayout from '../layouts/MarketingLayout';
import Button from '../design-system/components/Button';
import { useMarketingTranslation } from '../lib/i18n/MarketingTranslationContext';
import heroWeddingImage from '../assets/images/hero_wedding_editorial_1793501242401.jpg';
import invitationCraftImage from '../assets/images/invitation_craft_showcase_1793501242453.jpg';
import celebrationVenueImage from '../assets/images/celebration_venue_mood_1793501242406.jpg';

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, getLocalizedPath } = useMarketingTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (location.pathname === '/pricing') {
      const el = document.getElementById('pricing');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [location.pathname]);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    navigate(getLocalizedPath(href));
  };

  const features = [
    {
      title: t('home.craft.features.stationeryTitle'),
      description: t('home.craft.features.stationeryDesc'),
      icon: <Layers className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('home.craft.features.moderationTitle'),
      description: t('home.craft.features.moderationDesc'),
      icon: <MessageSquare className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('home.craft.features.subdomainTitle'),
      description: t('home.craft.features.subdomainDesc'),
      icon: <Globe className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('home.craft.features.rsvpTitle'),
      description: t('home.craft.features.rsvpDesc'),
      icon: <Sliders className="w-5 h-5 text-[#8B806F]" />,
    },
  ];

  const faqs = [
    { q: t('home.faq.items.q1'), a: t('home.faq.items.a1') },
    { q: t('home.faq.items.q2'), a: t('home.faq.items.a2') },
    { q: t('home.faq.items.q3'), a: t('home.faq.items.a3') },
    { q: t('home.faq.items.q4'), a: t('home.faq.items.a4') },
    { q: t('home.faq.items.q5'), a: t('home.faq.items.a5') },
  ];

  const ecosystemCards = [
    {
      href: '/wedding-planner-software',
      tag: t('home.ecosystem.cards.planner.tag'),
      title: t('home.ecosystem.cards.planner.title'),
      desc: t('home.ecosystem.cards.planner.desc'),
      cta: t('home.ecosystem.cards.planner.cta'),
    },
    {
      href: '/white-label-wedding-software',
      tag: t('home.ecosystem.cards.whiteLabel.tag'),
      title: t('home.ecosystem.cards.whiteLabel.title'),
      desc: t('home.ecosystem.cards.whiteLabel.desc'),
      cta: t('home.ecosystem.cards.whiteLabel.cta'),
    },
    {
      href: '/digital-wedding-invitations',
      tag: t('home.ecosystem.cards.invitations.tag'),
      title: t('home.ecosystem.cards.invitations.title'),
      desc: t('home.ecosystem.cards.invitations.desc'),
      cta: t('home.ecosystem.cards.invitations.cta'),
    },
    {
      href: '/wedding-rsvp-management',
      tag: t('home.ecosystem.cards.rsvp.tag'),
      title: t('home.ecosystem.cards.rsvp.title'),
      desc: t('home.ecosystem.cards.rsvp.desc'),
      cta: t('home.ecosystem.cards.rsvp.cta'),
    },
    {
      href: '/wedding-guest-management',
      tag: t('home.ecosystem.cards.guest.tag'),
      title: t('home.ecosystem.cards.guest.title'),
      desc: t('home.ecosystem.cards.guest.desc'),
      cta: t('home.ecosystem.cards.guest.cta'),
    },
    {
      href: '/wedding-reception-display',
      tag: t('home.ecosystem.cards.display.tag'),
      title: t('home.ecosystem.cards.display.title'),
      desc: t('home.ecosystem.cards.display.desc'),
      cta: t('home.ecosystem.cards.display.cta'),
    },
  ];

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="pt-16 pb-20 md:pt-24 md:pb-28 border-b border-[#E8E8E5]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Left Content (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-[#736959] bg-[#EFECE6] px-2.5 py-1 rounded">
                <span>{t('home.hero.badgeLeft')}</span>
                <span className="text-[#8B806F]">·</span>
                <span>{t('home.hero.badgeRight')}</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#252525] leading-[1.12]">
                {t('home.hero.title')}
              </h1>

              <p className="text-sm md:text-base text-[#777777] max-w-xl leading-relaxed">
                {t('home.hero.subtitle')}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/login')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {t('home.hero.primaryCta')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate(getLocalizedPath('/templates'))}
                >
                  {t('home.hero.secondaryCta')}
                </Button>
              </div>

              <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-[#777777]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('home.hero.bullet1')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('home.hero.bullet2')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('home.hero.bullet3')}</span>
                </div>
              </div>
            </div>

            {/* Right Visual (5 cols) */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-lg overflow-hidden border border-[#E8E8E5] shadow-card bg-white p-2">
                <div className="aspect-[4/3] overflow-hidden rounded">
                  <img
                    src={heroWeddingImage}
                    alt={t('home.hero.imageAlt')}
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
                    <div className="text-xs font-semibold text-[#252525]">{t('home.hero.cardCouple')}</div>
                    <div className="text-[11px] text-[#777777]">{t('home.hero.cardMeta')}</div>
                  </div>
                  <span className="text-[10px] font-mono tabular-nums text-[#8B806F] bg-white px-2 py-0.5 rounded border border-[#E8E8E5]">
                    {t('home.hero.cardBadge')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrated Product Ecosystem Grid */}
      <section className="py-16 md:py-20 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div>
              <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">
                {t('home.ecosystem.eyebrow')}
              </span>
              <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[#252525] mt-1">
                {t('home.ecosystem.title')}
              </h2>
            </div>
            <p className="text-xs md:text-sm text-[#777777] max-w-md">
              {t('home.ecosystem.subtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {ecosystemCards.map((card) => (
              <a
                key={card.href}
                href={getLocalizedPath(card.href)}
                onClick={(e) => handleLinkClick(e, card.href)}
                className="p-6 bg-white border border-[#E8E8E5] rounded-lg shadow-subtle hover:border-[#252525] transition-colors group flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <span className="text-[10px] font-mono text-[#8B806F] uppercase">{card.tag}</span>
                  <h3 className="text-base font-semibold text-[#252525] group-hover:text-[#8B806F] transition-colors flex items-center justify-between">
                    {card.title}
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-xs text-[#777777] leading-relaxed">
                    {card.desc}
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-[#EFEFEA] text-[11px] font-medium text-[#252525]">
                  {card.cta}
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Craft & Stationery Showcase Section */}
      <section id="features" className="py-20 md:py-28 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <span className="text-xs font-medium text-[#8B806F] tracking-wide">
              {t('home.craft.eyebrow')}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[#252525] mt-2 leading-tight">
              {t('home.craft.title')}
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-3 leading-relaxed">
              {t('home.craft.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center mb-16">
            <div className="rounded-lg overflow-hidden border border-[#E8E8E5] shadow-subtle bg-[#FAF9F7]">
              <img
                src={invitationCraftImage}
                alt={t('home.craft.imageAlt')}
                className="w-full h-auto object-cover"
                loading="lazy"
                decoding="async"
                width={600}
                height={400}
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="space-y-6">
              {features.map((feat, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="w-9 h-9 rounded-md bg-[#F7F7F5] border border-[#E8E8E5] flex items-center justify-center shrink-0 mt-0.5">
                    {feat.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#252525]">{feat.title}</h3>
                    <p className="text-xs text-[#777777] mt-1 leading-relaxed">{feat.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Live Reception Screen Spotlight */}
      <section id="agencies" className="py-20 md:py-28 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 space-y-5">
              <span className="text-xs font-medium text-[#8B806F]">{t('home.spotlight.eyebrow')}</span>
              <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525] leading-tight">
                {t('home.spotlight.title')}
              </h2>
              <p className="text-xs md:text-sm text-[#777777] leading-relaxed">
                {t('home.spotlight.subtitle')}
              </p>
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => navigate('/login')}
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  {t('home.spotlight.cta')}
                </Button>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-lg overflow-hidden border border-[#E8E8E5] shadow-card bg-white p-2">
                <div className="aspect-[16/9] overflow-hidden rounded relative">
                  <img
                    src={celebrationVenueImage}
                    alt={t('home.spotlight.imageAlt')}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    width={800}
                    height={450}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-6">
                    <div className="text-white space-y-1">
                      <div className="text-xs font-mono text-white/80">{t('home.spotlight.screenTag')}</div>
                      <div className="text-sm font-medium">{t('home.spotlight.quote')}</div>
                      <div className="text-[11px] text-white/60">{t('home.spotlight.author')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 md:py-28 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#8B806F]">
              {t('home.pricing.eyebrow')}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525] mt-2">
              {t('home.pricing.title', { price: formatPrice(EVENT_PRICING.pricePerEvent) })}
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-3 leading-relaxed">
              {t('home.pricing.subtitle')}
            </p>
          </div>

          {/* Main Pricing Hero Card */}
          <div className="bg-[#FAF9F7] border-2 border-[#252525] rounded-2xl p-8 sm:p-10 shadow-card max-w-3xl mx-auto relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#252525] text-white text-[11px] font-mono px-4 py-1 rounded-bl-xl tracking-wider">
              {t('home.pricing.ribbon')}
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#E8E8E5] pb-8">
              <div>
                <span className="text-xs font-mono text-[#8B806F] uppercase font-semibold">
                  {t('home.pricing.cardEyebrow')}
                </span>
                <h3 className="font-serif text-2xl font-normal text-[#252525] mt-1">
                  {t('home.pricing.cardTitle')}
                </h3>
                <p className="text-xs text-[#777777] mt-1 max-w-sm">
                  {t('home.pricing.cardDesc')}
                </p>
              </div>

              <div className="flex items-baseline gap-1.5 bg-white border border-[#E8E8E5] rounded-xl px-5 py-3 shadow-subtle shrink-0">
                <span className="text-4xl font-mono font-bold text-[#252525]">
                  {formatPrice(EVENT_PRICING.pricePerEvent)}
                </span>
                <span className="text-xs text-[#777777]">{t('home.pricing.perEvent')}</span>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 py-6 border-b border-[#E8E8E5]">
              <div className="space-y-2.5 text-xs text-[#252525]">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#8B806F] shrink-0" />
                  <span className="font-medium">{t('home.pricing.feat1')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#8B806F] shrink-0" />
                  <span>{t('home.pricing.feat2')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#8B806F] shrink-0" />
                  <span>{t('home.pricing.feat3')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#8B806F] shrink-0" />
                  <span>{t('home.pricing.feat4')}</span>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-[#252525]">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#8B806F] shrink-0" />
                  <span>{t('home.pricing.feat5')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#8B806F] shrink-0" />
                  <span>{t('home.pricing.feat6')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#8B806F] shrink-0" />
                  <span>{t('home.pricing.feat7')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#8B806F] shrink-0" />
                  <span>{t('home.pricing.feat8')}</span>
                </div>
              </div>
            </div>

            {/* Multi-Event Cost Breakdown */}
            <div className="pt-6">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#8B806F] mb-3 font-semibold">
                {t('home.pricing.multiTitle')}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-white border border-[#E8E8E5] rounded-lg shadow-subtle">
                  <div className="text-xs text-[#777777]">{t('home.pricing.tier1Label')}</div>
                  <div className="text-base font-mono font-bold text-[#252525] mt-1">$5.00</div>
                  <div className="text-[10px] text-[#888888]">{t('home.pricing.tier1Sub')}</div>
                </div>
                <div className="p-3 bg-white border border-[#E8E8E5] rounded-lg shadow-subtle">
                  <div className="text-xs text-[#777777]">{t('home.pricing.tier2Label')}</div>
                  <div className="text-base font-mono font-bold text-[#252525] mt-1">$10.00</div>
                  <div className="text-[10px] text-[#888888]">{t('home.pricing.tier2Sub')}</div>
                </div>
                <div className="p-3 bg-white border border-[#E8E8E5] rounded-lg shadow-subtle">
                  <div className="text-xs text-[#777777]">{t('home.pricing.tier3Label')}</div>
                  <div className="text-base font-mono font-bold text-[#252525] mt-1">$25.00</div>
                  <div className="text-[10px] text-[#888888]">{t('home.pricing.tier3Sub')}</div>
                </div>
                <div className="p-3 bg-white border border-[#E8E8E5] rounded-lg shadow-subtle">
                  <div className="text-xs text-[#777777]">{t('home.pricing.tier4Label')}</div>
                  <div className="text-base font-mono font-bold text-[#252525] mt-1">$50.00</div>
                  <div className="text-[10px] text-[#888888]">{t('home.pricing.tier4Sub')}</div>
                </div>
              </div>
            </div>

            <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-[#777777] text-center sm:text-left">
                {t('home.pricing.freeDraftNote')}
              </div>
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/login')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                {t('home.pricing.cta')}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 md:py-24 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-xs font-medium text-[#8B806F]">{t('home.faq.eyebrow')}</span>
            <h2 className="font-serif text-3xl font-normal text-[#252525] mt-2">
              {t('home.faq.title')}
            </h2>
          </div>

          <div className="divide-y divide-[#E8E8E5] border-y border-[#E8E8E5] bg-white rounded-lg shadow-subtle overflow-hidden">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={index} className="p-5">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full flex items-center justify-between text-left gap-4"
                  >
                    <span className="text-xs md:text-sm font-semibold text-[#252525]">{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#777777] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <p className="text-xs text-[#777777] mt-3 leading-relaxed">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-20 bg-white text-center">
        <div className="max-w-3xl mx-auto px-6 space-y-6">
          <h2 className="font-serif text-3xl md:text-5xl font-normal text-[#252525] tracking-tight">
            {t('home.finalCta.title')}
          </h2>
          <p className="text-xs md:text-sm text-[#777777] max-w-lg mx-auto leading-relaxed">
            {t('home.finalCta.subtitle')}
          </p>
          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/login')}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {t('home.finalCta.cta')}
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
