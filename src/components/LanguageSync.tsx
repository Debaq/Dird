import { useEffect } from 'react';
import { useConfigStore } from '@/stores/config-store';
import { changeLanguage, getCurrentLanguage, detectBrowserLanguage } from '@/i18n/config';

const LanguageSync = () => {
  const config = useConfigStore(state => state.config);

  useEffect(() => {
    // Verificar si el idioma en la configuración es diferente al actual
    const currentLang = getCurrentLanguage();
    const configLang = config.appearance.language;
    
    if (configLang === 'auto') {
      const detected = detectBrowserLanguage();
      if (detected !== currentLang) {
        changeLanguage('auto'); // This will trigger detection in config.ts
      }
    } else if (configLang && configLang !== currentLang) {
      changeLanguage(configLang);
    }
  }, [config.appearance.language]);

  return null; // No renderiza nada, solo sincroniza
};

export default LanguageSync;