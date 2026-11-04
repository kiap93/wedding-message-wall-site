import React from 'react';
import { motion } from 'motion/react';
import { TemplateId } from '../types';

interface ThemeOverlayProps {
  themeId: TemplateId;
  mode?: 'fullscreen' | 'ambient';
}

export const ThemeOverlay: React.FC<ThemeOverlayProps> = ({ themeId, mode = 'fullscreen' }) => {
  if (themeId === 'garden') {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Top-Left Botanical Vine */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: mode === 'fullscreen' ? 0.65 : 0.35 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute -top-6 -left-8 w-72 sm:w-96 h-72 sm:h-96"
        >
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-[#4E614E]">
            <path d="M100 20C100 20 80 50 80 80C80 110 100 140 100 140C100 140 120 110 120 80C120 50 100 20 100 20Z" fill="currentColor" fillOpacity="0.28" />
            <path d="M60 40C60 40 40 70 40 100C40 130 60 160 60 160C60 160 80 130 80 100C80 70 60 40 60 40Z" fill="currentColor" fillOpacity="0.2" />
            <path d="M140 60C140 60 160 90 160 120C160 150 140 180 140 180C140 180 120 150 120 120C120 90 140 60 140 60Z" fill="currentColor" fillOpacity="0.15" />
            <path d="M20 70 Q 70 120 140 150" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.3" fill="none" />
          </svg>
        </motion.div>

        {/* Bottom-Right Botanical Branch */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: mode === 'fullscreen' ? 0.5 : 0.25 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          className="absolute -bottom-8 -right-8 w-80 sm:w-96 h-80 sm:h-96 scale-x-[-1]"
        >
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-[#384638]">
            <path d="M100 20C100 20 80 50 80 80C80 110 100 140 100 140C100 140 120 110 120 80C120 50 100 20 100 20Z" fill="currentColor" fillOpacity="0.25" />
            <path d="M60 40C60 40 40 70 40 100C40 130 60 160 60 160C60 160 80 130 80 100C80 70 60 40 60 40Z" fill="currentColor" fillOpacity="0.18" />
          </svg>
        </motion.div>

        {/* Soft radial garden glow */}
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-[#829D82]/10 rounded-full blur-3xl pointer-events-none" />
      </div>
    );
  }

  if (themeId === 'starry') {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Dynamic twinkle stars */}
        {[...Array(35)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0.1, 0.9, 0.1],
              scale: [0.6, 1.2, 0.6]
            }}
            transition={{
              duration: 2.5 + (i % 5),
              repeat: Infinity,
              delay: (i * 0.2) % 3,
              ease: "easeInOut"
            }}
            className="absolute bg-white rounded-full"
            style={{
              width: i % 4 === 0 ? '3px' : '2px',
              height: i % 4 === 0 ? '3px' : '2px',
              top: `${(i * 17) % 96}%`,
              left: `${(i * 29) % 98}%`,
              boxShadow: i % 3 === 0 ? '0 0 6px rgba(255, 255, 255, 0.8)' : undefined
            }}
          />
        ))}

        {/* Nebula ambient glow */}
        <div className="absolute top-1/4 -right-10 w-[30rem] h-[30rem] bg-indigo-900/25 rounded-full blur-[100px]" />
        <div className="absolute -bottom-10 left-1/4 w-[28rem] h-[28rem] bg-sky-900/20 rounded-full blur-[100px]" />
      </div>
    );
  }

  if (themeId === 'digital') {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-30">
        {/* Cyber Grid Lines */}
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(0, 255, 65, 0.07) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0, 255, 65, 0.07) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Corner Telemetry Accents */}
        <div className="absolute top-4 left-4 text-[9px] font-mono text-[#00FF41]/40">
          SYS::STREAM_ACTIVE // SYNC: 100%
        </div>
        <div className="absolute top-4 right-4 text-[9px] font-mono text-[#00FF41]/40">
          CH: WEDDING_FEED_01
        </div>
        <div className="absolute bottom-4 left-4 text-[9px] font-mono text-[#00FF41]/40">
          [BUFFER: READY]
        </div>
      </div>
    );
  }

  if (themeId === 'postal') {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Airmail Border Accent on Top & Bottom */}
        <div 
          className="absolute top-0 left-0 right-0 h-2 opacity-60"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              #C0392B 0,
              #C0392B 15px,
              transparent 15px,
              transparent 25px,
              #2980B9 25px,
              #2980B9 40px,
              transparent 40px,
              transparent 50px
            )`
          }}
        />
        
        {/* Faint Postal Stamp Motif in Corner */}
        <div className="absolute top-8 right-8 opacity-15 text-[#3E2723] hidden sm:block">
          <svg width="120" height="120" viewBox="0 0 100 100" fill="none" stroke="currentColor">
            <circle cx="50" cy="50" r="44" strokeWidth="2" strokeDasharray="3 3" />
            <circle cx="50" cy="50" r="38" strokeWidth="1" />
            <path d="M 20 50 Q 50 35 80 50" strokeWidth="1.5" />
            <path d="M 20 60 Q 50 45 80 60" strokeWidth="1.5" />
          </svg>
        </div>
      </div>
    );
  }

  if (themeId === 'vintage') {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Soft Sepia Vignette */}
        <div className="absolute inset-0 bg-radial from-transparent via-[#E7E0D2]/20 to-[#6B5E4C]/15" />
        
        {/* Antique Corner Flourish */}
        <div className="absolute top-6 left-6 w-16 h-16 opacity-30 text-[#6B5E4C] hidden sm:block">
          <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M 5 50 L 5 5 L 50 5" />
            <circle cx="20" cy="20" r="4" fill="currentColor" />
            <path d="M 5 20 Q 20 20 20 5" />
          </svg>
        </div>
        <div className="absolute bottom-6 right-6 w-16 h-16 opacity-30 text-[#6B5E4C] hidden sm:block rotate-180">
          <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M 5 50 L 5 5 L 50 5" />
            <circle cx="20" cy="20" r="4" fill="currentColor" />
            <path d="M 5 20 Q 20 20 20 5" />
          </svg>
        </div>
      </div>
    );
  }

  if (themeId === 'minimal_luxury') {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Subtle Gold Hairline Corner Brackets */}
        <div className="absolute top-8 left-8 w-12 h-12 border-t border-l border-[#D4AF37]/30 hidden sm:block" />
        <div className="absolute top-8 right-8 w-12 h-12 border-t border-r border-[#D4AF37]/30 hidden sm:block" />
        <div className="absolute bottom-8 left-8 w-12 h-12 border-b border-l border-[#D4AF37]/30 hidden sm:block" />
        <div className="absolute bottom-8 right-8 w-12 h-12 border-b border-r border-[#D4AF37]/30 hidden sm:block" />
      </div>
    );
  }

  // Fallback / default: gentle ambient light field
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-25">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full opacity-20 blur-[100px] bg-amber-400" />
    </div>
  );
};
