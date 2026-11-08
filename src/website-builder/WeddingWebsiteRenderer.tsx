import React, { useState } from 'react';
import { 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Eye, 
  EyeOff, 
  Sparkles,
  Menu,
  X,
  Heart
} from 'lucide-react';
import { WebsiteConfig, WebsiteSection } from './types';
import { WeddingEvent } from '../types';
import { SectionRenderer } from './sections/SectionRenderer';
import { ThemeOverlay } from '../components/ThemeDecorations';

export interface WeddingWebsiteRendererProps {
  config: WebsiteConfig;
  project: WeddingEvent | null;
  isEditor?: boolean;
  selectedSectionId?: string | null;
  onSelectSection?: (sectionId: string) => void;
  onMoveSection?: (sectionId: string, direction: 'up' | 'down') => void;
  onRemoveSection?: (sectionId: string) => void;
  onToggleVisibility?: (sectionId: string) => void;
  className?: string;
}

export const WeddingWebsiteRenderer: React.FC<WeddingWebsiteRendererProps> = ({
  config,
  project,
  isEditor = false,
  selectedSectionId,
  onSelectSection,
  onMoveSection,
  onRemoveSection,
  onToggleVisibility,
  className = ''
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const groom = project?.groom_name || 'Lucas';
  const bride = project?.bride_name || 'Sofia';
  const siteTitle = config.settings.siteTitle || `${groom} & ${bride}`;

  const navLinks = [
    { type: 'story', label: 'Our Story', href: '#story' },
    { type: 'schedule', label: 'Schedule', href: '#schedule' },
    { type: 'venue', label: 'Venue', href: '#venue' },
    { type: 'gallery', label: 'Gallery', href: '#gallery' },
    { type: 'invitation', label: 'Invitation', href: '#invitation' },
    { type: 'wall', label: 'Guest Wall', href: '#wall' },
  ].filter((item) => config.sections.some((s) => s.type === item.type && (isEditor || s.enabled)));

  // If in editor mode, display all sections (with disabled state). In guest mode, only display enabled sections.
  const sectionsToRender = isEditor 
    ? config.sections 
    : config.sections.filter((s) => s.enabled);

  const p = config.design.palette;
  const typography = config.design.typography;

  return (
    <div 
      className={`min-h-screen relative flex flex-col transition-colors duration-300 ${className}`}
      style={{
        backgroundColor: p.background,
        color: p.text,
        fontFamily: typography.bodyFont
      }}
    >
      {/* 1. ANNOUNCEMENT RIBBON */}
      {config.settings.announcementBar && (
        <div 
          className="text-center py-2 px-4 text-xs font-mono tracking-wider z-50 shrink-0 transition-colors"
          style={{
            backgroundColor: p.primary,
            color: p.accent
          }}
        >
          {config.settings.announcementBar}
        </div>
      )}

      {/* 2. FLOATING STICKY NAVIGATION BAR */}
      {config.settings.showNav && (
        <header 
          className="sticky top-0 z-40 backdrop-blur-md border-b px-4 sm:px-8 py-3.5 flex items-center justify-between transition-colors shadow-xs"
          style={{
            backgroundColor: `${p.surface}E6`, // 90% opacity
            borderColor: p.border,
            color: p.text
          }}
        >
          {/* Logo / Monogram */}
          <a 
            href="#" 
            className="flex items-center gap-2 group tracking-wide font-normal transition-transform hover:scale-[1.02]"
            style={{ fontFamily: typography.headingFont }}
          >
            <span className="text-base sm:text-lg font-medium tracking-tight" style={{ color: p.primary }}>
              {siteTitle}
            </span>
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium">
            {navLinks.map((item) => (
              <a
                key={item.type}
                href={item.href}
                className="transition-colors hover:opacity-100 opacity-75"
                style={{ color: p.text }}
              >
                {item.label}
              </a>
            ))}

            {config.settings.rsvpButtonInNav && (
              <a
                href="#rsvp"
                className="px-4 py-2 rounded-full text-xs font-semibold tracking-wider uppercase transition-all shadow-xs hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: p.primary,
                  color: '#FFFFFF'
                }}
              >
                RSVP
              </a>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            {config.settings.rsvpButtonInNav && (
              <a
                href="#rsvp"
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wider uppercase shadow-xs"
                style={{
                  backgroundColor: p.primary,
                  color: '#FFFFFF'
                }}
              >
                RSVP
              </a>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg border text-stone-700"
              style={{ borderColor: p.border }}
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>
      )}

      {/* Mobile Nav Dropdown Panel */}
      {config.settings.showNav && mobileMenuOpen && (
        <div 
          className="md:hidden sticky top-[57px] z-30 border-b p-4 space-y-2 backdrop-blur-md shadow-md animate-fade-in"
          style={{
            backgroundColor: p.surface,
            borderColor: p.border
          }}
        >
          {navLinks.map((item) => (
            <a
              key={item.type}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 px-3 rounded-lg text-xs font-medium hover:bg-stone-100 transition-colors"
              style={{ color: p.text }}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}

      {/* 3. THEME AMBIENT OVERLAY */}
      {config.design.decorations.showThemeOverlay && (
        <ThemeOverlay themeId={config.design.themeId} mode="ambient" />
      )}

      {/* 4. SECTIONS STACK */}
      <main className="flex-1 w-full">
        {sectionsToRender.map((section, idx) => {
          const isSelected = isEditor && selectedSectionId === section.id;

          // Pure Guest Mode Render
          if (!isEditor) {
            return (
              <SectionRenderer
                key={section.id}
                section={section}
                design={config.design}
                project={project}
                isEditor={false}
              />
            );
          }

          // Studio Editor Mode Render (Interactive bounding boxes & quick action toolbar)
          return (
            <div
              key={section.id}
              onClick={() => onSelectSection?.(section.id)}
              className={`relative group transition-all cursor-pointer ${
                isSelected 
                  ? 'ring-2 ring-amber-500 ring-offset-2 z-10' 
                  : 'hover:ring-1 hover:ring-stone-400 hover:ring-offset-1'
              } ${!section.enabled ? 'opacity-40 grayscale-[50%]' : ''}`}
            >
              {/* Section Ribbon Badge */}
              {isSelected && (
                <div className="absolute top-2 left-3 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold bg-amber-500 text-stone-950 shadow-md">
                  <Sparkles className="w-3 h-3 fill-current" />
                  <span>{section.title || section.type}</span>
                </div>
              )}

              {/* Section Quick Action Toolbar */}
              {isSelected && (
                <div 
                  className="absolute top-2 right-3 z-30 flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-lg border border-stone-200 shadow-md text-stone-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onMoveSection?.(section.id, 'up')}
                    disabled={idx === 0}
                    className="p-1 hover:bg-stone-100 rounded disabled:opacity-20 transition-colors"
                    title="Move Section Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onMoveSection?.(section.id, 'down')}
                    disabled={idx === config.sections.length - 1}
                    className="p-1 hover:bg-stone-100 rounded disabled:opacity-20 transition-colors"
                    title="Move Section Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-px h-3.5 bg-stone-200" />
                  <button
                    onClick={() => onToggleVisibility?.(section.id)}
                    className="p-1 hover:bg-stone-100 rounded transition-colors"
                    title={section.enabled ? "Hide Section" : "Show Section"}
                  >
                    {section.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-stone-400" />}
                  </button>
                  <button
                    onClick={() => onRemoveSection?.(section.id)}
                    className="p-1 hover:bg-red-50 text-stone-600 hover:text-red-600 rounded transition-colors"
                    title="Delete Section"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Underlying Section Component */}
              <SectionRenderer
                section={section}
                design={config.design}
                project={project}
                isEditor={true}
              />
            </div>
          );
        })}
      </main>
    </div>
  );
};
