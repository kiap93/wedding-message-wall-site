import React from 'react';
import { useEventTranslation } from '../lib/i18n/TranslationContext';
import { SUPPORTED_LANGUAGES } from '../types';
import { LanguageSelectorDropdown } from './LanguageSelectorDropdown';

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
  textColor,
}) => {
  const { currentLanguage, publishedLanguages, setLanguage, getLanguageMeta } = useEventTranslation();

  const displayLanguages =
    publishedLanguages.length > 0
      ? publishedLanguages.map((lang) => getLanguageMeta(lang.language_code))
      : SUPPORTED_LANGUAGES;

  const currentMeta = getLanguageMeta(currentLanguage);

  return (
    <LanguageSelectorDropdown
      currentLanguage={currentLanguage}
      availableLanguages={displayLanguages}
      currentMeta={currentMeta}
      onSelectLanguage={(code) => setLanguage(code, true)}
      variant={variant}
      className={className}
      themeColor={themeColor}
      textColor={textColor}
      ariaLabel="Change Language"
    />
  );
};
