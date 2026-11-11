import React from 'react';
import { Clock, MapPin } from 'lucide-react';
import { WebsiteSection, WebsiteDesignConfig } from '../types';
import { WeddingEvent } from '../../types';
import { useEventTranslation } from '../../lib/i18n/TranslationContext';

interface SectionProps {
  section: WebsiteSection;
  design: WebsiteDesignConfig;
  project: WeddingEvent | null;
}

export const ScheduleSection: React.FC<SectionProps> = ({ section, design }) => {
  const { t } = useEventTranslation();
  const content = section.content || {};
  const events = content.events || [];
  const p = design.palette;

  return (
    <section 
      id="schedule"
      className="py-20 sm:py-28 px-6 border-b"
      style={{
        backgroundColor: p.surface,
        borderColor: p.border,
        color: p.text
      }}
    >
      <div className="max-w-3xl mx-auto space-y-16">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest" style={{ color: p.accent }}>
            <Clock className="w-3.5 h-3.5" />
            <span>{t('schedule.itinerary', 'Itinerary')}</span>
          </div>
          <h2 
            className="text-3xl sm:text-5xl font-normal tracking-tight"
            style={{ fontFamily: design.typography.headingFont, color: p.primary }}
          >
            {t(`section.${section.id}.headline`, content.headline || 'Wedding Day Schedule')}
          </h2>
          <p className="text-xs sm:text-sm max-w-md mx-auto" style={{ color: p.subtleText }}>
            {t(`section.${section.id}.subheadline`, content.subheadline || 'Join us for every magical moment of our celebration.')}
          </p>
        </div>

        {/* Timeline Stack */}
        <div className="relative border-l-2 ml-4 sm:ml-8 space-y-10" style={{ borderColor: p.border }}>
          {events.map((ev) => {
            const eventTitle = t(`section.${section.id}.event.${ev.id}.title`, ev.title);
            const eventDesc = ev.description ? t(`section.${section.id}.event.${ev.id}.description`, ev.description) : undefined;
            const eventLoc = ev.location ? t(`section.${section.id}.event.${ev.id}.location`, ev.location) : undefined;
            return (
              <div key={ev.id} className="relative pl-6 sm:pl-10 group">
                {/* Timeline Dot Indicator */}
                <div 
                  className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 bg-white transition-transform group-hover:scale-125"
                  style={{ borderColor: p.accent }}
                />

                <div 
                  className="p-5 sm:p-6 rounded-2xl border transition-all hover:shadow-sm"
                  style={{
                    backgroundColor: p.background,
                    borderColor: p.border
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span 
                      className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ backgroundColor: p.surface, color: p.accent, border: `1px solid ${p.border}` }}
                    >
                      {ev.time}
                    </span>
                    {eventLoc && (
                      <span className="flex items-center gap-1 text-[11px] text-stone-500 font-medium">
                        <MapPin className="w-3 h-3 text-amber-600" />
                        <span>{eventLoc}</span>
                      </span>
                    )}
                  </div>

                  <h3 
                    className="text-lg sm:text-xl font-normal mb-1"
                    style={{ fontFamily: design.typography.headingFont, color: p.primary }}
                  >
                    {eventTitle}
                  </h3>
                  {eventDesc && (
                    <p className="text-xs sm:text-sm leading-relaxed" style={{ color: p.subtleText }}>
                      {eventDesc}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
