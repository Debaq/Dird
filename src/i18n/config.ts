import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Importar traducciones directamente
import esTranslations from './locales/es.json';

i18n
  .use(initReactI18next)
  .init({
    lng: 'es', // Idioma fijo en español
    fallbackLng: 'es',
    debug: import.meta.env.DEV,
    resources: {
      es: {
        translation: esTranslations
      }
    },
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
