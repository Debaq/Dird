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
} from '@/types/clinical-guidelines';
import { loadGuideline } from './guideline-loader';

// ============================================================================
// Rule Evaluation
// ============================================================================

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
  } else if (field in lesions) {
    fieldValue = lesions[field as keyof LesionCounts];
  } else {
    console.warn(`Unknown field in rule condition: ${field}`);
    return false;
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
        `${name}: ${quadrantsWithCriterion}/${min_quadrants} cuadrantes cumplidos`
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

  // Calculate Rule 4-2-1 criteria if enabled
  const rule421Result = calculateRule421CriteriaMet(guideline, lesions, quadrantLesions);

  // Sort rules by priority (lower priority number = evaluated first)
  const sortedRules = [...guideline.classification_rules].sort(
    (a, b) => a.priority - b.priority
  );

  // Find first matching rule
  let matchedSeverity: string | null = null;

  for (const rule of sortedRules) {
    if (evaluateRule(rule, lesions, rule421Result.criteriaMet)) {
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

  // Determine language for labels (use Spanish if available, fallback to English)
  const severityLabel = severityLevel.name_es || severityLevel.name;
  const actions = protocol?.actions_es || protocol?.actions || [];
  const rationale = protocol?.rationale_es || protocol?.rationale || '';

  // Build warnings
  const warnings: string[] = [];

  if (!quadrantLesions) {
    warnings.push('Análisis de cuadrantes no disponible - precisión de regla 4-2-1 reducida');
  }

  if (rule421Result.criteriaMet > 0 && !quadrantLesions) {
    warnings.push('Regla 4-2-1 no pudo ser completamente evaluada');
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
