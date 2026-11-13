import React from 'react';
import { useMarketingTranslation } from '../lib/i18n/MarketingTranslationContext';
import { LanguageSelectorDropdown } from './LanguageSelectorDropdown';

interface MarketingLanguageSelectorProps {
  className?: string;
  variant?: 'header' | 'mobile';
}

export const MarketingLanguageSelector: React.FC<MarketingLanguageSelectorProps> = ({
  className = '',
  variant = 'header',
}) => {
  const { currentLanguage, supportedLanguages, setLanguage, getLanguageMeta, t } =
    useMarketingTranslation();

  const currentMeta = getLanguageMeta(currentLanguage);

  return (
    <LanguageSelectorDropdown
      currentLanguage={currentLanguage}
      availableLanguages={supportedLanguages}
      currentMeta={currentMeta}
      onSelectLanguage={setLanguage}
      variant={variant}
      className={className}
      dropdownTitle={t('nav.selectLanguage')}
      ariaLabel={t('nav.selectLanguage')}
    />
  );
};

export default MarketingLanguageSelector;
