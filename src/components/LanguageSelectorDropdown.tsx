import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { LanguageMeta } from '../types';

export interface LanguageSelectorDropdownProps {
  currentLanguage: string;
  availableLanguages: LanguageMeta[];
  currentMeta: LanguageMeta;
  onSelectLanguage: (langCode: string) => void;
  className?: string;
  variant?: 'floating' | 'inline' | 'minimal' | 'header' | 'mobile';
  themeColor?: string;
  textColor?: string;
  dropdownTitle?: string;
  ariaLabel?: string;
}

const COMPACT_CODES: Record<string, string> = {
  en: 'EN',
  'zh-CN': '简',
  'zh-TW': '繁',
  ms: 'MS',
};

export const LanguageSelectorDropdown: React.FC<LanguageSelectorDropdownProps> = ({
  currentLanguage,
  availableLanguages,
  currentMeta,
  onSelectLanguage,
  className = '',
  variant = 'floating',
  themeColor,
  textColor,
  dropdownTitle = 'Select Language',
  ariaLabel = 'Select language',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  if (availableLanguages.length <= 1) {
    return null;
  }

  const handleSelect = (code: string) => {
    onSelectLanguage(code);
    setIsOpen(false);
  };

  if (variant === 'mobile') {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[#8B806F]">
          <Globe className="w-3.5 h-3.5" />
          <span>{dropdownTitle}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {availableLanguages.map((meta) => {
            const isSelected = currentLanguage === meta.code;
            return (
              <button
                key={meta.code}
                type="button"
                onClick={() => handleSelect(meta.code)}
                data-lang-option={meta.code}
                className={`flex items-center justify-between px-3 py-2 rounded-md border text-xs transition-colors ${
                  isSelected
                    ? 'bg-[#252525] text-white border-[#252525] font-medium'
                    : 'bg-white text-[#555555] border-[#E8E8E5] hover:border-[#8B806F] hover:text-[#252525]'
                }`}
              >
                <span className="truncate">{meta.nativeName}</span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (variant === 'header') {
    const compactCode = COMPACT_CODES[currentMeta.code] || currentMeta.code.toUpperCase();
    return (
      <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="h-8 flex items-center gap-1.5 px-2.5 rounded-md border border-[#E8E8E5] bg-white/80 hover:bg-white text-xs font-medium text-[#555555] hover:text-[#252525] transition-colors whitespace-nowrap"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          data-testid="marketing-language-switcher"
        >
          <Globe className="w-3.5 h-3.5 shrink-0 text-[#8B806F]" />
          <span className="hidden sm:inline">{currentMeta.nativeName}</span>
          <span className="sm:hidden">{compactCode}</span>
          <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div
            role="listbox"
            aria-label={ariaLabel}
            className="absolute right-0 mt-1.5 w-48 rounded-lg bg-white shadow-lg border border-[#E8E8E5] py-1.5 z-50"
          >
            <div className="px-3 py-1 text-[10px] font-medium tracking-wider uppercase text-[#8B806F] border-b border-[#F2F2EE] mb-1">
              {dropdownTitle}
            </div>
            {availableLanguages.map((meta) => {
              const isSelected = currentLanguage === meta.code;
              return (
                <button
                  key={meta.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-lang-option={meta.code}
                  onClick={() => handleSelect(meta.code)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                    isSelected
                      ? 'bg-[#FAF9F7] text-[#252525] font-semibold'
                      : 'text-[#555555] hover:bg-[#F7F7F5] hover:text-[#252525]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm leading-none">{meta.flag}</span>
                    <div className="truncate">
                      <span className="block leading-tight">{meta.nativeName}</span>
                      <span className="block text-[10px] text-[#888888] font-normal">{meta.name}</span>
                    </div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#8B806F] shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-stone-200 bg-white/90 backdrop-blur-xs text-xs font-medium text-stone-700 hover:text-stone-900 hover:bg-stone-50 transition-all shadow-2xs"
          style={{
            borderColor: themeColor ? `${themeColor}40` : undefined,
            color: textColor || undefined,
          }}
          aria-expanded={isOpen}
          aria-label={ariaLabel}
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
            {availableLanguages.map((meta) => {
              const isSelected = currentLanguage === meta.code;
              return (
                <button
                  key={meta.code}
                  type="button"
                  onClick={() => handleSelect(meta.code)}
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

  return (
    <div className={`fixed bottom-5 right-5 z-50 select-none ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-stone-900/90 text-white backdrop-blur-md border border-white/20 shadow-lg hover:bg-stone-950 transition-all active:scale-95 text-xs font-medium"
        style={{
          backgroundColor: themeColor ? `${themeColor}EE` : undefined,
          color: textColor || undefined,
        }}
        aria-expanded={isOpen}
        aria-label={ariaLabel}
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
          {availableLanguages.map((meta) => {
            const isSelected = currentLanguage === meta.code;
            return (
              <button
                key={meta.code}
                type="button"
                onClick={() => handleSelect(meta.code)}
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
