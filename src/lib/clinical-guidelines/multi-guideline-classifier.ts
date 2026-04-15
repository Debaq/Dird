/**
 * MultiGuidelineClassifier
 *
 * Dynamic DR classification engine that applies rules from any clinical guideline
 * Replaces hardcoded classification logic with configurable rule-based system
 */

import type {
  ClinicalGuideline,
  GuidelineClassificationResult,
  LesionCounts,
  QuadrantLesionCounts,
  RuleCondition,
  ClassificationRule,
  ClassMapping,
} from '@/types/clinical-guidelines';
import { loadGuideline } from './guideline-loader';
import { classManager } from '../classes/class-manager';
import i18n from '@/i18n/config';

// ============================================================================
// Localization Helpers
// ============================================================================

/**
 * Pick the localized field from a guideline object based on current i18n language.
 * Fields follow the pattern: field_es (Spanish), field (English/default).
 */
function getLocalizedField<T>(obj: Record<string, any>, field: string, fallback: T): T {
  const lang = i18n.language;
  if (lang === 'es' && `${field}_es` in obj && obj[`${field}_es`] != null) {
    return obj[`${field}_es`];
  }
  return obj[field] ?? fallback;
}

// ============================================================================
// Class Mapping
// ============================================================================

/**
 * Legacy mapping for backward compatibility with LesionCounts interface
 * Maps technical_names from model to LesionCounts field names
 */
const TECHNICAL_NAME_TO_LESION_COUNTS: Record<string, keyof LesionCounts> = {
  'microaneurysm': 'microaneurysms',
  'microhemorrhages': 'microaneurysms', // Often grouped with microaneurysms
  'hemorrhage': 'hemorrhages',
  'hard_exudate': 'hardExudates',
  'cotton_wool_spot': 'softExudates',
  'neovascularization': 'neovascularization',
  'venous_beading': 'venous_beading',
  'irma': 'irma',
};

/**
 * Applies class mapping to transform model detections to guideline-expected classes
 * NOW uses classManager for normalization instead of hardcoded class_mapping
 *
 * Example:
 * - Model detects: { microhemorrhage: 5, microaneurysm: 3, ... }
 * - classManager normalizes both to their technical_names
 * - Result: { microaneurysms: 8, ... } (mapped to LesionCounts fields)
 *
 * @param modelLesions - Raw lesion counts from model detections
 * @param classMapping - (DEPRECATED) Optional fallback mapping for backward compatibility
 * @returns Transformed lesion counts matching guideline expectations
 */
function applyClassMapping(
  modelLesions: Record<string, any>,
  _classMapping?: ClassMapping
): LesionCounts {
  // Initialize mapped lesions with zeros
  const mappedLesions: Record<string, number> = {
    microaneurysms: 0,
    hemorrhages: 0,
    hardExudates: 0,
    softExudates: 0,
    neovascularization: 0,
    venous_beading: 0,
    irma: 0,
  };

  // Process each model detection class
  for (const [modelClassName, count] of Object.entries(modelLesions)) {
    if (typeof count !== 'number') continue;

    // Skip metadata fields
    if (modelClassName === 'total_lesions' || modelClassName === 'lesion_types_count') {
      continue;
    }

    // Step 1: Normalize to technical_name using classManager
    const technicalName = classManager.normalizeName(modelClassName);

    if (technicalName) {
      // Step 2: Map technical_name to LesionCounts field
      const lesionCountsKey = TECHNICAL_NAME_TO_LESION_COUNTS[technicalName];

      if (lesionCountsKey) {
        mappedLesions[lesionCountsKey] += count;
      } else {
        // Unknown technical_name, try direct match
        if (technicalName in mappedLesions) {
          (mappedLesions as any)[technicalName] += count;
        }
      }
    } else {
      // Fallback: try direct match with modelClassName
      if (modelClassName in mappedLesions) {
        (mappedLesions as any)[modelClassName] += count;
      }
    }
  }

  return normalizeToLesionCounts(mappedLesions);
}

/**
 * Applies class mapping to quadrant lesion counts
 */
function applyClassMappingToQuadrants(
  modelQuadrantLesions?: Record<string, any>,
  _classMapping?: ClassMapping
): QuadrantLesionCounts | undefined {
  if (!modelQuadrantLesions) {
    return undefined;
  }

  const quadrantNames = ['superior-temporal', 'inferior-temporal', 'superior-nasal', 'inferior-nasal'];
  const mappedQuadrants: any = {};

  for (const quadrantName of quadrantNames) {
    const quadrant = modelQuadrantLesions[quadrantName];
    if (quadrant) {
      mappedQuadrants[quadrantName] = applyClassMapping(quadrant, _classMapping);
    }
  }

  return mappedQuadrants as QuadrantLesionCounts;
}

/**
 * Normalizes any object to LesionCounts structure
 */
function normalizeToLesionCounts(data: Record<string, any>): LesionCounts {
  const microaneurysms = data.microaneurysms || 0;
  const hemorrhages = data.hemorrhages || 0;
  const hardExudates = data.hardExudates || data.hard_exudates || 0;
  const softExudates = data.softExudates || data.soft_exudates || 0;
  const neovascularization = data.neovascularization || 0;
  const venous_beading = data.venous_beading || data.venousBeading || 0;
  const irma = data.irma || 0;

  const total_lesions =
    microaneurysms +
    hemorrhages +
    hardExudates +
    softExudates +
    neovascularization +
    (venous_beading || 0) +
    (irma || 0);

  const lesion_types_count = [
    microaneurysms > 0,
    hemorrhages > 0,
    hardExudates > 0,
    softExudates > 0,
    neovascularization > 0,
    (venous_beading || 0) > 0,
    (irma || 0) > 0,
  ].filter(Boolean).length;

  return {
    microaneurysms,
    hemorrhages,
    hardExudates,
    softExudates,
    neovascularization,
    venous_beading,
    irma,
    total_lesions,
    lesion_types_count,
  };
}

// ============================================================================
// Rule Evaluation
// ============================================================================

/**
 * Normalize field name to handle both snake_case and camelCase
 */
function normalizeFieldName(field: string): keyof LesionCounts | string {
  const fieldMap: Record<string, keyof LesionCounts> = {
    'microaneurysms': 'microaneurysms',
    'micro_aneurysms': 'microaneurysms',
    'hemorrhages': 'hemorrhages',
    'hardExudates': 'hardExudates',
    'hard_exudates': 'hardExudates',
    'softExudates': 'softExudates',
    'soft_exudates': 'softExudates',
    'neovascularization': 'neovascularization',
    'venous_beading': 'venous_beading',
    'irma': 'irma',
    'total_lesions': 'total_lesions',
    'lesion_types_count': 'lesion_types_count'
  };

  return fieldMap[field] || field;
}

/**
 * Evaluates a single rule condition against lesion counts
 */
function evaluateCondition(
  condition: RuleCondition,
  lesions: LesionCounts,
  rule421CriteriaMet?: number
): boolean {
  const { field, operator, value } = condition;

  // Get field value from lesions object
  let fieldValue: any;

  if (field === 'rule_421_met' || field === 'rule_421_criteria_met') {
    fieldValue = rule421CriteriaMet !== undefined ? rule421CriteriaMet >= 1 : false;
  } else if (field === 'rule_421_criteria_met') {
    fieldValue = rule421CriteriaMet || 0;
  } else {
    // Normalize field name to handle both snake_case and camelCase
    const normalizedField = normalizeFieldName(field);

    if (normalizedField in lesions) {
      fieldValue = lesions[normalizedField as keyof LesionCounts];
    } else {
      console.warn(`Unknown field in rule condition: ${field} (normalized: ${normalizedField})`);
      return false;
    }
  }

  // Evaluate based on operator
  switch (operator) {
    case '==':
      return fieldValue === value;
    case '!=':
      return fieldValue !== value;
    case '>':
      return fieldValue > value;
    case '<':
      return fieldValue < value;
    case '>=':
      return fieldValue >= value;
    case '<=':
      return fieldValue <= value;
    case 'in':
      return Array.isArray(value) && (value as any[]).includes(fieldValue);
    case 'not_in':
      return Array.isArray(value) && !(value as any[]).includes(fieldValue);
    default:
      console.warn(`Unknown operator: ${operator}`);
      return false;
  }
}

/**
 * Evaluates all conditions in a classification rule
 */
function evaluateRule(
  rule: ClassificationRule,
  lesions: LesionCounts,
  rule421CriteriaMet?: number
): boolean {
  const { conditions, logic } = rule;

  if (logic === 'AND') {
    return conditions.every((condition) =>
      evaluateCondition(condition, lesions, rule421CriteriaMet)
    );
  } else if (logic === 'OR') {
    return conditions.some((condition) =>
      evaluateCondition(condition, lesions, rule421CriteriaMet)
    );
  }

  return false;
}

// ============================================================================
// Rule 4-2-1 Evaluation
// ============================================================================

/**
 * Calculates how many Rule 4-2-1 criteria are met
 */
function calculateRule421CriteriaMet(
  guideline: ClinicalGuideline,
  _lesions: LesionCounts,
  quadrantLesions?: QuadrantLesionCounts
): { criteriaMet: number; details: string[] } {
  if (!guideline.rule_421.enabled) {
    return { criteriaMet: 0, details: [] };
  }

  let criteriaMet = 0;
  const details: string[] = [];

  guideline.rule_421.criteria.forEach((criterion) => {
    const { name, field, min_quadrants, min_per_quadrant } = criterion;

    if (!quadrantLesions || !min_quadrants) {
      return; // Skip if no quadrant data available
    }

    // Count quadrants that meet the criterion
    const quadrantsWithCriterion = Object.values(quadrantLesions).filter((quadrant) => {
      // Type-safe field access
      const lesionCount = (quadrant as any)[field] as number | undefined || 0;
      return min_per_quadrant ? lesionCount >= min_per_quadrant : lesionCount > 0;
    }).length;

    if (quadrantsWithCriterion >= min_quadrants) {
      criteriaMet++;
      details.push(
        i18n.t('clinical.rule421.quadrantsMet', {
          name,
          met: quadrantsWithCriterion,
          required: min_quadrants,
        })
      );
    }
  });

  return { criteriaMet, details };
}

// ============================================================================
// Classification Engine
// ============================================================================

/**
 * Classifies DR severity using dynamic guideline rules
 */
export async function classifyWithGuideline(
  guidelineId: string,
  lesions: LesionCounts,
  quadrantLesions?: QuadrantLesionCounts,
  confidence: 'low' | 'moderate' | 'high' = 'moderate'
): Promise<GuidelineClassificationResult> {
  // Load guideline
  const guideline = await loadGuideline(guidelineId);

  // Apply class mapping if defined (transforms model classes to guideline classes)
  const mappedLesions = applyClassMapping(lesions as any, guideline.class_mapping);
  const mappedQuadrantLesions = applyClassMappingToQuadrants(
    quadrantLesions as any,
    guideline.class_mapping
  );

  // Calculate Rule 4-2-1 criteria if enabled (using mapped lesions)
  const rule421Result = calculateRule421CriteriaMet(
    guideline,
    mappedLesions,
    mappedQuadrantLesions
  );

  // Sort rules by priority (lower priority number = evaluated first)
  const sortedRules = [...guideline.classification_rules].sort(
    (a, b) => a.priority - b.priority
  );

  // Find first matching rule (using mapped lesions)
  let matchedSeverity: string | null = null;

  for (const rule of sortedRules) {
    const ruleMatched = evaluateRule(rule, mappedLesions, rule421Result.criteriaMet);

    if (ruleMatched) {
      matchedSeverity = rule.severity;
      break;
    }
  }

  // Fallback if no rule matched
  if (!matchedSeverity) {
    matchedSeverity = 'no_dr';
    console.warn('No classification rule matched - defaulting to no_dr');
  }

  // Get severity level details
  const severityLevel = guideline.severity_levels.find((level) => level.id === matchedSeverity);

  if (!severityLevel) {
    throw new Error(`Severity level not found: ${matchedSeverity}`);
  }

  // Get treatment protocol
  const protocol = guideline.treatment_protocols.find((p) => p.severity === matchedSeverity);

  if (!protocol) {
    console.warn(`No treatment protocol found for severity: ${matchedSeverity}`);
  }

  // Determine language for labels based on active i18n language
  const severityLabel = getLocalizedField(severityLevel, 'name', severityLevel.name);
  const actions = protocol ? getLocalizedField(protocol, 'actions', protocol.actions || []) : [];
  const rationale = protocol ? getLocalizedField(protocol, 'rationale', protocol.rationale || '') : '';

  // Build warnings
  const warnings: string[] = [];

  if (!quadrantLesions) {
    warnings.push(i18n.t('clinical.warnings.quadrantUnavailable'));
  }

  if (rule421Result.criteriaMet > 0 && !quadrantLesions) {
    warnings.push(i18n.t('clinical.warnings.rule421NotEvaluated'));
  }

  // Build result
  const result: GuidelineClassificationResult = {
    severity: matchedSeverity,
    severity_label: severityLabel,
    severity_order: severityLevel.order,
    severity_color: severityLevel.color,
    confidence,

    guideline_id: guideline.guideline_id,
    guideline_name: guideline.metadata.name,
    guideline_version: guideline.metadata.version,

    urgency: protocol?.urgency || 'routine',
    actions,
    followup_days: protocol?.followup_interval_days || 365,
    rationale,

    rule_421_criteria_met: rule421Result.criteriaMet,
    rule_421_details: rule421Result.details.length > 0 ? rule421Result.details : undefined,

    warnings,
  };

  return result;
}

// ============================================================================
// Batch Classification
// ============================================================================

/**
 * Classifies multiple images using the same guideline
 */
export async function classifyBatchWithGuideline(
  guidelineId: string,
  imagesData: Array<{
    lesions: LesionCounts;
    quadrantLesions?: QuadrantLesionCounts;
    confidence?: 'low' | 'moderate' | 'high';
  }>
): Promise<GuidelineClassificationResult[]> {
  const results: GuidelineClassificationResult[] = [];

  for (const imageData of imagesData) {
    const result = await classifyWithGuideline(
      guidelineId,
      imageData.lesions,
      imageData.quadrantLesions,
      imageData.confidence
    );
    results.push(result);
  }

  return results;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Gets the maximum severity level from multiple classifications
 */
export function getMaximumSeverity(
  results: GuidelineClassificationResult[]
): GuidelineClassificationResult | null {
  if (results.length === 0) return null;

  return results.reduce((max, current) => {
    return current.severity_order > max.severity_order ? current : max;
  });
}

/**
 * Gets the most urgent treatment recommendation from multiple classifications
 */
export function getMostUrgentRecommendation(
  results: GuidelineClassificationResult[]
): GuidelineClassificationResult | null {
  if (results.length === 0) return null;

  const urgencyOrder = { urgent: 0, accelerated: 1, routine: 2 };

  return results.reduce((mostUrgent, current) => {
    return urgencyOrder[current.urgency] < urgencyOrder[mostUrgent.urgency]
      ? current
      : mostUrgent;
  });
}
