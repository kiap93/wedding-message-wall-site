import React from 'react';
import { Calendar, MapPin, Heart, ArrowDown } from 'lucide-react';
import { WebsiteSection, WebsiteDesignConfig } from '../types';
import { WeddingEvent } from '../../types';
import { useEventTranslation } from '../../lib/i18n/TranslationContext';

interface SectionProps {
  section: WebsiteSection;
  design: WebsiteDesignConfig;
  project: WeddingEvent | null;
  isEditor?: boolean;
}

export const HeroSection: React.FC<SectionProps> = ({ section, design, project }) => {
  const { t } = useEventTranslation();
  const sId = section.id || section.type;
  const content = section.content || {};
  const groom = project?.groom_name || 'Lucas';
  const bride = project?.bride_name || 'Sofia';
  const rawHeadline = content.headline || `${groom} & ${bride}`;
  const headline = t(`section.${sId}.headline`, rawHeadline);
  const rawSubheadline = content.subheadline || 'Together with their families, invite you to celebrate their wedding day';
  const subheadline = t(`section.${sId}.subheadline`, t('hero.default_subheadline', rawSubheadline));
  const dateStr = project?.wedding_date 
    ? new Date(project.wedding_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Saturday, September 20, 2025';
  const location = project?.location || 'San Francisco, CA';
  const bgImage = content.backgroundImage || project?.image_url || 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1600';
  const overlayOpacity = (content.overlayOpacity ?? 45) / 100;

  return (
    <section 
      className="relative min-h-[85vh] flex items-center justify-center text-center px-6 py-24 overflow-hidden bg-stone-900 text-white"
      style={{
        fontFamily: design.typography.bodyFont
      }}
    >
      {/* Background Photo */}
      <div className="absolute inset-0 z-0">
        <img 
          src={bgImage} 
          alt="Wedding Hero" 
          className="w-full h-full object-cover object-center filter brightness-95" 
        />
        <div 
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity }}
        />
        <div 
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" 
        />
      </div>

      {/* Content Container */}
      <div className="relative z-10 max-w-4xl mx-auto space-y-8 animate-fade-in">
        {/* Monogram / Top Subtitle */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-xs tracking-widest uppercase font-mono border border-white/20">
          <Heart className="w-3.5 h-3.5 fill-amber-300 text-amber-300 animate-pulse" />
          <span>{t('hero.badge', 'The Wedding Celebration')}</span>
        </div>

        {/* Couple Names */}
        <h1 
          className="text-5xl sm:text-7xl md:text-8xl tracking-tight leading-none drop-shadow-md"
          style={{ 
            fontFamily: design.typography.headingFont,
            color: '#FFFFFF'
          }}
        >
          {headline}
        </h1>

        {/* Narrative Tagline */}
        <p className="text-sm sm:text-lg text-stone-200 max-w-2xl mx-auto font-light leading-relaxed drop-shadow">
          {subheadline}
        </p>

        {/* Date & Location Pill Strip */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg border border-white/15 text-xs sm:text-sm">
            <Calendar className="w-4 h-4 text-amber-300" />
            <span className="font-medium tracking-wide">{dateStr}</span>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg border border-white/15 text-xs sm:text-sm">
            <MapPin className="w-4 h-4 text-amber-300" />
            <span className="font-medium tracking-wide">{location}</span>
          </div>
        </div>

        {/* Call to Actions */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
          <a
            href={content.buttonLink || '#rsvp'}
            className="px-8 py-3.5 rounded-full text-xs sm:text-sm font-semibold tracking-wider uppercase transition-all transform hover:scale-105 active:scale-95 shadow-xl bg-amber-500 hover:bg-amber-400 text-stone-900 border border-amber-300/40"
          >
            {content.buttonText || 'RSVP Today'}
          </a>
          <a
            href={content.secondaryButtonLink || '#story'}
            className="px-8 py-3.5 rounded-full text-xs sm:text-sm font-medium tracking-wider uppercase transition-all bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/30"
          >
            {content.secondaryButtonText || 'Our Story'}
          </a>
        </div>
      </div>

      {/* Subtle Scroll Down Prompt */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 text-[11px] text-white/60 font-mono tracking-widest uppercase">
        <span>Scroll to Explore</span>
        <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
      </div>
    </section>
  );
};
