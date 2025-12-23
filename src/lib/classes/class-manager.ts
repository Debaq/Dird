import { db } from '@/lib/db/schema';
import { getClassColor } from '@/lib/ai/model-metadata';

export interface ClassDefinition {
  name: string;
  source: 'ai' | 'custom';
  color: string;
  usageCount: number;
}

// Clases del modelo AI (hardcodeadas basadas en model-metadata.ts)
const AI_CLASSES = [
  'microaneurysm',
  'hard_exudate',
  'soft_exudate',
  'hemorrhage',
  'neovascularization',
];

// Paleta de colores para clases personalizadas (12 colores distintos)
const CUSTOM_COLOR_PALETTE = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
  '#F8B195', '#C06C84', '#6C5B7B', '#355C7D'
];

const STORAGE_KEY = 'dird-class-colors';

export class ClassManager {
  /**
   * Obtiene las clases del modelo AI
   */
  getAIClasses(): string[] {
    return [...AI_CLASSES];
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

      // Extraer clases únicas, excluir las que son AI classes
      const customClasses = new Set<string>();
      manualDetections.forEach(detection => {
        if (detection.class && !AI_CLASSES.includes(detection.class)) {
          customClasses.add(detection.class);
        }
      });

      return Array.from(customClasses);
    } catch (error) {
      console.error('Error al obtener clases personalizadas:', error);
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

    // Crear definiciones de clases AI
    const aiClassDefs: ClassDefinition[] = aiClasses.map(name => ({
      name,
      source: 'ai' as const,
      color: getClassColor(name),
      usageCount: usageCount.get(name) || 0,
    }));

    // Crear definiciones de clases custom (ordenadas alfabéticamente)
    const customClassDefs: ClassDefinition[] = customClasses
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({
        name,
        source: 'custom' as const,
        color: this.getColorForClass(name),
        usageCount: usageCount.get(name) || 0,
      }));

    // AI primero, custom después
    return [...aiClassDefs, ...customClassDefs];
  }

  /**
   * Obtiene el color para una clase específica
   * Primero busca en AI classes, luego en localStorage, finalmente genera uno nuevo
   */
  getColorForClass(className: string): string {
    // Si es clase AI, usar color predefinido
    if (AI_CLASSES.includes(className)) {
      return getClassColor(className);
    }

    // Buscar en localStorage
    const storedColor = this.getStoredColor(className);
    if (storedColor) {
      return storedColor;
    }

    // Generar y guardar color nuevo
    const newColor = this.generateColorForClass(className);
    this.saveColorPreference(className, newColor);
    return newColor;
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
      const stored = localStorage.getItem(STORAGE_KEY);
      const colors = stored ? JSON.parse(stored) : {};
      colors[className] = color;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
    } catch (error) {
      console.error('Error al guardar preferencia de color:', error);
    }
  }

  /**
   * Obtiene el color almacenado para una clase
   */
  private getStoredColor(className: string): string | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const colors = JSON.parse(stored);
      return colors[className] || null;
    } catch (error) {
      console.error('Error al leer preferencias de color:', error);
      return null;
    }
  }
}

// Exportar instancia singleton
export const classManager = new ClassManager();
