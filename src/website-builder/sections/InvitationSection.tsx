import React from 'react';
import { Mail, Sparkles, ExternalLink } from 'lucide-react';
import { WebsiteSection, WebsiteDesignConfig } from '../types';
import { WeddingEvent } from '../../types';

interface SectionProps {
  section: WebsiteSection;
  design: WebsiteDesignConfig;
  project: WeddingEvent | null;
}

export const InvitationSection: React.FC<SectionProps> = ({ section, design, project }) => {
  const content = section.content || {};
  const groom = project?.groom_name || 'Lucas';
  const bride = project?.bride_name || 'Sofia';
  const dateStr = project?.wedding_date ? new Date(project.wedding_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Saturday, September 20, 2025';
  const location = project?.location || 'San Francisco, CA';
  const p = design.palette;
  const invitationUrl = project?.slug ? `/${project.slug}/invitation` : '#';

  return (
    <section 
      id="invitation"
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
            <Mail className="w-3.5 h-3.5" />
            <span>Formal Stationery</span>
          </div>
          <h2 
            className="text-3xl sm:text-5xl font-normal tracking-tight"
            style={{ fontFamily: design.typography.headingFont, color: p.primary }}
          >
            {content.headline || 'Official Digital Invitation'}
          </h2>
          <p className="text-xs sm:text-sm max-w-md mx-auto" style={{ color: p.subtleText }}>
            {content.subheadline || 'Custom stationery crafted with bespoke typography and wax-seal monograms.'}
          </p>
        </div>

        {/* Stationery Card Mockup */}
        <div 
          className="max-w-md mx-auto p-8 sm:p-12 rounded-3xl border shadow-xl space-y-6 relative overflow-hidden transition-transform hover:-translate-y-1"
          style={{
            backgroundColor: p.surface,
            borderColor: p.accent
          }}
        >
          {/* Subtle Golden Foil Border Accent */}
          <div className="absolute inset-2 border rounded-2xl pointer-events-none opacity-40" style={{ borderColor: p.accent }} />

          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center border shadow-inner" style={{ backgroundColor: p.background, borderColor: p.border, color: p.accent }}>
            <Sparkles className="w-5 h-5 fill-current" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] uppercase font-mono tracking-widest block" style={{ color: p.accent }}>
              Together With Their Families
            </span>
            <h3 
              className="text-3xl sm:text-4xl font-normal"
              style={{ fontFamily: design.typography.headingFont, color: p.primary }}
            >
              {groom} & {bride}
            </h3>
            <p className="text-xs font-serif italic text-stone-600">
              Request the pleasure of your company at the celebration of their union
            </p>
          </div>

          <div className="pt-4 border-t border-stone-200/60 text-xs font-mono space-y-1" style={{ color: p.subtleText }}>
            <div className="font-semibold" style={{ color: p.primary }}>{dateStr}</div>
            <div>{location}</div>
          </div>

          <div className="pt-4">
            <a
              href={invitationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-all shadow-md hover:scale-105"
              style={{
                backgroundColor: p.accent,
                color: '#FFFFFF'
              }}
            >
              <span>Open Stationery Viewer</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
