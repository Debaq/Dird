/**
 * GuidelineLoader
 *
 * Service for loading, validating, and caching clinical guidelines
 * from /public/clinical-guidelines/ directory
 */

import type {
  ClinicalGuideline,
  GuidelineIndex,
  GuidelineValidationError,
  GuidelineValidationResult,
} from '@/types/clinical-guidelines';

// ============================================================================
// Cache Management
// ============================================================================

const guidelineCache = new Map<string, ClinicalGuideline>();
let indexCache: GuidelineIndex | null = null;

// ============================================================================
// Guideline Index Loader
// ============================================================================

// Get base URL for assets (handles /dird/ base path in production)
const getAssetURL = (path: string): string => {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${path}`.replace(/\/\//g, '/');
};

export async function loadGuidelineIndex(): Promise<GuidelineIndex> {
  // Return cached index if available
  if (indexCache) {
    return indexCache;
  }

  try {
    const response = await fetch(getAssetURL('clinical-guidelines/index.json'));

    if (!response.ok) {
      throw new Error(`Failed to load guideline index: ${response.statusText}`);
    }

    const index: GuidelineIndex = await response.json();

    // Validate index structure
    if (!index.version || !Array.isArray(index.guidelines)) {
      throw new Error('Invalid guideline index structure');
    }

    // Cache the index
    indexCache = index;

    return index;
  } catch (error) {
    console.error('Error loading guideline index:', error);
    throw new Error('Failed to load clinical guidelines index');
  }
}

// ============================================================================
// Guideline Loader
// ============================================================================

export async function loadGuideline(guidelineId: string): Promise<ClinicalGuideline> {
  // Return cached guideline if available
  if (guidelineCache.has(guidelineId)) {
    return guidelineCache.get(guidelineId)!;
  }

  try {
    // Load index to get guideline file path
    const index = await loadGuidelineIndex();
    const entry = index.guidelines.find((g) => g.id === guidelineId);

    if (!entry) {
      throw new Error(`Guideline not found: ${guidelineId}`);
    }

    // Load guideline JSON file
    const response = await fetch(getAssetURL(`clinical-guidelines/${entry.file}`));

    if (!response.ok) {
      throw new Error(`Failed to load guideline: ${response.statusText}`);
    }

    const guideline: ClinicalGuideline = await response.json();

    // Validate guideline structure
    const validation = validateGuideline(guideline);

    if (!validation.valid) {
      console.error('Guideline validation errors:', validation.errors);
      throw new Error(
        `Guideline validation failed: ${validation.errors.map((e) => e.message).join(', ')}`
      );
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.warn('Guideline validation warnings:', validation.warnings);
    }

    // Cache the guideline
    guidelineCache.set(guidelineId, guideline);

    return guideline;
  } catch (error) {
    console.error(`Error loading guideline ${guidelineId}:`, error);
    throw new Error(`Failed to load guideline: ${guidelineId}`);
  }
}

// ============================================================================
// Guideline Validation
// ============================================================================

export function validateGuideline(guideline: ClinicalGuideline): GuidelineValidationResult {
  const errors: GuidelineValidationError[] = [];
  const warnings: GuidelineValidationError[] = [];

  // Validate guideline_id
  if (!guideline.guideline_id || typeof guideline.guideline_id !== 'string') {
    errors.push({
      field: 'guideline_id',
      message: 'guideline_id is required and must be a string',
      severity: 'error',
    });
  }

  // Validate metadata
  if (!guideline.metadata) {
    errors.push({
      field: 'metadata',
      message: 'metadata is required',
      severity: 'error',
    });
  } else {
    if (!guideline.metadata.name) {
      errors.push({
        field: 'metadata.name',
        message: 'metadata.name is required',
        severity: 'error',
      });
    }
    if (!guideline.metadata.version) {
      errors.push({
        field: 'metadata.version',
        message: 'metadata.version is required',
        severity: 'error',
      });
    }
    if (!guideline.metadata.country) {
      warnings.push({
        field: 'metadata.country',
        message: 'metadata.country is recommended',
        severity: 'warning',
      });
    }
  }

  // Validate severity_levels
  if (!Array.isArray(guideline.severity_levels) || guideline.severity_levels.length === 0) {
    errors.push({
      field: 'severity_levels',
      message: 'severity_levels must be a non-empty array',
      severity: 'error',
    });
  } else {
    guideline.severity_levels.forEach((level, index) => {
      if (!level.id) {
        errors.push({
          field: `severity_levels[${index}].id`,
          message: 'Severity level id is required',
          severity: 'error',
        });
      }
      if (!level.name) {
        errors.push({
          field: `severity_levels[${index}].name`,
          message: 'Severity level name is required',
          severity: 'error',
        });
      }
      if (typeof level.order !== 'number') {
        errors.push({
          field: `severity_levels[${index}].order`,
          message: 'Severity level order must be a number',
          severity: 'error',
        });
      }
      if (!level.color) {
        warnings.push({
          field: `severity_levels[${index}].color`,
          message: 'Severity level color is recommended',
          severity: 'warning',
        });
      }
    });

    // Check for duplicate severity IDs
    const severityIds = guideline.severity_levels.map((l) => l.id);
    const duplicates = severityIds.filter((id, index) => severityIds.indexOf(id) !== index);
    if (duplicates.length > 0) {
      errors.push({
        field: 'severity_levels',
        message: `Duplicate severity level IDs found: ${duplicates.join(', ')}`,
        severity: 'error',
      });
    }
  }

  // Validate classification_rules
  if (!Array.isArray(guideline.classification_rules)) {
    errors.push({
      field: 'classification_rules',
      message: 'classification_rules must be an array',
      severity: 'error',
    });
  } else {
    guideline.classification_rules.forEach((rule, index) => {
      if (!rule.severity) {
        errors.push({
          field: `classification_rules[${index}].severity`,
          message: 'Rule severity is required',
          severity: 'error',
        });
      }
      if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
        errors.push({
          field: `classification_rules[${index}].conditions`,
          message: 'Rule conditions must be a non-empty array',
          severity: 'error',
        });
      }
      if (!rule.logic || !['AND', 'OR'].includes(rule.logic)) {
        errors.push({
          field: `classification_rules[${index}].logic`,
          message: 'Rule logic must be "AND" or "OR"',
          severity: 'error',
        });
      }
      if (typeof rule.priority !== 'number') {
        errors.push({
          field: `classification_rules[${index}].priority`,
          message: 'Rule priority must be a number',
          severity: 'error',
        });
      }
    });
  }

  // Validate rule_421
  if (!guideline.rule_421) {
    warnings.push({
      field: 'rule_421',
      message: 'rule_421 is recommended for DR classification',
      severity: 'warning',
    });
  } else {
    if (typeof guideline.rule_421.enabled !== 'boolean') {
      errors.push({
        field: 'rule_421.enabled',
        message: 'rule_421.enabled must be a boolean',
        severity: 'error',
      });
    }
    if (guideline.rule_421.enabled) {
      if (!Array.isArray(guideline.rule_421.criteria) || guideline.rule_421.criteria.length === 0) {
        errors.push({
          field: 'rule_421.criteria',
          message: 'rule_421.criteria must be a non-empty array when enabled',
          severity: 'error',
        });
      }
    }
  }

  // Validate treatment_protocols
  if (!Array.isArray(guideline.treatment_protocols)) {
    errors.push({
      field: 'treatment_protocols',
      message: 'treatment_protocols must be an array',
      severity: 'error',
    });
  } else {
    guideline.treatment_protocols.forEach((protocol, index) => {
      if (!protocol.severity) {
        errors.push({
          field: `treatment_protocols[${index}].severity`,
          message: 'Treatment protocol severity is required',
          severity: 'error',
        });
      }
      if (!protocol.urgency || !['routine', 'accelerated', 'urgent'].includes(protocol.urgency)) {
        errors.push({
          field: `treatment_protocols[${index}].urgency`,
          message: 'Treatment protocol urgency must be "routine", "accelerated", or "urgent"',
          severity: 'error',
        });
      }
      if (!Array.isArray(protocol.actions) || protocol.actions.length === 0) {
        errors.push({
          field: `treatment_protocols[${index}].actions`,
          message: 'Treatment protocol actions must be a non-empty array',
          severity: 'error',
        });
      }
      if (typeof protocol.followup_interval_days !== 'number' || protocol.followup_interval_days <= 0) {
        errors.push({
          field: `treatment_protocols[${index}].followup_interval_days`,
          message: 'Treatment protocol followup_interval_days must be a positive number',
          severity: 'error',
        });
      }
    });
  }

  // Validate emcs_criteria
  if (!guideline.emcs_criteria) {
    warnings.push({
      field: 'emcs_criteria',
      message: 'emcs_criteria is recommended',
      severity: 'warning',
    });
  }

  // Validate class_mapping (optional but recommended)
  if (guideline.class_mapping) {
    if (typeof guideline.class_mapping !== 'object' || Array.isArray(guideline.class_mapping)) {
      errors.push({
        field: 'class_mapping',
        message: 'class_mapping must be an object',
        severity: 'error',
      });
    } else {
      // Validate each mapping entry
      Object.entries(guideline.class_mapping).forEach(([guidelineClass, modelClasses]) => {
        if (!Array.isArray(modelClasses)) {
          errors.push({
            field: `class_mapping.${guidelineClass}`,
            message: `class_mapping.${guidelineClass} must be an array of model class names`,
            severity: 'error',
          });
        } else {
          // Check if all entries are strings
          const invalidEntries = modelClasses.filter((c) => typeof c !== 'string');
          if (invalidEntries.length > 0) {
            errors.push({
              field: `class_mapping.${guidelineClass}`,
              message: `class_mapping.${guidelineClass} must contain only strings`,
              severity: 'error',
            });
          }
        }
      });
    }
  } else {
    warnings.push({
      field: 'class_mapping',
      message: 'class_mapping is recommended for flexibility with different model class names',
      severity: 'warning',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Cache Management Functions
// ============================================================================

export function clearGuidelineCache(): void {
  guidelineCache.clear();
  indexCache = null;
}

export function getGuidelineFromCache(guidelineId: string): ClinicalGuideline | null {
  return guidelineCache.get(guidelineId) || null;
}

// ============================================================================
// Utility Functions
// ============================================================================

export async function getAvailableGuidelines() {
  const index = await loadGuidelineIndex();
  return index.guidelines;
}

export async function getGuidelineSeverityLevels(guidelineId: string) {
  const guideline = await loadGuideline(guidelineId);
  return guideline.severity_levels.sort((a, b) => a.order - b.order);
}

export async function getTreatmentProtocol(guidelineId: string, severity: string) {
  const guideline = await loadGuideline(guidelineId);
  return guideline.treatment_protocols.find((p) => p.severity === severity);
}
