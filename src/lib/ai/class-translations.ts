/**
 * Traducciones de las clases del modelo
 * Las clases en el modelo están en inglés y snake_case
 * Las traducciones se obtienen desde los archivos JSON de i18n
 */

import i18n from '@/i18n/config';

/**
 * Obtiene la traducción de una clase según el idioma actual
 * @param classId - ID de la clase en snake_case (ej: "optic_disc")
 * @param language - Idioma opcional, si no se especifica usa el idioma actual de i18n
 * @returns Nombre traducido de la clase
 */
export function getClassName(classId: string, language?: string): string {
  const lang = language || i18n.language;

  // Intentar obtener la traducción del namespace 'classes'
  const translation = i18n.t(classId, { ns: 'classes', lng: lang });

  // Si la traducción es igual al ID (no se encontró), retornar el ID como fallback
  if (translation === classId) {
    // Convertir snake_case a Title Case como último recurso
    return classId
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return translation;
}

/**
 * Obtiene la traducción de una clase al español
 * @param classId - ID de la clase en snake_case
 */
export function getClassNameEs(classId: string): string {
  return getClassName(classId, 'es');
}

/**
 * Obtiene la traducción de una clase al inglés
 * @param classId - ID de la clase en snake_case
 */
export function getClassNameEn(classId: string): string {
  return getClassName(classId, 'en');
}
