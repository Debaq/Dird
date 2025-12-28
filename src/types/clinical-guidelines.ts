/**
 * Clinical Guidelines Type Definitions
 *
 * Defines the structure for configurable clinical guidelines system
 * that allows DIRD to work with different DR classification standards
 * (ICDR International, MINSAL Chile, etc.)
 */

// ============================================================================
// Guideline Metadata
// ============================================================================

export interface GuidelineMetadata {
  name: string;
  full_name?: string;
  version: string;
  country: string;
  language: string;
  status: 'official' | 'draft' | 'custom' | 'deprecated';
  date_published?: string;
  organization?: string;
  description?: string;
}

// ============================================================================
// Severity Levels
// ============================================================================

export interface SeverityLevel {
  id: string;
  name: string;
  name_en?: string;
  name_es?: string;
  order: number;
  color: string;
  description: string;
  description_en?: string;
  description_es?: string;
}

// ============================================================================
// Classification Rules
// ============================================================================

export type RuleOperator = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'not_in';
export type RuleLogic = 'AND' | 'OR';

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value: number | string | boolean | number[] | string[];
}

export interface ClassificationRule {
  severity: string;
  conditions: RuleCondition[];
  logic: RuleLogic;
  priority: number;
}

// ============================================================================
// Rule 4-2-1
// ============================================================================

export interface Rule421Criterion {
  name: string;
  description?: string;
  field: string;
  min_quadrants?: number;
  min_per_quadrant?: number;
  severity?: string;
  min_area_disc_diameters?: number;
}

export interface Rule421 {
  enabled: boolean;
  name?: string;
  description?: string;
  criteria: Rule421Criterion[];
  severity_mapping: {
    '0_criteria_met'?: string;
    '1_criteria_met'?: string;
    '2_or_more_criteria_met'?: string;
  };
}

// ============================================================================
// Treatment Protocols
// ============================================================================

export type TreatmentUrgency = 'routine' | 'accelerated' | 'urgent';

export interface TreatmentProtocol {
  severity: string;
  urgency: TreatmentUrgency;
  actions: string[];
  actions_en?: string[];
  actions_es?: string[];
  followup_interval_days: number;
  rationale: string;
  rationale_en?: string;
  rationale_es?: string;
}

// ============================================================================
// EMCS Criteria
// ============================================================================

export interface EMCSCriteria {
  enabled: boolean;
  name?: string;
  geometric_distance_fovea_um: number;
  min_disc_areas: number;
  apply_geometric_rule: boolean;
  description?: string;
}

// ============================================================================
// Complete Clinical Guideline
// ============================================================================

export interface ClinicalGuideline {
  guideline_id: string;
  metadata: GuidelineMetadata;
  severity_levels: SeverityLevel[];
  classification_rules: ClassificationRule[];
  rule_421: Rule421;
  treatment_protocols: TreatmentProtocol[];
  emcs_criteria: EMCSCriteria;
}

// ============================================================================
// Guideline Index
// ============================================================================

export interface GuidelineIndexEntry {
  id: string;
  name: string;
  description: string;
  country: string;
  language: string;
  status: 'official' | 'draft' | 'custom' | 'deprecated';
  file: string;
  version: string;
  date_published?: string;
}

export interface GuidelineIndex {
  version: string;
  guidelines: GuidelineIndexEntry[];
}

// ============================================================================
// Classification Result with Guideline Info
// ============================================================================

export interface GuidelineClassificationResult {
  severity: string;
  severity_label: string;
  severity_order: number;
  severity_color: string;
  confidence: 'low' | 'moderate' | 'high';

  // Guideline info
  guideline_id: string;
  guideline_name: string;
  guideline_version: string;

  // Treatment recommendations
  urgency: TreatmentUrgency;
  actions: string[];
  followup_days: number;
  rationale: string;

  // Rule 4-2-1 info
  rule_421_criteria_met?: number;
  rule_421_details?: string[];

  // Warnings and flags
  warnings: string[];
}

// ============================================================================
// Lesion Counts (used in classification)
// ============================================================================

export interface LesionCounts {
  microaneurysms: number;
  hemorrhages: number;
  hardExudates: number;
  softExudates: number;
  neovascularization: number;
  venous_beading?: number;
  irma?: number;
  total_lesions: number;
  lesion_types_count: number;
}

// ============================================================================
// Quadrant Lesion Counts (used in Rule 4-2-1)
// ============================================================================

export interface QuadrantLesionCounts {
  'superior-temporal': {
    microaneurysms: number;
    hemorrhages: number;
    hardExudates: number;
    softExudates: number;
    neovascularization: number;
    venous_beading?: number;
    irma?: number;
  };
  'inferior-temporal': {
    microaneurysms: number;
    hemorrhages: number;
    hardExudates: number;
    softExudates: number;
    neovascularization: number;
    venous_beading?: number;
    irma?: number;
  };
  'superior-nasal': {
    microaneurysms: number;
    hemorrhages: number;
    hardExudates: number;
    softExudates: number;
    neovascularization: number;
    venous_beading?: number;
    irma?: number;
  };
  'inferior-nasal': {
    microaneurysms: number;
    hemorrhages: number;
    hardExudates: number;
    softExudates: number;
    neovascularization: number;
    venous_beading?: number;
    irma?: number;
  };
}

// ============================================================================
// API Integration Types
// ============================================================================

export interface GuidelineRecommendation {
  image_id: number;
  severity: string;
  severity_label: string;
  urgency: TreatmentUrgency;
  actions: string[];
  followup_days: number;
  rationale: string;
}

export interface SummaryAPIGuidelineInfo {
  guideline_id: string;
  guideline_name: string;
  version: string;
  country: string;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface GuidelineValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface GuidelineValidationResult {
  valid: boolean;
  errors: GuidelineValidationError[];
  warnings: GuidelineValidationError[];
}
