import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Sliders,
  Utensils,
  FileSpreadsheet,
  ChevronDown,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import MarketingLayout from '../../layouts/MarketingLayout';
import Button from '../../design-system/components/Button';
import { useMarketingTranslation } from '../../lib/i18n/MarketingTranslationContext';

export default function WeddingRsvpManagement() {
  const navigate = useNavigate();
  const { t, getLocalizedPath } = useMarketingTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    navigate(getLocalizedPath(href));
  };

  const rsvpFeatures = [
    {
      title: t('rsvp.features.f1Title'),
      description: t('rsvp.features.f1Desc'),
      icon: <Sliders className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('rsvp.features.f2Title'),
      description: t('rsvp.features.f2Desc'),
      icon: <Utensils className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('rsvp.features.f3Title'),
      description: t('rsvp.features.f3Desc'),
      icon: <FileSpreadsheet className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: t('rsvp.features.f4Title'),
      description: t('rsvp.features.f4Desc'),
      icon: <ShieldCheck className="w-5 h-5 text-[#8B806F]" />,
    },
  ];

  const sampleQuestions = [
    { field: t('rsvp.logic.rows.r1Field'), type: t('rsvp.logic.rows.r1Type'), condition: t('rsvp.logic.rows.r1Cond') },
    { field: t('rsvp.logic.rows.r2Field'), type: t('rsvp.logic.rows.r2Type'), condition: t('rsvp.logic.rows.r2Cond') },
    { field: t('rsvp.logic.rows.r3Field'), type: t('rsvp.logic.rows.r3Type'), condition: t('rsvp.logic.rows.r3Cond') },
    { field: t('rsvp.logic.rows.r4Field'), type: t('rsvp.logic.rows.r4Type'), condition: t('rsvp.logic.rows.r4Cond') },
    { field: t('rsvp.logic.rows.r5Field'), type: t('rsvp.logic.rows.r5Type'), condition: t('rsvp.logic.rows.r5Cond') },
    { field: t('rsvp.logic.rows.r6Field'), type: t('rsvp.logic.rows.r6Type'), condition: t('rsvp.logic.rows.r6Cond') },
  ];

  const faqs = [
    { q: t('rsvp.faqs.q1'), a: t('rsvp.faqs.a1') },
    { q: t('rsvp.faqs.q2'), a: t('rsvp.faqs.a2') },
    { q: t('rsvp.faqs.q3'), a: t('rsvp.faqs.a3') },
    { q: t('rsvp.faqs.q4'), a: t('rsvp.faqs.a4') },
  ];

  const relatedLinks = [
    { href: '/wedding-guest-management', title: t('common.cards.guest.title'), desc: t('common.cards.guest.desc') },
    { href: '/wedding-seating-chart', title: t('common.cards.seating.title'), desc: t('common.cards.seating.desc') },
    { href: '/wedding-website-builder', title: t('common.cards.website.title'), desc: t('common.cards.website.desc') },
    { href: '/digital-wedding-invitations', title: t('common.cards.invitations.title'), desc: t('common.cards.invitations.desc') },
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
                <span>{t('rsvp.hero.badgeLeft')}</span>
                <span className="text-[#8B806F]">·</span>
                <span>{t('rsvp.hero.badgeRight')}</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#252525] leading-[1.12]">
                {t('rsvp.hero.title')}
              </h1>

              <p className="text-sm md:text-base text-[#777777] max-w-xl leading-relaxed">
                {t('rsvp.hero.subtitle')}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/login')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {t('rsvp.hero.primaryCta')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate(getLocalizedPath('/wedding-guest-management'))}
                >
                  {t('rsvp.hero.secondaryCta')}
                </Button>
              </div>

              <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-[#777777]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('rsvp.hero.bullet1')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('rsvp.hero.bullet2')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>{t('rsvp.hero.bullet3')}</span>
                </div>
              </div>
            </div>

            {/* Right Visual: RSVP Card Mockup */}
            <div className="lg:col-span-5 relative">
              <div className="rounded-lg border border-[#E8E8E5] shadow-card bg-white p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E5]">
                  <div>
                    <span className="text-xs font-semibold text-[#252525]">{t('rsvp.hero.cardTitle')}</span>
                    <span className="text-[11px] text-[#777777] block">{t('rsvp.hero.cardSubtitle')}</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {t('rsvp.hero.live')}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[11px] text-[#777777] block mb-1">{t('rsvp.hero.labelName')}</label>
                    <div className="p-2 bg-[#FAF9F7] rounded border border-[#E8E8E5] font-medium text-[#252525]">
                      {t('rsvp.hero.sampleName')}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-[#777777] block mb-1">{t('rsvp.hero.labelAttending')}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-[#252525] text-white rounded text-center font-medium flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t('rsvp.hero.attendingBtn')}</span>
                      </div>
                      <div className="p-2 bg-[#FAF9F7] text-[#777777] rounded text-center border border-[#E8E8E5]">
                        {t('rsvp.hero.decliningBtn')}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-[#FAF9F7] rounded border border-[#E8E8E5] space-y-2">
                    <span className="text-[10px] font-mono text-[#8B806F] uppercase">{t('rsvp.hero.conditionalTag')}</span>
                    <div className="text-xs font-medium text-[#252525]">{t('rsvp.hero.mealSelectionsLabel')}</div>
                    <div className="text-[11px] text-[#555555]">
                      {t('rsvp.hero.mealLine1')}<br />
                      {t('rsvp.hero.mealLine2')}
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center text-[11px] text-[#777777] border-t border-[#E8E8E5]">
                  <span>{t('rsvp.hero.totalResponses')}</span>
                  <span className="font-mono text-[#8B806F]">{t('rsvp.hero.turnout')}</span>
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
              {t('rsvp.features.eyebrow')}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[#252525] mt-2 leading-tight">
              {t('rsvp.features.title')}
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-3 leading-relaxed">
              {t('rsvp.features.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {rsvpFeatures.map((feat, idx) => (
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

      {/* Questionnaire Field Breakdown Table */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center space-y-2 mb-12">
            <span className="text-xs font-medium text-[#8B806F] tracking-wider uppercase">
              {t('rsvp.logic.eyebrow')}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525]">
              {t('rsvp.logic.title')}
            </h2>
            <p className="text-xs sm:text-sm text-[#777777] max-w-xl mx-auto">
              {t('rsvp.logic.subtitle')}
            </p>
          </div>

          <div className="bg-white rounded-lg border border-[#E8E8E5] shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF9F7] border-b border-[#E8E8E5] text-[#777777]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">{t('rsvp.logic.colField')}</th>
                    <th className="py-3 px-4 font-semibold">{t('rsvp.logic.colType')}</th>
                    <th className="py-3 px-4 font-semibold">{t('rsvp.logic.colCondition')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEFEA]">
                  {sampleQuestions.map((q, idx) => (
                    <tr key={idx} className="hover:bg-[#FAF9F7]/50">
                      <td className="py-3.5 px-4 font-medium text-[#252525]">{q.field}</td>
                      <td className="py-3.5 px-4 text-[#777777] font-mono text-[11px]">{q.type}</td>
                      <td className="py-3.5 px-4 text-[#8B806F]">{q.condition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            <p className="text-base font-serif text-[#252525] mt-1">{t('rsvp.relatedSubtitle')}</p>
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
              {t('rsvp.faqTitle')}
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
            <h2 className="font-serif text-2xl text-[#252525]">{t('rsvp.bottomCta.title')}</h2>
            <p className="text-xs sm:text-sm text-[#777777] max-w-md mx-auto">
              {t('rsvp.bottomCta.subtitle')}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/login')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {t('rsvp.bottomCta.cta')}
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
