import React from 'react';
import { Heart } from 'lucide-react';
import { WebsiteSection, WebsiteDesignConfig } from '../types';
import { WeddingEvent } from '../../types';

interface SectionProps {
  section: WebsiteSection;
  design: WebsiteDesignConfig;
  project: WeddingEvent | null;
}

export const FooterSection: React.FC<SectionProps> = ({ section, design, project }) => {
  const content = section.content || {};
  const groom = project?.groom_name || 'Lucas';
  const bride = project?.bride_name || 'Sofia';
  const groomInitial = groom.charAt(0);
  const brideInitial = bride.charAt(0);
  const weddingYear = project?.wedding_date ? new Date(project.wedding_date).getFullYear() : 2025;
  const p = design.palette;

  return (
    <footer 
      className="py-16 px-6 text-center space-y-6"
      style={{
        backgroundColor: p.primary,
        color: '#FFFFFF'
      }}
    >
      <div className="max-w-xl mx-auto space-y-5">
        {/* Monogram Seal */}
        <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center border-2 border-amber-300/40 bg-white/10 text-amber-200 text-xl font-serif tracking-widest shadow-inner">
          {groomInitial}&{brideInitial}
        </div>

        <h3 
          className="text-2xl sm:text-3xl font-normal tracking-tight"
          style={{ fontFamily: design.typography.headingFont }}
        >
          {groom} & {bride}
        </h3>

        <p className="text-xs sm:text-sm text-stone-300 font-light max-w-md mx-auto leading-relaxed">
          {content.thankYouMessage || 'With immense gratitude and boundless love, thank you for being an essential part of our celebration.'}
        </p>

        <div className="pt-4 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-stone-400 font-mono">
          <span>Celebrating Love • {weddingYear}</span>
          <div className="flex items-center gap-1 text-stone-300">
            <span>Powered by</span>
            <span className="font-semibold text-white tracking-wide">EventFrame.io</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
