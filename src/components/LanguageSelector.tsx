import { useTranslation } from 'react-i18next';
import { Select } from './Input';
import { availableLanguages, changeLanguage } from '../i18n';

interface LanguageSelectorProps {
  className?: string;
}

export function LanguageSelector({ className = '' }: LanguageSelectorProps) {
  const { i18n, t } = useTranslation();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    changeLanguage(e.target.value);
  };

  return (
    <Select
      label={t('settings.language')}
      value={i18n.language.split('-')[0]} // Handle cases like 'en-US' -> 'en'
      onChange={handleChange}
      options={availableLanguages.map((lang) => ({
        value: lang.code,
        label: lang.nativeName,
      }))}
      className={className}
    />
  );
}

// Compact language toggle for use in headers etc.
export function LanguageToggle() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language.split('-')[0];

  const toggleLanguage = () => {
    const nextLang = currentLang === 'en' ? 'ko' : 'en';
    changeLanguage(nextLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="px-2 py-1 text-sm text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded transition-colors"
      aria-label={`Switch to ${currentLang === 'en' ? 'Korean' : 'English'}`}
    >
      {currentLang === 'en' ? '한국어' : 'EN'}
    </button>
  );
}
