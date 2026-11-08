import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { WebsiteSection, WebsiteDesignConfig } from '../types';
import { WeddingEvent } from '../../types';

interface SectionProps {
  section: WebsiteSection;
  design: WebsiteDesignConfig;
  project: WeddingEvent | null;
}

export const CountdownSection: React.FC<SectionProps> = ({ section, design, project }) => {
  const content = section.content || {};
  const targetDate = project?.wedding_date ? new Date(project.wedding_date).getTime() : Date.now() + 86400000 * 45;

  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const calculateTime = () => {
      const now = Date.now();
      const difference = targetDate - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const p = design.palette;

  return (
    <section 
      className="py-16 sm:py-20 px-6 border-b"
      style={{
        backgroundColor: p.surface,
        borderColor: p.border,
        color: p.text
      }}
    >
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest" style={{ color: p.accent }}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>The Moment Awaits</span>
          </div>
          <h2 
            className="text-2xl sm:text-4xl font-normal tracking-tight"
            style={{ fontFamily: design.typography.headingFont, color: p.primary }}
          >
            {content.headline || 'Counting Down to Forever'}
          </h2>
          <p className="text-xs sm:text-sm max-w-md mx-auto" style={{ color: p.subtleText }}>
            {content.subheadline || 'Every second brings us closer to celebrating our love together.'}
          </p>
        </div>

        {/* 4 Clock Blocks */}
        <div className="grid grid-cols-4 gap-3 sm:gap-6 max-w-xl mx-auto">
          {[
            { label: 'Days', value: timeLeft.days },
            { label: 'Hours', value: timeLeft.hours },
            { label: 'Minutes', value: timeLeft.minutes },
            { label: 'Seconds', value: timeLeft.seconds },
          ].map((item, idx) => (
            <div 
              key={idx}
              className="p-4 sm:p-6 rounded-2xl border text-center transition-transform hover:-translate-y-1 shadow-sm"
              style={{
                backgroundColor: p.background,
                borderColor: p.border
              }}
            >
              <div 
                className="text-2xl sm:text-4xl md:text-5xl font-mono font-light tracking-tight tabular-nums"
                style={{ color: p.primary }}
              >
                {String(item.value).padStart(2, '0')}
              </div>
              <div 
                className="text-[10px] sm:text-xs font-mono uppercase tracking-wider mt-1 sm:mt-2"
                style={{ color: p.accent }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
