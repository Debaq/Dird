import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Importar traducciones directamente
import esTranslations from './locales/es.json';
import enTranslations from './locales/en.json';

// Importar traducciones de clases
import esClasses from './locales/classes/es.json';
import enClasses from './locales/classes/en.json';

// Obtener idioma preferido del localStorage o navegador
const getPreferredLanguage = () => {
  // Intentar obtener del localStorage
  const savedLang = localStorage.getItem('language');
  if (savedLang && ['es', 'en'].includes(savedLang)) {
    return savedLang;
  }

  // Si no está guardado, usar el idioma del navegador
  const browserLang = navigator.language.startsWith('es') ? 'es' : 'en';
  return browserLang;
};

i18n
  .use(initReactI18next)
  .init({
    lng: getPreferredLanguage(), // Idioma dinámico
    fallbackLng: 'es',
    debug: import.meta.env.DEV,
    resources: {
      es: {
        translation: esTranslations,
        classes: esClasses
      },
      en: {
        translation: enTranslations,
        classes: enClasses
      }
    },
    interpolation: {
      escapeValue: false
    }
  });

// Función para cambiar el idioma
export const changeLanguage = (lang: string) => {
  if (['es', 'en'].includes(lang)) {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  }
};

export const getCurrentLanguage = () => {
  return i18n.language;
};

export default i18n;
