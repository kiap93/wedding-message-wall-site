import React from 'react';
import { Heart } from 'lucide-react';
import { WebsiteSection, WebsiteDesignConfig } from '../types';
import { WeddingEvent } from '../../types';

interface SectionProps {
  section: WebsiteSection;
  design: WebsiteDesignConfig;
  project: WeddingEvent | null;
}

export const StorySection: React.FC<SectionProps> = ({ section, design }) => {
  const content = section.content || {};
  const milestones = content.milestones || [];
  const p = design.palette;

  return (
    <section 
      id="story"
      className="py-20 sm:py-28 px-6 border-b"
      style={{
        backgroundColor: p.background,
        borderColor: p.border,
        color: p.text
      }}
    >
      <div className="max-w-4xl mx-auto space-y-16">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest" style={{ color: p.accent }}>
            <Heart className="w-3.5 h-3.5 fill-current" />
            <span>Our Journey</span>
          </div>
          <h2 
            className="text-3xl sm:text-5xl font-normal tracking-tight"
            style={{ fontFamily: design.typography.headingFont, color: p.primary }}
          >
            {content.headline || 'How Our Story Began'}
          </h2>
          <p className="text-xs sm:text-sm max-w-lg mx-auto leading-relaxed" style={{ color: p.subtleText }}>
            {content.subheadline || 'A few of our favorite memories that brought us to this milestone.'}
          </p>
        </div>

        {/* Milestones Stack */}
        <div className="space-y-12 sm:space-y-16 relative">
          {milestones.map((item, index) => {
            const isEven = index % 2 === 0;
            return (
              <div 
                key={item.id}
                className={`flex flex-col ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-8 sm:gap-12 p-6 sm:p-8 rounded-3xl border shadow-sm transition-all hover:shadow-md`}
                style={{
                  backgroundColor: p.surface,
                  borderColor: p.border
                }}
              >
                {/* Image */}
                {item.image && (
                  <div className="w-full md:w-1/2 aspect-[4/3] rounded-2xl overflow-hidden shadow-inner bg-stone-100 shrink-0">
                    <img 
                      src={item.image} 
                      alt={item.title} 
                      className="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-700" 
                    />
                  </div>
                )}

                {/* Text Content */}
                <div className="w-full md:w-1/2 space-y-3 text-left">
                  {item.year && (
                    <span 
                      className="inline-block px-3 py-1 rounded-full text-xs font-mono font-medium tracking-wider"
                      style={{ 
                        backgroundColor: p.background, 
                        color: p.accent, 
                        border: `1px solid ${p.border}` 
                      }}
                    >
                      {item.year}
                    </span>
                  )}
                  <h3 
                    className="text-xl sm:text-2xl font-normal"
                    style={{ fontFamily: design.typography.headingFont, color: p.primary }}
                  >
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm leading-relaxed" style={{ color: p.subtleText }}>
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
