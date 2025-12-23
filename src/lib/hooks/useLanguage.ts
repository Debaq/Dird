import { useState, useEffect } from 'react';
import i18n from 'i18next';
import { changeLanguage, getCurrentLanguage } from '@/i18n/config';

export const useLanguage = () => {
  const [currentLanguage, setCurrentLanguage] = useState<string>(getCurrentLanguage());

  const switchLanguage = (lang: string) => {
    changeLanguage(lang);
    setCurrentLanguage(lang);
  };

  useEffect(() => {
    // Escuchar cambios de idioma
    const handleLanguageChange = () => {
      setCurrentLanguage(i18n.language);
    };

    // Escuchar el evento de cambio de idioma de i18next
    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      // Limpiar el listener cuando el componente se desmonte
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  return {
    currentLanguage,
    switchLanguage,
    isSpanish: currentLanguage === 'es',
    isEnglish: currentLanguage === 'en',
  };
};