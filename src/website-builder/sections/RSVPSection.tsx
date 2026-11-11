import React, { useState } from 'react';
import { CheckCircle2, Calendar, Users, Heart } from 'lucide-react';
import { WebsiteSection, WebsiteDesignConfig } from '../types';
import { WeddingEvent } from '../../types';
import { useEventTranslation } from '../../lib/i18n/TranslationContext';

interface SectionProps {
  section: WebsiteSection;
  design: WebsiteDesignConfig;
  project: WeddingEvent | null;
}

export const RSVPSection: React.FC<SectionProps> = ({ section, design, project }) => {
  const { t } = useEventTranslation();
  const content = section.content || {};
  const deadline = content.rsvpDeadline || 'August 15, 2025';
  const p = design.palette;
  const rsvpUrl = project?.slug ? `/${project.slug}/rsvp` : '#';

  const [attending, setAttending] = useState<'yes' | 'no' | null>(null);

  return (
    <section 
      id="rsvp"
      className="py-20 sm:py-28 px-6 border-b text-center relative overflow-hidden"
      style={{
        backgroundColor: p.surface,
        borderColor: p.border,
        color: p.text
      }}
    >
      <div className="max-w-2xl mx-auto space-y-8 relative z-10">
        <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest px-3.5 py-1 rounded-full border" style={{ backgroundColor: p.background, borderColor: p.border, color: p.accent }}>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>{t('rsvp.attendanceConfirmation', 'Attendance Confirmation')}</span>
        </div>

        <div className="space-y-3">
          <h2 
            className="text-3xl sm:text-5xl font-normal tracking-tight"
            style={{ fontFamily: design.typography.headingFont, color: p.primary }}
          >
            {t(`section.${section.id}.headline`, content.headline || 'RSVP to Celebrate With Us')}
          </h2>
          <p className="text-xs sm:text-sm max-w-md mx-auto leading-relaxed" style={{ color: p.subtleText }}>
            {t(`section.${section.id}.subheadline`, content.subheadline || `Kindly confirm your attendance by ${deadline} so we can prepare for your celebration.`)}
          </p>
        </div>

        {/* Quick Decision Buttons */}
        <div className="p-8 rounded-3xl border shadow-sm space-y-6" style={{ backgroundColor: p.background, borderColor: p.border }}>
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-700">
            {t('rsvp.willYouBeJoiningUs', 'Will you be joining us?')}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => setAttending('yes')}
              className={`px-8 py-3.5 rounded-full text-xs sm:text-sm font-semibold tracking-wider uppercase transition-all shadow-md ${
                attending === 'yes' 
                  ? 'bg-emerald-700 text-white ring-2 ring-emerald-400' 
                  : 'bg-white hover:bg-stone-50 text-stone-800 border border-stone-300'
              }`}
            >
              {t('rsvp.joyfullyAccepts', 'Joyfully Accepts')}
            </button>
            <button
              onClick={() => setAttending('no')}
              className={`px-8 py-3.5 rounded-full text-xs sm:text-sm font-semibold tracking-wider uppercase transition-all shadow-sm ${
                attending === 'no' 
                  ? 'bg-stone-800 text-white ring-2 ring-stone-500' 
                  : 'bg-white hover:bg-stone-50 text-stone-700 border border-stone-300'
              }`}
            >
              {t('rsvp.regretfullyDeclines', 'Regretfully Declines')}
            </button>
          </div>

          <div className="pt-2">
            <a
              href={rsvpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-xs font-semibold tracking-wider uppercase transition-all shadow-lg hover:scale-105 active:scale-95"
              style={{
                backgroundColor: p.primary,
                color: '#FFFFFF'
              }}
            >
              <Heart className="w-3.5 h-3.5 fill-current text-rose-400" />
              <span>{t(`section.${section.id}.buttonText`, content.buttonText || t('rsvp.completeFullRSVP', 'Complete Full RSVP Questionnaire'))}</span>
            </a>
          </div>

          <p className="text-[11px] font-mono" style={{ color: p.subtleText }}>
            {t('rsvp.includesMealPreference', 'Includes meal preference selection, party headcount & dietary notes')}
          </p>
        </div>
      </div>
    </section>
  );
};
