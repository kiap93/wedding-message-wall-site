import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Users,
  ShieldCheck,
  Camera,
  ChevronDown,
  Key,
} from 'lucide-react';
import MarketingLayout from '../../layouts/MarketingLayout';
import Button from '../../design-system/components/Button';
import { useMarketingTranslation } from '../../lib/i18n/MarketingTranslationContext';

export default function WeddingGuestManagement() {
  const navigate = useNavigate();
  const { t, getLocalizedPath } = useMarketingTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    navigate(getLocalizedPath(href));
  };

  const guestTools = [
    {
      title: t('guestMgmt.tools.t1Title'),
      description: t('guestMgmt.tools.t1Desc'),
      icon: <Users className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('guestMgmt.tools.t2Title'),
      description: t('guestMgmt.tools.t2Desc'),
      icon: <ShieldCheck className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('guestMgmt.tools.t3Title'),
      description: t('guestMgmt.tools.t3Desc'),
      icon: <Key className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('guestMgmt.tools.t4Title'),
      description: t('guestMgmt.tools.t4Desc'),
      icon: <Camera className="w-5 h-5 text-[#8B806F]" />,
    },
  ];

  const faqs = [
    { q: t('guestMgmt.faqs.q1'), a: t('guestMgmt.faqs.a1') },
    { q: t('guestMgmt.faqs.q2'), a: t('guestMgmt.faqs.a2') },
    { q: t('guestMgmt.faqs.q3'), a: t('guestMgmt.faqs.a3') },
    { q: t('guestMgmt.faqs.q4'), a: t('guestMgmt.faqs.a4') },
  ];

  const relatedLinks = [
    { href: '/wedding-reception-display', title: t('common.cards.display.title'), desc: t('common.cards.display.desc') },
    { href: '/wedding-rsvp-management', title: t('common.cards.rsvp.title'), desc: t('common.cards.rsvp.desc') },
    { href: '/digital-wedding-invitations', title: t('common.cards.invitations.title'), desc: t('common.cards.invitations.desc') },
    { href: '/wedding-planner-software', title: t('common.cards.studio.title'), desc: t('common.cards.studio.desc') },
    { href: '/white-label-wedding-software', title: t('common.cards.whiteLabel.title'), desc: t('common.cards.whiteLabel.desc') },
  ];

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="pt-16 pb-20 md:pt-24 md:pb-28 border-b border-[#E8E8E5]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-[#736959] bg-[#EFECE6] px-2.5 py-1 rounded">
                <span>{t('guestMgmt.hero.badgeLeft')}</span>
                <span className="text-[#8B806F]">·</span>
                <span>{t('guestMgmt.hero.badgeRight')}</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#252525] leading-[1.12]">
                {t('guestMgmt.hero.title')}
              </h1>

              <p className="text-sm md:text-base text-[#777777] max-w-xl leading-relaxed">
                {t('guestMgmt.hero.subtitle')}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/login')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {t('guestMgmt.hero.primaryCta')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate(getLocalizedPath('/wedding-reception-display'))}
                >
                  {t('guestMgmt.hero.secondaryCta')}
                </Button>
              </div>

              <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-[#777777]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('guestMgmt.hero.bullet1')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('guestMgmt.hero.bullet2')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('guestMgmt.hero.bullet3')}</span>
                </div>
              </div>
            </div>

            {/* Right Visual: Moderation Queue Mockup */}
            <div className="lg:col-span-5 relative">
              <div className="rounded-lg border border-[#E8E8E5] shadow-card bg-white p-4 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E5] text-xs">
                  <div>
                    <span className="font-semibold text-[#252525]">{t('guestMgmt.hero.queueTitle')}</span>
                    <span className="text-[11px] text-[#777777] block">{t('guestMgmt.hero.queueSub')}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#8B806F] bg-[#FAF9F7] px-2 py-0.5 rounded border border-[#E8E8E5]">
                    {t('guestMgmt.hero.pendingBadge')}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-[#FAF9F7] rounded border border-[#E8E8E5] space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-[#252525]">{t('guestMgmt.hero.msg1Author')}</span>
                      <span className="text-[#777777] font-mono">{t('guestMgmt.hero.msg1Meta')}</span>
                    </div>
                    <p className="text-[11px] text-[#555555] italic">
                      {t('guestMgmt.hero.msg1Text')}
                    </p>
                    <div className="flex justify-end gap-2 pt-1 border-t border-[#EFEFEA]">
                      <button type="button" className="px-2 py-1 text-[11px] text-[#777777] hover:text-red-600 rounded">
                        {t('guestMgmt.hero.declineBtn')}
                      </button>
                      <button type="button" className="px-2.5 py-1 text-[11px] bg-[#252525] text-white rounded font-medium">
                        {t('guestMgmt.hero.approveBtn')}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded border border-emerald-200 bg-emerald-50/40 space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-[#252525]">{t('guestMgmt.hero.msg2Author')}</span>
                      <span className="text-emerald-700 font-mono text-[10px]">{t('guestMgmt.hero.approvedBadge')}</span>
                    </div>
                    <p className="text-[11px] text-[#555555]">
                      {t('guestMgmt.hero.msg2Text')}
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center text-[11px] text-[#777777] border-t border-[#E8E8E5]">
                  <span>{t('guestMgmt.hero.autoApproveOff')}</span>
                  <span className="font-mono text-[#8B806F]">{t('guestMgmt.hero.confirmedCount')}</span>
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
              {t('guestMgmt.tools.eyebrow')}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[#252525] mt-2 leading-tight">
              {t('guestMgmt.tools.title')}
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-3 leading-relaxed">
              {t('guestMgmt.tools.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {guestTools.map((tool, idx) => (
              <div
                key={idx}
                className="p-6 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg shadow-subtle flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-md bg-white border border-[#E8E8E5] flex items-center justify-center">
                    {tool.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-[#252525]">{tool.title}</h3>
                  <p className="text-xs text-[#777777] leading-relaxed">{tool.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Internal Navigation Links */}
      <section className="py-16 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-[#8B806F] uppercase tracking-wider">
              {t('common.relatedSolutions')}
            </h3>
            <p className="text-base font-serif text-[#252525] mt-1">{t('guestMgmt.relatedSubtitle')}</p>
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

      {/* FAQ Section */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center space-y-2 mb-12">
            <span className="text-xs font-medium text-[#8B806F] tracking-wider uppercase">
              {t('common.faqEyebrow')}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525]">
              {t('guestMgmt.faqTitle')}
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg overflow-hidden transition-colors"
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
            <h3 className="font-serif text-2xl text-[#252525]">{t('guestMgmt.bottomCta.title')}</h3>
            <p className="text-xs sm:text-sm text-[#777777] max-w-md mx-auto">
              {t('guestMgmt.bottomCta.subtitle')}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/login')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {t('guestMgmt.bottomCta.cta')}
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
