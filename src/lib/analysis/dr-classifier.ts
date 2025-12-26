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
 * Classify severity based on lesion counts (ICDR criteria)
 *
 * Criteria:
 * - No DR: No microaneurysms or other lesions
 * - Mild NPDR: Only microaneurysms
 * - Moderate NPDR: More than microaneurysms but less than severe NPDR
 * - Severe NPDR: One of the following (4-2-1 rule):
 *   - Severe hemorrhages in 4 quadrants
 *   - Venous beading in 2+ quadrants
 *   - IRMA in 1+ quadrant
 * - PDR: Neovascularization or vitreous/preretinal hemorrhage
 */
export function classifySeverity(lesions: LesionCounts): {
  severity: DRSeverityLevel;
  criteria: string[];
  confidence: 'low' | 'moderate' | 'high';
} {
  const criteria: string[] = [];
  let confidence: 'low' | 'moderate' | 'high' = 'moderate';

  // Proliferative DR - highest priority
  if (lesions.neovascularization > 0) {
    criteria.push(`Neovascularization detected (${lesions.neovascularization} areas)`);
    return {
      severity: 'pdr',
      criteria,
      confidence: 'high'
    };
  }

  // Check for severe NPDR indicators
  const hasSevereHemorrhages = lesions.hemorrhages >= 20; // Proxy for "4 quadrants"
  const hasSoftExudates = lesions.softExudates >= 3; // Cotton wool spots indicate severe

  if (hasSevereHemorrhages || hasSoftExudates) {
    if (hasSevereHemorrhages) {
      criteria.push(`Multiple hemorrhages detected (${lesions.hemorrhages})`);
    }
    if (hasSoftExudates) {
      criteria.push(`Cotton wool spots present (${lesions.softExudates})`);
    }
    criteria.push('Meets criteria for severe NPDR (4-2-1 rule indicators)');
    return {
      severity: 'severe_npdr',
      criteria,
      confidence: 'moderate'
    };
  }

  // Moderate NPDR
  const hasMultipleLesionTypes =
    (lesions.microaneurysms > 0 ? 1 : 0) +
    (lesions.hemorrhages > 0 ? 1 : 0) +
    (lesions.hardExudates > 0 ? 1 : 0) +
    (lesions.softExudates > 0 ? 1 : 0) >= 2;

  const hasModerateFindings =
    lesions.microaneurysms >= 5 ||
    lesions.hemorrhages >= 5 ||
    lesions.hardExudates >= 5;

  if (hasMultipleLesionTypes || hasModerateFindings) {
    if (lesions.microaneurysms > 0) {
      criteria.push(`Microaneurysms: ${lesions.microaneurysms}`);
    }
    if (lesions.hemorrhages > 0) {
      criteria.push(`Hemorrhages: ${lesions.hemorrhages}`);
    }
    if (lesions.hardExudates > 0) {
      criteria.push(`Hard exudates: ${lesions.hardExudates}`);
    }
    criteria.push('Multiple lesion types present');
    return {
      severity: 'moderate_npdr',
      criteria,
      confidence: 'moderate'
    };
  }

  // Mild NPDR
  if (lesions.microaneurysms > 0) {
    criteria.push(`Only microaneurysms detected (${lesions.microaneurysms})`);
    return {
      severity: 'mild_npdr',
      criteria,
      confidence: 'high'
    };
  }

  // No DR
  criteria.push('No retinopathy lesions detected');
  return {
    severity: 'no_dr',
    criteria,
    confidence: 'high'
  };
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

  // Based on severity
  switch (classification.severity) {
    case 'pdr':
      recommendations.push('URGENT: Immediate referral to retina specialist required');
      recommendations.push('Consider pan-retinal photocoagulation (PRP)');
      recommendations.push('Follow-up within 2-4 weeks');
      break;

    case 'severe_npdr':
      recommendations.push('Urgent referral to retina specialist');
      recommendations.push('Follow-up within 1-2 months');
      recommendations.push('Consider PRP or anti-VEGF therapy');
      break;

    case 'moderate_npdr':
      recommendations.push('Refer to ophthalmologist');
      recommendations.push('Follow-up every 3-6 months');
      recommendations.push('Optimize glycemic control');
      break;

    case 'mild_npdr':
      recommendations.push('Annual dilated eye examination');
      recommendations.push('Monitor blood glucose levels');
      recommendations.push('Continue diabetes management');
      break;

    case 'no_dr':
      recommendations.push('Annual screening recommended');
      recommendations.push('Maintain good glycemic control');
      break;
  }

  // Risk factor based recommendations
  if (riskFactors.hypertension) {
    recommendations.push('Blood pressure control is essential');
  }

  if (riskFactors.dyslipidemia) {
    recommendations.push('Lipid management recommended');
  }

  if (riskFactors.diabetesDuration === 'high') {
    recommendations.push('Long diabetes duration increases progression risk');
  }

  if (riskFactors.type1Diabetes) {
    recommendations.push('Type 1 diabetes requires vigilant monitoring');
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

  // Check for missing eyes
  if (!detectionsByEye.has('OD')) {
    warnings.push('Right eye (OD) data not available');
  }
  if (!detectionsByEye.has('OI')) {
    warnings.push('Left eye (OI) data not available');
  }

  // AI limitations disclaimer
  warnings.push('This is an AI-assisted suggestion, not a definitive diagnosis');
  warnings.push('Clinical correlation and expert review required');
  warnings.push('Quadrant-based analysis (4-2-1 rule) is approximated');

  return warnings;
}

/**
 * Main classification function
 */
export function classifyDiabeticRetinopathy(
  detectionsByEye: Map<'OD' | 'OI', Detection[]>,
  patient: Patient
): DRClassification {
  const riskFactors = assessRiskFactors(patient);
  const clinicalNotes: string[] = [];

  // Classify each eye
  const eyeClassifications: EyeClassification[] = [];

  for (const [eye, detections] of detectionsByEye) {
    const lesions = countLesions(detections);
    const { severity, criteria, confidence } = classifySeverity(lesions);

    eyeClassifications.push({
      eye,
      severity,
      lesions,
      criteria,
      confidence
    });
  }

  // Determine overall severity (worst eye determines overall)
  const severityOrder: DRSeverityLevel[] = ['no_dr', 'mild_npdr', 'moderate_npdr', 'severe_npdr', 'pdr'];
  const worstSeverity = eyeClassifications.reduce((worst, current) => {
    return severityOrder.indexOf(current.severity) > severityOrder.indexOf(worst)
      ? current.severity
      : worst;
  }, 'no_dr' as DRSeverityLevel);

  // Generate recommendations
  const recommendations = new Set<string>();
  eyeClassifications.forEach(eyeClass => {
    generateRecommendations(eyeClass, riskFactors).forEach(rec =>
      recommendations.add(rec)
    );
  });

  // Clinical notes
  if (patient.diabetes) {
    clinicalNotes.push(`Patient has diabetes (${patient.diabetesType || 'type unknown'})`);
    if (patient.diabetesDuration) {
      clinicalNotes.push(`Diabetes duration: ${patient.diabetesDuration} years`);
    }
  }

  if (patient.medications && patient.medications.length > 0) {
    clinicalNotes.push(`Current medications: ${patient.medications.join(', ')}`);
  }

  return {
    timestamp: new Date().toISOString(),
    overallSeverity: worstSeverity,
    rightEye: eyeClassifications.find(e => e.eye === 'OD'),
    leftEye: eyeClassifications.find(e => e.eye === 'OI'),
    riskFactors,
    recommendations: Array.from(recommendations),
    warnings: generateWarnings(detectionsByEye),
    clinicalNotes
  };
}

/**
 * Format classification result as human-readable text
 */
export function formatClassificationText(classification: DRClassification): string {
  const severityLabels: Record<DRSeverityLevel, string> = {
    'no_dr': 'Sin Retinopatía Diabética',
    'mild_npdr': 'Retinopatía Diabética No Proliferativa Leve',
    'moderate_npdr': 'Retinopatía Diabética No Proliferativa Moderada',
    'severe_npdr': 'Retinopatía Diabética No Proliferativa Severa',
    'pdr': 'Retinopatía Diabética Proliferativa'
  };

  let text = `CLASIFICACIÓN DE RETINOPATÍA DIABÉTICA\n`;
  text += `${'='.repeat(50)}\n\n`;
  text += `Severidad Global: ${severityLabels[classification.overallSeverity]}\n\n`;

  if (classification.rightEye) {
    text += `Ojo Derecho (OD): ${severityLabels[classification.rightEye.severity]}\n`;
    text += `  Confianza: ${classification.rightEye.confidence}\n`;
    text += `  Criterios:\n`;
    classification.rightEye.criteria.forEach(c => text += `    - ${c}\n`);
    text += `\n`;
  }

  if (classification.leftEye) {
    text += `Ojo Izquierdo (OI): ${severityLabels[classification.leftEye.severity]}\n`;
    text += `  Confianza: ${classification.leftEye.confidence}\n`;
    text += `  Criterios:\n`;
    classification.leftEye.criteria.forEach(c => text += `    - ${c}\n`);
    text += `\n`;
  }

  text += `Recomendaciones:\n`;
  classification.recommendations.forEach(r => text += `  - ${r}\n`);

  text += `\nAdvertencias:\n`;
  classification.warnings.forEach(w => text += `  - ${w}\n`);

  return text;
}
