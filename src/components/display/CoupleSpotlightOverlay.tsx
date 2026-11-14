import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Crown, Heart, Pin, Sparkles, Star } from 'lucide-react';
import { ResolvedEventTheme } from '../../lib/eventTheme';
import { Message, MessageDisplayConfig, resolveDisplayConfig } from '../../types';

interface CoupleSpotlightOverlayProps {
  message: Message | null;
  theme: ResolvedEventTheme;
  displayConfig: MessageDisplayConfig;
  durationMs: number;
}

export const CoupleSpotlightOverlay: React.FC<CoupleSpotlightOverlayProps> = ({
  message,
  theme,
  displayConfig,
  durationMs,
}) => {
  const config = resolveDisplayConfig(displayConfig);
  const isPinned = Boolean(message?.is_pinned);
  const isCoupleSelected = message?.classification === 'COUPLE_SELECTED' || Boolean(message?.is_featured);
  const isSpecialGuest = message?.classification === 'SPECIAL_GUEST';

  const variantProps =
    config.spotlightAnimation === 'cinematic-glide'
      ? {
          initial: { opacity: 0, y: 28, scale: 0.96 },
          animate: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: -22, scale: 0.97 },
        }
      : config.spotlightAnimation === 'fade-scale'
        ? {
            initial: { opacity: 0, scale: 0.9 },
            animate: { opacity: 1, scale: 1 },
            exit: { opacity: 0, scale: 0.94 },
          }
        : {
            initial: { opacity: 0, scale: 0.94, y: 12 },
            animate: { opacity: 1, scale: 1, y: 0 },
            exit: { opacity: 0, scale: 0.96, y: -8 },
          };

  return (
    <AnimatePresence mode="wait">
      {message && (
        <motion.div
          key={`spotlight-${message.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="fixed inset-0 z-40 flex items-center justify-center p-6 sm:p-12 pointer-events-none"
        >
          {/* Soft radial dim behind card */}
          <div
            className={`absolute inset-0 ${
              theme.isDark ? 'bg-[#050711]/55' : 'bg-[#1A1610]/20'
            } backdrop-blur-[2px]`}
          />

          <motion.div
            {...variantProps}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className={`relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl border px-8 py-10 sm:px-14 sm:py-14 text-center shadow-2xl ${
              theme.isDark
                ? 'bg-[#12131A]/94 border-[#E5C87B]/50 text-[#FAF6EC] shadow-[0_30px_90px_rgba(0,0,0,0.65)]'
                : 'bg-[#FFFDF8]/96 border-[#C9A24D]/55 text-[#1F1A12] shadow-[0_30px_90px_rgba(40,30,10,0.22)]'
            }`}
          >
            {/* Delicate editorial corner brackets */}
            <div className="absolute top-4 left-4 w-6 h-6 border-t border-l border-[#C9A24D]/55 pointer-events-none" />
            <div className="absolute top-4 right-4 w-6 h-6 border-t border-r border-[#C9A24D]/55 pointer-events-none" />
            <div className="absolute bottom-4 left-4 w-6 h-6 border-b border-l border-[#C9A24D]/55 pointer-events-none" />
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b border-r border-[#C9A24D]/55 pointer-events-none" />

            {/* Kicker Label */}
            <div className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-sans font-semibold uppercase tracking-[0.26em] text-[#B68D3A] mb-6">
              {isPinned ? (
                <>
                  <Pin className="w-3.5 h-3.5 fill-current" />
                  <span>Pinned Celebration Note</span>
                </>
              ) : isCoupleSelected ? (
                <>
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>Couple&apos;s Spotlight</span>
                  <Sparkles className="w-3.5 h-3.5" />
                </>
              ) : isSpecialGuest ? (
                <>
                  <Crown className="w-3.5 h-3.5" />
                  <span>{message.guest_category ? `${message.guest_category} Blessing` : 'Special Guest'}</span>
                </>
              ) : (
                <>
                  <Heart className="w-3.5 h-3.5 fill-current" />
                  <span>Featured Wish</span>
                </>
              )}
            </div>

            {/* Full Editorial Message Quote */}
            <blockquote
              className={`${theme.fontHeading} italic font-normal text-2xl sm:text-4xl md:text-[2.6rem] leading-[1.32] tracking-tight mb-8 ${
                theme.isDark ? 'text-[#FCF8EE]' : 'text-[#1E1912]'
              }`}
            >
              &ldquo;{message.message}&rdquo;
            </blockquote>

            {/* Hairline Divider & Signature */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-px bg-[#C9A24D]/45 mb-1" />
              <div className={`text-base sm:text-xl ${theme.fontHeading} font-medium tracking-wide`}>
                {message.name || 'Anonymous Guest'}
              </div>
              {message.guest_category && (
                <div className="text-[11px] uppercase tracking-[0.2em] opacity-60 font-sans">
                  {message.guest_category}
                </div>
              )}
            </div>

            {/* Subtle Remaining Duration Progress Hairline */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#C9A24D]/15">
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: Math.max(2, durationMs / 1000), ease: 'linear' }}
                style={{ transformOrigin: 'left center' }}
                className="h-full bg-[#C9A24D]/70"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
