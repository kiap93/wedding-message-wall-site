import React from 'react';
import { MessageSquare, Star, Sparkles, Send } from 'lucide-react';
import { WebsiteSection, WebsiteDesignConfig } from '../types';
import { WeddingEvent } from '../../types';

interface SectionProps {
  section: WebsiteSection;
  design: WebsiteDesignConfig;
  project: WeddingEvent | null;
}

export const WallSection: React.FC<SectionProps> = ({ section, design, project }) => {
  const content = section.content || {};
  const p = design.palette;
  const guestUrl = project?.slug ? `/${project.slug}/guest` : '#';

  const previewNotes = [
    { name: 'Sarah & David', text: 'Wishing you both a lifetime of boundless adventure, deep laughter, and eternal love!', time: 'Moments ago' },
    { name: 'The Miller Family', text: 'An exquisitely beautiful celebration for two wonderful souls. Cheers to Lucas and Sofia!', time: '10m ago' },
    { name: 'Grandma Betty', text: 'So immensely proud and filled with joy to celebrate this unforgettable milestone today.', time: '25m ago' },
  ];

  return (
    <section 
      id="wall"
      className="py-20 sm:py-28 px-6 border-b"
      style={{
        backgroundColor: p.background,
        borderColor: p.border,
        color: p.text
      }}
    >
      <div className="max-w-4xl mx-auto space-y-12 text-center">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest" style={{ color: p.accent }}>
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Interactive Guestbook</span>
          </div>
          <h2 
            className="text-3xl sm:text-5xl font-normal tracking-tight"
            style={{ fontFamily: design.typography.headingFont, color: p.primary }}
          >
            {content.headline || 'Warm Wishes & Guest Wall'}
          </h2>
          <p className="text-xs sm:text-sm max-w-md mx-auto" style={{ color: p.subtleText }}>
            {content.subheadline || 'Send your love and heartfelt blessings. Notes appear live on the ballroom projector during the reception.'}
          </p>
        </div>

        {/* Live Ballroom Indicator Strip */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Live Ballroom Reception Screen Connected</span>
        </div>

        {/* Notes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-left">
          {previewNotes.map((note, idx) => (
            <div 
              key={idx}
              className="p-6 rounded-2xl border shadow-sm space-y-3 transition-transform hover:-translate-y-1 flex flex-col justify-between"
              style={{
                backgroundColor: p.surface,
                borderColor: p.border
              }}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-900">{note.name}</span>
                  <Sparkles className="w-3 h-3 text-amber-500" />
                </div>
                <p className="text-xs sm:text-sm italic leading-relaxed text-stone-700">
                  "{note.text}"
                </p>
              </div>

              <span className="text-[10px] font-mono tracking-wider uppercase text-stone-400 block pt-2 border-t border-stone-100">
                {note.time}
              </span>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <div className="pt-4">
          <a
            href={guestUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-xs font-semibold tracking-wider uppercase transition-all shadow-md hover:scale-105 active:scale-95"
            style={{
              backgroundColor: p.primary,
              color: '#FFFFFF'
            }}
          >
            <Send className="w-3.5 h-3.5" />
            <span>{content.buttonText || 'Leave a Message for the Couple'}</span>
          </a>
        </div>
      </div>
    </section>
  );
};
