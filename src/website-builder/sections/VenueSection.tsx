import React from 'react';
import { MapPin, Navigation, Compass, Sparkles } from 'lucide-react';
import { WebsiteSection, WebsiteDesignConfig } from '../types';
import { WeddingEvent } from '../../types';

interface SectionProps {
  section: WebsiteSection;
  design: WebsiteDesignConfig;
  project: WeddingEvent | null;
}

export const VenueSection: React.FC<SectionProps> = ({ section, design, project }) => {
  const content = section.content || {};
  const venueName = content.venueName || project?.location || 'Villa Montalvo Estate';
  const address = content.address || `${project?.location || 'San Francisco, CA'} • 15400 Montalvo Road`;
  const attire = content.attire || 'Black Tie Optional / Formal Garden Elegance';
  const directionsUrl = content.directionsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueName + ' ' + address)}`;
  const p = design.palette;

  return (
    <section 
      id="venue"
      className="py-20 sm:py-28 px-6 border-b"
      style={{
        backgroundColor: p.background,
        borderColor: p.border,
        color: p.text
      }}
    >
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest" style={{ color: p.accent }}>
            <Compass className="w-3.5 h-3.5" />
            <span>Celebration Venue</span>
          </div>
          <h2 
            className="text-3xl sm:text-5xl font-normal tracking-tight"
            style={{ fontFamily: design.typography.headingFont, color: p.primary }}
          >
            {section.title || 'Venue & Location'}
          </h2>
          <p className="text-xs sm:text-sm max-w-md mx-auto" style={{ color: p.subtleText }}>
            Join us at our dream setting where the ceremony and reception will take place.
          </p>
        </div>

        {/* Venue Card */}
        <div 
          className="p-8 sm:p-12 rounded-3xl border text-center space-y-6 shadow-sm max-w-2xl mx-auto"
          style={{
            backgroundColor: p.surface,
            borderColor: p.border
          }}
        >
          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center border shadow-xs" style={{ backgroundColor: p.background, borderColor: p.border, color: p.accent }}>
            <MapPin className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <h3 
              className="text-2xl sm:text-3xl font-normal"
              style={{ fontFamily: design.typography.headingFont, color: p.primary }}
            >
              {venueName}
            </h3>
            <p className="text-sm sm:text-base leading-relaxed" style={{ color: p.subtleText }}>
              {address}
            </p>
          </div>

          <div className="pt-2 pb-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium" style={{ backgroundColor: p.background, color: p.accent, border: `1px solid ${p.border}` }}>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Dress Code: {attire}</span>
            </div>
          </div>

          <div className="pt-4">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-semibold tracking-wider uppercase transition-all transform hover:scale-105 active:scale-95 shadow-md"
              style={{
                backgroundColor: p.primary,
                color: '#FFFFFF'
              }}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Get Driving Directions</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
