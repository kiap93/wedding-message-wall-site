import React from 'react';
import { Camera } from 'lucide-react';
import { WebsiteSection, WebsiteDesignConfig } from '../types';
import { WeddingEvent } from '../../types';

interface SectionProps {
  section: WebsiteSection;
  design: WebsiteDesignConfig;
  project: WeddingEvent | null;
}

export const GallerySection: React.FC<SectionProps> = ({ section, design }) => {
  const content = section.content || {};
  const photos = content.photos || [];
  const p = design.palette;

  return (
    <section 
      id="gallery"
      className="py-20 sm:py-28 px-6 border-b"
      style={{
        backgroundColor: p.surface,
        borderColor: p.border,
        color: p.text
      }}
    >
      <div className="max-w-5xl mx-auto space-y-14">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest" style={{ color: p.accent }}>
            <Camera className="w-3.5 h-3.5" />
            <span>Memories & Moments</span>
          </div>
          <h2 
            className="text-3xl sm:text-5xl font-normal tracking-tight"
            style={{ fontFamily: design.typography.headingFont, color: p.primary }}
          >
            {content.headline || 'Photo Gallery'}
          </h2>
          <p className="text-xs sm:text-sm max-w-md mx-auto" style={{ color: p.subtleText }}>
            {content.subheadline || 'A glimpse into our favorite adventures and chapters together.'}
          </p>
        </div>

        {/* Photos Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {photos.map((item, index) => (
            <div 
              key={item.id || index}
              className="group relative aspect-[3/4] rounded-2xl overflow-hidden border shadow-sm bg-stone-100 cursor-pointer"
              style={{ borderColor: p.border }}
            >
              <img 
                src={item.url} 
                alt={item.caption || 'Wedding photo'} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                <span className="text-white text-xs font-medium tracking-wide">
                  {item.caption || 'Cherished moment'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
