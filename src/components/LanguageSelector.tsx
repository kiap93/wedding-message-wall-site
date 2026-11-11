import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useEventTranslation } from '../lib/i18n/TranslationContext';
import { SUPPORTED_LANGUAGES, LanguageMeta } from '../types';

interface LanguageSelectorProps {
  className?: string;
  variant?: 'floating' | 'inline' | 'minimal';
  themeColor?: string;
  textColor?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  className = '',
  variant = 'floating',
  themeColor,
  textColor
}) => {
  const { currentLanguage, publishedLanguages, setLanguage, getLanguageMeta } = useEventTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter available languages to enabled & published, or at least fallback to supported if empty
  const displayLanguages = publishedLanguages.length > 0 
    ? publishedLanguages 
    : SUPPORTED_LANGUAGES.map((s) => ({
        id: s.code,
        event_id: '',
        language_code: s.code,
        is_enabled: true,
        is_default: s.code === 'en',
        publication_status: 'published' as const
      }));

  const currentMeta = getLanguageMeta(currentLanguage);

  // If only 1 language is available, don't show the switcher
  if (displayLanguages.length <= 1) {
    return null;
  }

  const handleSelectLanguage = (langCode: string) => {
    setLanguage(langCode, true);
    setIsOpen(false);
  };

  if (variant === 'inline') {
    return (
      <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-stone-200 bg-white/90 backdrop-blur-xs text-xs font-medium text-stone-700 hover:text-stone-900 hover:bg-stone-50 transition-all shadow-2xs"
          style={{
            borderColor: themeColor ? `${themeColor}40` : undefined,
            color: textColor || undefined
          }}
          aria-expanded={isOpen}
          aria-label="Select language"
        >
          <Globe className="w-3.5 h-3.5 shrink-0 opacity-80" />
          <span className="truncate max-w-[100px]">{currentMeta.nativeName}</span>
          <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white shadow-lg border border-stone-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-3 py-1 text-[10px] font-mono tracking-wider uppercase text-stone-400">
              Select Language / 选择语言
            </div>
            {displayLanguages.map((lang) => {
              const meta = getLanguageMeta(lang.language_code);
              const isSelected = currentLanguage === lang.language_code;

              return (
                <button
                  key={lang.language_code}
                  onClick={() => handleSelectLanguage(lang.language_code)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                    isSelected ? 'bg-stone-50 text-stone-900 font-semibold' : 'text-stone-600 hover:bg-stone-100/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{meta.flag}</span>
                    <span>{meta.nativeName}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-stone-800" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Floating button variant (fixed bottom right on mobile, top/bottom on desktop)
  return (
    <div 
      className={`fixed bottom-5 right-5 z-50 select-none ${className}`} 
      ref={dropdownRef}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-stone-900/90 text-white backdrop-blur-md border border-white/20 shadow-lg hover:bg-stone-950 transition-all active:scale-95 text-xs font-medium"
        style={{
          backgroundColor: themeColor ? `${themeColor}EE` : undefined,
          color: textColor || undefined
        }}
        aria-expanded={isOpen}
        aria-label="Change Language"
      >
        <Globe className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">{currentMeta.nativeName}</span>
        <span className="sm:hidden">{currentMeta.code.toUpperCase()}</span>
        <ChevronDown className={`w-3 h-3 opacity-70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-52 rounded-2xl bg-white shadow-2xl border border-stone-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3.5 py-1.5 text-[10px] font-mono tracking-wider uppercase text-stone-400 border-b border-stone-100 mb-1">
            Language / Bahasa / 语言
          </div>
          {displayLanguages.map((lang) => {
            const meta = getLanguageMeta(lang.language_code);
            const isSelected = currentLanguage === lang.language_code;

            return (
              <button
                key={lang.language_code}
                onClick={() => handleSelectLanguage(lang.language_code)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-left transition-colors ${
                  isSelected ? 'bg-stone-50 text-stone-900 font-semibold' : 'text-stone-600 hover:bg-stone-100/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm">{meta.flag}</span>
                  <div>
                    <div className="text-xs font-medium text-stone-800">{meta.nativeName}</div>
                    <div className="text-[10px] text-stone-400">{meta.name}</div>
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-stone-900" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
