/**
 * Class Registry - Central source of truth for all detection classes
 *
 * This module manages the class definitions from the model metadata JSON
 * and provides utilities for class name normalization, mapping, and translation.
 *
 * All class-related logic should go through this registry to avoid hardcoding.
 */

export interface ClassDefinition {
  index: number;
  technical_name: string;
  display_name_en: string;
  display_name_es: string;
  category: 'anatomical_landmark' | 'lesion';
  severity_impact: 'none' | 'mild' | 'mild_to_moderate' | 'moderate' | 'moderate_to_severe' | 'severe';
  description_en: string;
  description_es: string;
  currently_detected: boolean;
  aliases?: string[];
}

export interface ModelMetadataExtended {
  model_version: string;
  model_type: string;
  model_name: string;
  classes: ClassDefinition[];
  class_groups?: {
    [groupName: string]: number[];
  };
}

/**
 * Class Registry Service
 */
export class ClassRegistry {
  private classes: Map<string, ClassDefinition> = new Map();
  private classesByIndex: Map<number, ClassDefinition> = new Map();
  private aliasMap: Map<string, string> = new Map();
  private metadata: ModelMetadataExtended | null = null;

  /**
   * Load class definitions from model metadata
   */
  async loadFromMetadata(metadata: ModelMetadataExtended): Promise<void> {
    this.metadata = metadata;
    this.classes.clear();
    this.classesByIndex.clear();
    this.aliasMap.clear();

    for (const classDef of metadata.classes) {
      const technicalName = classDef.technical_name.toLowerCase();

      // Store by technical name
      this.classes.set(technicalName, classDef);

      // Store by index
      this.classesByIndex.set(classDef.index, classDef);

      // Map technical name to itself
      this.aliasMap.set(technicalName, technicalName);

      // Map all aliases to technical name
      if (classDef.aliases) {
        for (const alias of classDef.aliases) {
          this.aliasMap.set(alias.toLowerCase(), technicalName);
        }
      }
    }

    console.log(`[ClassRegistry] Loaded ${this.classes.size} class definitions from model ${metadata.model_version}`);
  }

  /**
   * Normalize a class name to its technical name
   * Handles aliases, snake_case, camelCase, etc.
   */
  normalizeName(name: string): string | null {
    const normalized = name.toLowerCase().trim().replace(/\s+/g, '_');
    return this.aliasMap.get(normalized) || null;
  }

  /**
   * Get class definition by any name (technical name or alias)
   */
  getClass(name: string): ClassDefinition | null {
    const technicalName = this.normalizeName(name);
    return technicalName ? this.classes.get(technicalName) || null : null;
  }

  /**
   * Get class definition by index
   */
  getClassByIndex(index: number): ClassDefinition | null {
    return this.classesByIndex.get(index) || null;
  }

  /**
   * Get display name for a class (respects i18n language)
   */
  getDisplayName(name: string, language: 'en' | 'es' = 'es'): string {
    const classDef = this.getClass(name);
    if (!classDef) return name;

    return language === 'es' ? classDef.display_name_es : classDef.display_name_en;
  }

  /**
   * Get description for a class
   */
  getDescription(name: string, language: 'en' | 'es' = 'es'): string {
    const classDef = this.getClass(name);
    if (!classDef) return '';

    return language === 'es' ? classDef.description_es : classDef.description_en;
  }

  /**
   * Check if a class is an anatomical landmark
   */
  isAnatomicalLandmark(name: string): boolean {
    const classDef = this.getClass(name);
    return classDef?.category === 'anatomical_landmark' || false;
  }

  /**
   * Check if a class is a lesion
   */
  isLesion(name: string): boolean {
    const classDef = this.getClass(name);
    return classDef?.category === 'lesion' || false;
  }

  /**
   * Get all lesion classes (excluding anatomical landmarks)
   */
  getLesionClasses(): ClassDefinition[] {
    return Array.from(this.classes.values()).filter(c => c.category === 'lesion');
  }

  /**
   * Get all currently detected classes
   */
  getDetectedClasses(): ClassDefinition[] {
    return Array.from(this.classes.values()).filter(c => c.currently_detected);
  }

  /**
   * Get all class technical names
   */
  getAllTechnicalNames(): string[] {
    return Array.from(this.classes.keys());
  }

  /**
   * Get classes by severity impact
   */
  getClassesBySeverity(severity: ClassDefinition['severity_impact']): ClassDefinition[] {
    return Array.from(this.classes.values()).filter(c => c.severity_impact === severity);
  }

  /**
   * Get model version
   */
  getModelVersion(): string {
    return this.metadata?.model_version || 'unknown';
  }

  /**
   * Get class groups
   */
  getClassGroups(): { [groupName: string]: number[] } {
    return this.metadata?.class_groups || {};
  }

  /**
   * Check if registry is loaded
   */
  isLoaded(): boolean {
    return this.metadata !== null && this.classes.size > 0;
  }
}

// Singleton instance
export const classRegistry = new ClassRegistry();

/**
 * Helper function to initialize the registry from a JSON file
 */
export async function initializeClassRegistry(metadataUrl: string): Promise<void> {
  try {
    const response = await fetch(metadataUrl);
    if (!response.ok) {
      throw new Error(`Failed to load class metadata: ${response.statusText}`);
    }

    const metadata: ModelMetadataExtended = await response.json();
    await classRegistry.loadFromMetadata(metadata);
  } catch (error) {
    console.error('[ClassRegistry] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Helper function to get display name (shortcut)
 */
export function getClassDisplayName(name: string, language: 'en' | 'es' = 'es'): string {
  return classRegistry.getDisplayName(name, language);
}

/**
 * Helper function to normalize name (shortcut)
 */
export function normalizeClassName(name: string): string | null {
  return classRegistry.normalizeName(name);
}
