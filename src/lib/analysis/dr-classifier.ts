/**
 * Diabetic Retinopathy Classifier
 * Based on International Clinical Diabetic Retinopathy (ICDR) Severity Scale
 *
 * References:
 * - International Clinical Diabetic Retinopathy Disease Severity Scale
 * - ETDRS (Early Treatment Diabetic Retinopathy Study)
 */

import { Detection } from '../db/schema';
import { Patient } from '../db/schema';
import { classifyWithGuideline } from '../clinical-guidelines/multi-guideline-classifier';
import type { LesionCounts as GuidelineLesionCounts } from '@/types/clinical-guidelines';
import i18n from '@/i18n/config';

/**
 * Severity levels according to ICDR scale
 */
export type DRSeverityLevel =
  | 'no_dr'              // No Diabetic Retinopathy
  | 'mild_npdr'          // Mild Non-Proliferative DR
  | 'moderate_npdr'      // Moderate Non-Proliferative DR
  | 'severe_npdr'        // Severe Non-Proliferative DR
  | 'pdr';               // Proliferative DR

/**
 * Risk factors that influence DR progression
 */
export interface RiskFactors {
  diabetesDuration: 'low' | 'moderate' | 'high';
  diabetesControl: 'unknown' | 'poor' | 'fair' | 'good';
  hypertension: boolean;
  dyslipidemia: boolean;
  type1Diabetes: boolean;
}

/**
 * Lesion counts per eye
 */
export interface LesionCounts {
  microaneurysms: number;
  hemorrhages: number;
  hardExudates: number;
  softExudates: number;
  neovascularization: number;
}

/**
 * Classification result for a single eye
 */
export interface EyeClassification {
  eye: 'OD' | 'OI';
  severity: DRSeverityLevel;
  lesions: LesionCounts;
  criteria: string[];
  confidence: 'low' | 'moderate' | 'high';
}

/**
 * Complete DR classification result
 */
export interface DRClassification {
  timestamp: string;
  overallSeverity: DRSeverityLevel;
  rightEye?: EyeClassification;
  leftEye?: EyeClassification;
  riskFactors: RiskFactors;
  recommendations: string[];
  warnings: string[];
  clinicalNotes: string[];
  guidelineId?: string;
  guidelineName?: string;
  guidelineVersion?: string;
}

/**
 * Class name mappings (flexible for different model outputs)
 */
const CLASS_MAPPINGS: Record<string, string> = {
  'microaneurysm': 'microaneurysms',
  'microaneurisma': 'microaneurysms',
  'ma': 'microaneurysms',

  'hemorrhage': 'hemorrhages',
  'hemorrhages': 'hemorrhages',
  'hemorragia': 'hemorrhages',
  'hemorragias': 'hemorrhages',
  'he': 'hemorrhages',
  'microhemorrhage': 'hemorrhages',
  'microhemorrhages': 'hemorrhages',
  'microhemorragia': 'hemorrhages',
  'microhemorragias': 'hemorrhages',

  'hard_exudate': 'hardExudates',
  'hard_exudates': 'hardExudates',
  'hardexudate': 'hardExudates',
  'hardexudates': 'hardExudates',
  'exudado_duro': 'hardExudates',
  'exudados_duros': 'hardExudates',
  'hard exudate': 'hardExudates',
  'hard exudates': 'hardExudates',
  'exudate': 'hardExudates',
  'exudates': 'hardExudates',

  'soft_exudate': 'softExudates',
  'soft_exudates': 'softExudates',
  'softexudate': 'softExudates',
  'softexudates': 'softExudates',
  'exudado_blando': 'softExudates',
  'exudados_blandos': 'softExudates',
  'soft exudate': 'softExudates',
  'soft exudates': 'softExudates',
  'cotton_wool': 'softExudates',
  'cotton wool': 'softExudates',
  'cotton_wool_spot': 'softExudates',
  'cotton_wool_spots': 'softExudates',

  'neovascularization': 'neovascularization',
  'neovascularización': 'neovascularization',
  'nvd': 'neovascularization',
  'nve': 'neovascularization'
};

/**
 * Normalize class name to standard category
 */
function normalizeClassName(className: string): keyof LesionCounts | null {
  const normalized = CLASS_MAPPINGS[className.toLowerCase().trim()];
  return normalized as keyof LesionCounts || null;
}

/**
 * Count lesions by type from detections
 */
export function countLesions(detections: Detection[]): LesionCounts {
  const counts: LesionCounts = {
    microaneurysms: 0,
    hemorrhages: 0,
    hardExudates: 0,
    softExudates: 0,
    neovascularization: 0
  };

  detections.forEach(detection => {
    if (!detection.visible) return;

    const lesionType = normalizeClassName(detection.class);
    if (lesionType && lesionType in counts) {
      counts[lesionType]++;
    }
  });

  return counts;
}


/**
 * Assess risk factors from patient data
 */
export function assessRiskFactors(patient: Patient): RiskFactors {
  const riskFactors: RiskFactors = {
    diabetesDuration: 'low',
    diabetesControl: 'unknown',
    hypertension: patient.hta || false,
    dyslipidemia: patient.dlp || false,
    type1Diabetes: patient.diabetesType === 'type1'
  };

  // Assess diabetes duration risk
  if (patient.diabetesDuration !== undefined) {
    if (patient.diabetesDuration >= 15) {
      riskFactors.diabetesDuration = 'high';
    } else if (patient.diabetesDuration >= 5) {
      riskFactors.diabetesDuration = 'moderate';
    }
  }

  return riskFactors;
}

/**
 * Generate clinical recommendations based on classification
 */
export function generateRecommendations(
  classification: EyeClassification,
  riskFactors: RiskFactors
): string[] {
  const recommendations: string[] = [];
  const t = i18n.t.bind(i18n);

  // Based on severity
  const severityKeys: Record<DRSeverityLevel, string[]> = {
    pdr: ['urgentReferral', 'considerPRP', 'followup'],
    severe_npdr: ['urgentReferral', 'followup', 'considerTherapy'],
    moderate_npdr: ['refer', 'followup', 'optimizeGlycemic'],
    mild_npdr: ['annualExam', 'monitorGlucose', 'continueDM'],
    no_dr: ['annualScreening', 'maintainGlycemic'],
  };

  const keys = severityKeys[classification.severity] || [];
  for (const key of keys) {
    recommendations.push(t(`clinical.recommendations.${classification.severity}.${key}`));
  }

  // Risk factor based recommendations
  if (riskFactors.hypertension) {
    recommendations.push(t('clinical.recommendations.riskFactors.hypertension'));
  }

  if (riskFactors.dyslipidemia) {
    recommendations.push(t('clinical.recommendations.riskFactors.dyslipidemia'));
  }

  if (riskFactors.diabetesDuration === 'high') {
    recommendations.push(t('clinical.recommendations.riskFactors.longDuration'));
  }

  if (riskFactors.type1Diabetes) {
    recommendations.push(t('clinical.recommendations.riskFactors.type1'));
  }

  return recommendations;
}

/**
 * Generate warnings about classification limitations
 */
export function generateWarnings(
  detectionsByEye: Map<'OD' | 'OI', Detection[]>
): string[] {
  const warnings: string[] = [];
  const t = i18n.t.bind(i18n);

  // Check for missing eyes
  if (!detectionsByEye.has('OD')) {
    warnings.push(t('clinical.warnings.rightEyeUnavailable'));
  }
  if (!detectionsByEye.has('OI')) {
    warnings.push(t('clinical.warnings.leftEyeUnavailable'));
  }

  // AI limitations disclaimer
  warnings.push(t('clinical.warnings.aiDisclaimer'));
  warnings.push(t('clinical.warnings.clinicalCorrelation'));
  warnings.push(t('clinical.warnings.quadrantApproximated'));

  return warnings;
}

/**
 * Main classification function
 */
export async function classifyDiabeticRetinopathy(
  detectionsByEye: Map<'OD' | 'OI', Detection[]>,
  patient: Patient,
  guidelineId: string = 'icdr_2024'
): Promise<DRClassification> {
  const riskFactors = assessRiskFactors(patient);
  const clinicalNotes: string[] = [];

  // Classify each eye
  const eyeClassifications: EyeClassification[] = [];
  let gName: string | undefined;
  let gVersion: string | undefined;

  for (const [eye, detections] of detectionsByEye) {
    const lesions = countLesions(detections);
    
    let severity: DRSeverityLevel;
    let criteria: string[] = [];
    let confidence: 'low' | 'moderate' | 'high';
    
    try {
      // Prepare for guideline classifier
      const guidelineLesions: GuidelineLesionCounts = {
          ...lesions,
          total_lesions: Object.values(lesions).reduce((a, b) => a + b, 0),
          lesion_types_count: Object.values(lesions).filter(v => v > 0).length
      };

      const result = await classifyWithGuideline(guidelineId, guidelineLesions);
      severity = result.severity as DRSeverityLevel;
      confidence = result.confidence;
      
      // Capture guideline info
      gName = result.guideline_name;
      gVersion = result.guideline_version;
      
      // Add criteria info
      if (result.rule_421_details) {
        criteria.push(...result.rule_421_details);
      }
      
      // Add generic lesion counts as criteria
      if (lesions.neovascularization > 0) criteria.push(`Neovascularization: ${lesions.neovascularization}`);
      if (lesions.hemorrhages > 0) criteria.push(`Hemorrhages: ${lesions.hemorrhages}`);
      if (lesions.microaneurysms > 0) criteria.push(`Microaneurysms: ${lesions.microaneurysms}`);
      if (lesions.hardExudates > 0) criteria.push(`Hard Exudates: ${lesions.hardExudates}`);
      if (lesions.softExudates > 0) criteria.push(`Soft Exudates: ${lesions.softExudates}`);
      
      criteria.push(`Classified using ${result.guideline_name} (v${result.guideline_version})`);

    } catch (e) {
      console.error(`Error classifying eye ${eye} with guideline ${guidelineId}:`, e);
      // Fallback removed to prevent bad clinical decisions based on hardcoded logic
      throw new Error(`Failed to classify eye ${eye} with guideline ${guidelineId}: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    eyeClassifications.push({
      eye,
      severity,
      lesions,
      criteria,
      confidence
    });
  }

  // Determine overall severity (worst eye determines overall)
  // We need to fetch the severity order from the guideline if possible, but here we might need to rely on the static order or the one returned by the guideline result if we had access to it for both eyes.
  // Since we processed eyes in loop, we can assume standard order for now or try to get order from results.
  
  const severityOrder: DRSeverityLevel[] = ['no_dr', 'mild_npdr', 'moderate_npdr', 'severe_npdr', 'pdr'];
  const worstSeverity = eyeClassifications.reduce((worst, current) => {
    return severityOrder.indexOf(current.severity) > severityOrder.indexOf(worst)
      ? current.severity
      : worst;
  }, 'no_dr' as DRSeverityLevel);

  return {
    timestamp: new Date().toISOString(),
    overallSeverity: worstSeverity,
    rightEye: eyeClassifications.find(e => e.eye === 'OD'),
    leftEye: eyeClassifications.find(e => e.eye === 'OI'),
    riskFactors,
    recommendations: [],
    warnings: generateWarnings(detectionsByEye),
    clinicalNotes,
    guidelineId,
    guidelineName: gName,
    guidelineVersion: gVersion
  };
}

/**
 * Format classification result as human-readable text
 */
export function formatClassificationText(classification: DRClassification): string {
  const t = i18n.t.bind(i18n);
  const lang = i18n.language === 'es' ? 'es' : 'en';

  const getSeverityLabel = (severity: DRSeverityLevel): string => {
    return t(`analysis.drClassification.severity.${severity}.${lang}`);
  };

  let text = `${t('clinical.format.title')}\n`;
  if (classification.guidelineName) {
    text += `${t('clinical.format.protocol')}: ${classification.guidelineName} ${classification.guidelineVersion ? `(v${classification.guidelineVersion})` : ''}\n`;
  }
  text += `${'='.repeat(50)}\n\n`;
  text += `${t('clinical.format.overallSeverity')}: ${getSeverityLabel(classification.overallSeverity)}\n\n`;

  if (classification.rightEye) {
    text += `${t('clinical.format.rightEye')}: ${getSeverityLabel(classification.rightEye.severity)}\n`;
    text += `  ${t('clinical.format.confidence')}: ${classification.rightEye.confidence}\n`;
    text += `  ${t('clinical.format.criteria')}:\n`;
    classification.rightEye.criteria.forEach(c => text += `    - ${c}\n`);
    text += `\n`;
  }

  if (classification.leftEye) {
    text += `${t('clinical.format.leftEye')}: ${getSeverityLabel(classification.leftEye.severity)}\n`;
    text += `  ${t('clinical.format.confidence')}: ${classification.leftEye.confidence}\n`;
    text += `  ${t('clinical.format.criteria')}:\n`;
    classification.leftEye.criteria.forEach(c => text += `    - ${c}\n`);
    text += `\n`;
  }

  text += `${t('clinical.format.recommendations')}:\n`;
  classification.recommendations.forEach(r => text += `  - ${r}\n`);

  text += `\n${t('clinical.format.warnings')}:\n`;
  classification.warnings.forEach(w => text += `  - ${w}\n`);

  return text;
}
