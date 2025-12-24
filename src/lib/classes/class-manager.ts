import { db } from '@/lib/db/schema';
import { getClassColor, type ModelMetadata } from '@/lib/ai/model-metadata';
import { getClassName } from '@/lib/ai/class-translations';
import { useConfigStore } from '@/stores/config-store';

export interface ClassDefinition {
  name: string;
  displayName: string; // Nombre traducido para mostrar al usuario (efectivo)
  customName: string | null; // Nombre personalizado si existe
  source: 'ai' | 'custom';
  color: string; // Color asignado
  usageCount: number;
}

// Legacy classes (for backward compatibility with old hardcoded values)
const LEGACY_AI_CLASSES = [
  'microaneurysm',
  'hard_exudate',
  'soft_exudate',
  'hemorrhage',
  'neovascularization',
];

// Store the current model metadata
let currentModelMetadata: ModelMetadata | null = null;

// Paleta de colores para clases personalizadas (12 colores distintos)
const CUSTOM_COLOR_PALETTE = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
  '#F8B195', '#C06C84', '#6C5B7B', '#355C7D'
];

const STORAGE_KEY_COLORS = 'dird-class-colors';
const STORAGE_KEY_TRANSLATIONS = 'dird-class-translations';

export class ClassManager {
  /**
   * Establece el metadata del modelo actual
   */
  setModelMetadata(metadata: ModelMetadata): void {
    currentModelMetadata = metadata;
  }

  /**
   * Carga el metadata del modelo desde GitHub si no está en memoria
   * Intenta cargar desde el modelo descargado o desde GitHub
   */
  async ensureMetadataLoaded(): Promise<void> {
    // Si ya tenemos metadata cargado, no hacer nada
    if (currentModelMetadata && currentModelMetadata.classes) {
      // Limpiar colores incorrectos cada vez que se asegura que metadata está cargado
      this.cleanupIncorrectColors();
      return;
    }

    try {
      // Intentar obtener la versión del modelo cargado desde IndexedDB
      const cache = await caches.open('dird-models-v1');
      const keys = await cache.keys();

      // Buscar archivos de metadata en cache
      for (const request of keys) {
        if (request.url.includes('detection-v') && request.url.endsWith('.json')) {
          const response = await cache.match(request);
          if (response) {
            const metadata = await response.json();
            this.setModelMetadata(metadata);
            // Limpiar colores incorrectos después de cargar metadata
            this.cleanupIncorrectColors();
            return;
          }
        }
      }

      // Si no hay en cache, intentar cargar desde GitHub (latest)
      const response = await fetch('https://raw.githubusercontent.com/Debaq/dird_models/main/detection-v1.0.1.json');
      if (response.ok) {
        const metadata = await response.json();
        this.setModelMetadata(metadata);
        // Limpiar colores incorrectos después de cargar metadata
        this.cleanupIncorrectColors();
        return;
      }
    } catch (error) {
      // Error handling without logging
    }

    // Si todo falla, usar legacy como último recurso
    // Using legacy fallback without logging
  }

  /**
   * Obtiene las clases del modelo AI
   * Si hay metadata cargado, usa las clases del modelo
   * Si no, usa las clases legacy para compatibilidad
   */
  getAIClasses(): string[] {
    if (currentModelMetadata && currentModelMetadata.classes) {
      return [...currentModelMetadata.classes];
    }
    return [...LEGACY_AI_CLASSES];
  }

  /**
   * Obtiene clases personalizadas únicas de la base de datos
   * (solo de detecciones manuales)
   */
  async getCustomClasses(): Promise<string[]> {
    try {
      const manualDetections = await db.detections
        .where('type')
        .equals('manual')
        .toArray();

      const aiClasses = this.getAIClasses();

      // Extraer clases únicas, excluir las que son AI classes
      const customClasses = new Set<string>();
      manualDetections.forEach(detection => {
        if (detection.class && !aiClasses.includes(detection.class)) {
          customClasses.add(detection.class);
        }
      });

      return Array.from(customClasses);
    } catch (error) {
      // Error handling without logging
      return [];
    }
  }

  /**
   * Obtiene todas las clases disponibles (AI + custom) ordenadas
   * AI primero, custom después alfabéticamente
   */
  async getAllClasses(): Promise<ClassDefinition[]> {
    const aiClasses = this.getAIClasses();
    const customClasses = await this.getCustomClasses();

    // Contar uso de cada clase
    const allDetections = await db.detections.toArray();
    const usageCount = new Map<string, number>();

    allDetections.forEach(detection => {
      if (detection.class) {
        usageCount.set(detection.class, (usageCount.get(detection.class) || 0) + 1);
      }
    });

    // Crear definiciones de clases AI con nombres traducidos
    const aiClassDefs: ClassDefinition[] = aiClasses.map(name => ({
      name,
      displayName: getClassName(name), // Usa el idioma actual del sistema o custom
      customName: this.getCustomTranslation(name),
      source: 'ai' as const,
      color: this.getAssignedColor(name),
      usageCount: usageCount.get(name) || 0,
    }));

    // Crear definiciones de clases custom (ordenadas alfabéticamente)
    const customClassDefs: ClassDefinition[] = customClasses
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({
        name,
        displayName: this.getCustomTranslation(name) || name, // Las clases custom se muestran con su nombre original o custom
        customName: this.getCustomTranslation(name),
        source: 'custom' as const,
        color: this.getAssignedColor(name),
        usageCount: usageCount.get(name) || 0,
      }));

    // AI primero, custom después
    return [...aiClassDefs, ...customClassDefs];
  }

  /**
   * Obtiene el color EFECTIVO para una clase (considerando Rainbow Mode)
   * Usado para renderizar
   */
  getColorForClass(className: string): string {
    const { appearance } = useConfigStore.getState().config;
    
    // Si Rainbow Mode está desactivado, retornar color principal
    if (!appearance.rainbowMode) {
      return appearance.primaryColor;
    }

    return this.getAssignedColor(className);
  }

  /**
   * Obtiene el color ASIGNADO para una clase
   * (Ignora Rainbow Mode, devuelve el color específico de la clase)
   */
  getAssignedColor(className: string): string {
    const aiClasses = this.getAIClasses();

    // Buscar en localStorage primero (prioridad sobre defaults)
    const storedColor = this.getStoredColor(className);
    if (storedColor) {
      return storedColor;
    }

    // Si es clase AI y no tiene override, usar color predefinido
    if (aiClasses.includes(className)) {
      return getClassColor(className);
    }

    // Para clases custom, generar color pero NO guardarlo automáticamente
    // Solo se guardará cuando el usuario lo cambie explícitamente en el modal
    return this.generateColorForClass(className);
  }

  /**
   * Genera un color automático para una clase usando hash del nombre
   */
  generateColorForClass(className: string): string {
    // Hash simple del string
    let hash = 0;
    for (let i = 0; i < className.length; i++) {
      hash = className.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % CUSTOM_COLOR_PALETTE.length;
    return CUSTOM_COLOR_PALETTE[index];
  }

  /**
   * Guarda la preferencia de color en localStorage
   */
  saveColorPreference(className: string, color: string): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_COLORS);
      const colors = stored ? JSON.parse(stored) : {};
      colors[className] = color;
      localStorage.setItem(STORAGE_KEY_COLORS, JSON.stringify(colors));
    } catch (error) {
      // Error handling without logging
    }
  }

  /**
   * Resetea el color de una clase específica eliminándolo de localStorage
   * Útil para volver al color por defecto
   */
  resetColorPreference(className: string): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_COLORS);
      if (!stored) return;

      const colors = JSON.parse(stored);
      delete colors[className];
      localStorage.setItem(STORAGE_KEY_COLORS, JSON.stringify(colors));
    } catch (error) {
      // Error handling without logging
    }
  }

  /**
   * Limpia colores guardados incorrectamente para clases AI
   * Esto soluciona el problema donde clases AI fueron tratadas como custom
   */
  cleanupIncorrectColors(): void {
    try {
      const aiClasses = this.getAIClasses();
      const stored = localStorage.getItem(STORAGE_KEY_COLORS);
      if (!stored) return;

      const colors = JSON.parse(stored);
      let changed = false;

      // Para cada clase AI, verificar si el color guardado es de la paleta custom
      aiClasses.forEach(className => {
        const savedColor = colors[className];

        // Solo eliminamos si es un color de la paleta custom (indica que fue tratado como custom)
        if (savedColor && CUSTOM_COLOR_PALETTE.includes(savedColor)) {
          delete colors[className];
          changed = true;
        }
      });

      if (changed) {
        localStorage.setItem(STORAGE_KEY_COLORS, JSON.stringify(colors));
      }
    } catch (error) {
      // Error handling without logging
    }
  }

  /**
   * Obtiene el color almacenado para una clase
   */
  private getStoredColor(className: string): string | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_COLORS);
      if (!stored) return null;
      const colors = JSON.parse(stored);
      return colors[className] || null;
    } catch (error) {
      // Error handling without logging
      return null;
    }
  }

  /**
   * Guarda una traducción personalizada para una clase
   */
  saveCustomTranslation(className: string, translation: string): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_TRANSLATIONS);
      const translations = stored ? JSON.parse(stored) : {};
      if (translation && translation.trim() !== '') {
        translations[className] = translation.trim();
      } else {
        delete translations[className];
      }
      localStorage.setItem(STORAGE_KEY_TRANSLATIONS, JSON.stringify(translations));
    } catch (error) {
      // Error handling without logging
    }
  }

  /**
   * Obtiene la traducción personalizada para una clase
   */
  getCustomTranslation(className: string): string | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_TRANSLATIONS);
      if (!stored) return null;
      const translations = JSON.parse(stored);
      return translations[className] || null;
    } catch (error) {
      // Error handling without logging
      return null;
    }
  }
}

// Exportar instancia singleton
export const classManager = new ClassManager();
