import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Importar traducciones directamente
import esTranslations from './locales/es.json';
import enTranslations from './locales/en.json';

// Importar traducciones de clases
import esClasses from './locales/classes/es.json';
import enClasses from './locales/classes/en.json';

// Detectar el idioma del navegador
export const detectBrowserLanguage = (): string => {
  const browserLang = navigator.language.split('-')[0];
  return ['es', 'en'].includes(browserLang) ? browserLang : 'es';
};

// Obtener idioma preferido del localStorage o navegador
const getPreferredLanguage = () => {
  // Intentar obtener del localStorage
  const savedLang = localStorage.getItem('language');
  if (savedLang && ['es', 'en'].includes(savedLang)) {
    return savedLang;
  }
  
  // Si no hay nada guardado o es 'auto' (aunque aquí leemos localStorage directo, 
  // 'auto' se gestionará principalmente desde el store), usamos detección.
  return detectBrowserLanguage();
};

i18n
  .use(initReactI18next)
  .init({
    lng: getPreferredLanguage(), // Idioma inicial
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

// Función para cambiar el idioma (acepta 'auto' para limpiar preferencia fija)
export const changeLanguage = (lang: string) => {
  if (lang === 'auto') {
    const detected = detectBrowserLanguage();
    i18n.changeLanguage(detected);
    localStorage.removeItem('language'); // Eliminar preferencia fija
  } else if (['es', 'en'].includes(lang)) {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  }
};

export const getCurrentLanguage = () => {
  return i18n.language;
};

export default i18n;
