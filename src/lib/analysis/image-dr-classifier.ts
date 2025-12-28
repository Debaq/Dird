/**
 * Image-based DR Classifier
 * Classifies diabetic retinopathy PER IMAGE (not per session)
 * Integrates with quadrant system and auto-detects eye type
 * Now supports multi-guideline classification system
 */

import { Detection } from '../db/schema';
import { quadrantCalculator, type QuadrantAnalysis } from './quadrant-calculator';
import { classifyWithGuideline } from '../clinical-guidelines/multi-guideline-classifier';
import type { LesionCounts as GuidelineLesionCounts } from '@/types/clinical-guidelines';

export type DRSeverityLevel =
  | 'no_dr'
  | 'mild_npdr'
  | 'moderate_npdr'
  | 'severe_npdr'
  | 'pdr';

export type EyeType = 'OD' | 'OI' | 'unknown';

export interface LesionCounts {
  microaneurysms: number;
  hemorrhages: number;
  hardExudates: number;
  softExudates: number;
  neovascularization: number;
}

export interface QuadrantLesionCounts {
  'superior-temporal': LesionCounts;
  'inferior-temporal': LesionCounts;
  'superior-nasal': LesionCounts;
  'inferior-nasal': LesionCounts;
}

export interface ImageDRClassification {
  imageId: number;
  eyeType: EyeType;
  eyeTypeDetectionMethod: 'manual' | 'auto' | 'unknown';
  severity: string; // Changed to string to support multiple guidelines
  severityLabel?: string; // Human-readable severity label
  severityOrder?: number; // Numeric order for comparison
  severityColor?: string; // Color for UI display
  confidence: 'low' | 'moderate' | 'high';
  lesions: LesionCounts;
  quadrantAnalysis: QuadrantAnalysis;
  quadrantLesions: QuadrantLesionCounts;
  criteria: string[];
  usedQuadrantAnalysis: boolean;
  warnings: string[];

  // Clinical Guideline Integration
  guideline?: string; // ID of guideline used
  guidelineName?: string; // Name of guideline
  guidelineVersion?: string; // Version of guideline
  treatments?: string[]; // Recommended treatment actions
  followupDays?: number; // Days until recommended follow-up
  urgency?: 'routine' | 'accelerated' | 'urgent'; // Treatment urgency
  rationale?: string; // Clinical rationale for classification
  rule421CriteriaMet?: number; // Number of 4-2-1 criteria met

  // Manual modification tracking
  manuallyModified?: boolean; // True if user manually modified the AI classification

  timestamp: string;
}

/**
 * Class name mappings
 */
const CLASS_MAPPINGS: Record<string, keyof LesionCounts | null> = {
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
 * Normalize class name
 */
function normalizeClassName(className: string): keyof LesionCounts | null {
  return CLASS_MAPPINGS[className.toLowerCase().trim()] || null;
}

/**
 * Detect eye type based on optic disc and fovea positions
 * @returns 'OD' if fovea is to the right of disc, 'OI' if to the left, 'unknown' if can't determine
 */
export function detectEyeType(detections: Detection[]): {
  eyeType: EyeType;
  method: 'auto' | 'unknown';
} {
  // Find optic disc and fovea
  const opticDisc = detections.find(d =>
    ['optic_disc', 'optic disc'].includes(d.class.toLowerCase().trim())
  );
  const fovea = detections.find(d =>
    d.class.toLowerCase().trim() === 'fovea'
  );

  if (!opticDisc || !fovea) {
    return { eyeType: 'unknown', method: 'unknown' };
  }

  // Get centers
  const discCenterX = opticDisc.bbox.x + opticDisc.bbox.width / 2;
  const foveaCenterX = fovea.bbox.x + fovea.bbox.width / 2;

  // Anatomía: Disco óptico es NASAL (hacia la nariz), Fóvea es TEMPORAL (hacia la sien)
  // En imágenes de fondo de ojo estándar:
  // OJO DERECHO (OD): Disco a la DERECHA de la imagen, Fóvea a la IZQUIERDA → discX > foveaX
  // OJO IZQUIERDO (OI): Disco a la IZQUIERDA de la imagen, Fóvea a la DERECHA → discX < foveaX
  const eyeType: EyeType = discCenterX > foveaCenterX ? 'OD' : 'OI';

  return { eyeType, method: 'auto' };
}

/**
 * Count lesions by type
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
    const lesionType = normalizeClassName(detection.class);
    if (lesionType && lesionType in counts) {
      counts[lesionType]++;
    }
  });

  return counts;
}

/**
 * Count lesions by quadrant
 */
export function countLesionsByQuadrant(
  detections: Detection[],
  _quadrantAnalysis: QuadrantAnalysis
): QuadrantLesionCounts {
  const quadrantLesions: QuadrantLesionCounts = {
    'superior-temporal': { microaneurysms: 0, hemorrhages: 0, hardExudates: 0, softExudates: 0, neovascularization: 0 },
    'inferior-temporal': { microaneurysms: 0, hemorrhages: 0, hardExudates: 0, softExudates: 0, neovascularization: 0 },
    'superior-nasal': { microaneurysms: 0, hemorrhages: 0, hardExudates: 0, softExudates: 0, neovascularization: 0 },
    'inferior-nasal': { microaneurysms: 0, hemorrhages: 0, hardExudates: 0, softExudates: 0, neovascularization: 0 }
  };

  // Find optic disc and fovea
  const opticDisc = detections.find(d =>
    ['optic_disc', 'optic disc'].includes(d.class.toLowerCase().trim())
  );
  const fovea = detections.find(d =>
    d.class.toLowerCase().trim() === 'fovea'
  );

  if (!opticDisc || !fovea) {
    // Can't do quadrant analysis without landmarks
    return quadrantLesions;
  }

  // Get optic disc center
  const odCenter = {
    x: opticDisc.bbox.x + opticDisc.bbox.width / 2,
    y: opticDisc.bbox.y + opticDisc.bbox.height / 2
  };

  // Get fovea center
  const foveaCenter = {
    x: fovea.bbox.x + fovea.bbox.width / 2,
    y: fovea.bbox.y + fovea.bbox.height / 2
  };

  // Calculate eye rotation
  const dx = foveaCenter.x - odCenter.x;
  const dy = foveaCenter.y - odCenter.y;
  const eyeRotation = Math.atan2(dy, dx);

  // Process each lesion
  for (const detection of detections) {
    const detClass = detection.class.toLowerCase().trim();
    if (detClass === 'optic_disc' || detClass === 'optic disc' || detClass === 'fovea') {
      continue;
    }

    const lesionType = normalizeClassName(detection.class);
    if (!lesionType) continue;

    // Get lesion center
    const lesionCenter = {
      x: detection.bbox.x + detection.bbox.width / 2,
      y: detection.bbox.y + detection.bbox.height / 2
    };

    // Calculate angle
    const lesionDx = lesionCenter.x - odCenter.x;
    const lesionDy = lesionCenter.y - odCenter.y;
    const lesionAngle = Math.atan2(lesionDy, lesionDx);

    // Normalize
    let normalizedAngle = lesionAngle - eyeRotation;
    while (normalizedAngle > Math.PI) normalizedAngle -= 2 * Math.PI;
    while (normalizedAngle < -Math.PI) normalizedAngle += 2 * Math.PI;

    // Determine quadrant
    const PI_2 = Math.PI / 2;
    let quadrant: keyof QuadrantLesionCounts;
    if (normalizedAngle >= 0 && normalizedAngle < PI_2) {
      quadrant = 'superior-temporal';
    } else if (normalizedAngle >= PI_2 && normalizedAngle <= Math.PI) {
      quadrant = 'superior-nasal';
    } else if (normalizedAngle < 0 && normalizedAngle >= -PI_2) {
      quadrant = 'inferior-temporal';
    } else {
      quadrant = 'inferior-nasal';
    }

    quadrantLesions[quadrant][lesionType]++;
  }

  return quadrantLesions;
}


/**
 * Main classification function for a single image
 * Now uses multi-guideline classification system
 */
export async function classifyImageDR(
  imageId: number,
  detections: Detection[],
  imageWidth: number,
  imageHeight: number,
  manualEyeType?: 'OD' | 'OI',
  guidelineId?: string // Optional guideline ID, defaults to active guideline from config
): Promise<ImageDRClassification> {
  const warnings: string[] = [];

  // Determine eye type - ALWAYS try auto-detection first
  let eyeType: EyeType;
  let eyeTypeDetectionMethod: 'manual' | 'auto' | 'unknown';

  // Step 1: Try auto-detection
  const autoDetection = detectEyeType(detections);

  if (autoDetection.eyeType !== 'unknown') {
    // Auto-detection succeeded
    eyeType = autoDetection.eyeType;
    eyeTypeDetectionMethod = 'auto';
  } else {
    // Auto-detection failed, use manual if available
    if (manualEyeType) {
      eyeType = manualEyeType;
      eyeTypeDetectionMethod = 'manual';
      warnings.push('Could not auto-detect eye type (OD/OI). Using manual classification.');
    } else {
      eyeType = 'unknown';
      eyeTypeDetectionMethod = 'unknown';
      warnings.push('Could not auto-detect eye type (OD/OI). Optic disc or fovea not found.');
    }
  }

  // Count lesions
  const lesions = countLesions(detections);

  // Quadrant analysis
  const quadrantAnalysis = quadrantCalculator.analyzeQuadrants(detections, imageWidth, imageHeight);

  // Count lesions by quadrant
  const quadrantLesions = countLesionsByQuadrant(detections, quadrantAnalysis);

  // Determine confidence based on quadrant analysis quality
  let baseConfidence: 'low' | 'moderate' | 'high' = 'moderate';
  if (quadrantAnalysis.usedFallback) {
    baseConfidence = 'low';
  } else if (quadrantAnalysis.opticDiscFound && quadrantAnalysis.foveaFound) {
    baseConfidence = 'high';
  }

  // Use guideline ID or fallback to default 'icdr_2024'
  const activeGuidelineId = guidelineId || 'icdr_2024';

  // Convert lesions to guideline format
  const guidelineLesions: GuidelineLesionCounts = {
    microaneurysms: lesions.microaneurysms,
    hemorrhages: lesions.hemorrhages,
    hardExudates: lesions.hardExudates,
    softExudates: lesions.softExudates,
    neovascularization: lesions.neovascularization,
    total_lesions: Object.values(lesions).reduce((sum, val) => sum + val, 0),
    lesion_types_count: Object.values(lesions).filter(val => val > 0).length,
  };

  // Convert quadrant lesions to guideline format (if available)
  const guidelineQuadrantLesions = quadrantAnalysis.opticDiscFound && quadrantAnalysis.foveaFound
    ? quadrantLesions
    : undefined;

  // Classify using guideline
  let guidelineResult;
  try {
    guidelineResult = await classifyWithGuideline(
      activeGuidelineId,
      guidelineLesions,
      guidelineQuadrantLesions,
      baseConfidence
    );
  } catch (error) {
    console.error('Error classifying with guideline:', error);
    // Fallback removed to prevent bad clinical decisions
    throw new Error(`Guideline classification error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Build criteria from guideline result and quadrant analysis
  const criteria: string[] = [];

  if (guidelineResult.rule_421_details && guidelineResult.rule_421_details.length > 0) {
    criteria.push(...guidelineResult.rule_421_details);
  }

  if (lesions.neovascularization > 0) {
    criteria.push(`Neovascularization detected (${lesions.neovascularization} areas)`);
  }
  if (lesions.hemorrhages > 0) {
    criteria.push(`Hemorrhages: ${lesions.hemorrhages}`);
  }
  if (lesions.microaneurysms > 0) {
    criteria.push(`Microaneurysms: ${lesions.microaneurysms}`);
  }
  if (lesions.hardExudates > 0) {
    criteria.push(`Hard exudates: ${lesions.hardExudates}`);
  }
  if (lesions.softExudates > 0) {
    criteria.push(`Cotton wool spots: ${lesions.softExudates}`);
  }

  // Add warnings from guideline classification
  warnings.push(...guidelineResult.warnings);

  // Add standard warnings
  if (!quadrantAnalysis.opticDiscFound) {
    warnings.push('Optic disc not detected - quadrant-based 4-2-1 rule cannot be applied accurately');
  }
  if (!quadrantAnalysis.foveaFound) {
    warnings.push('Fovea not detected - quadrant-based 4-2-1 rule cannot be applied accurately');
  }
  if (quadrantAnalysis.usedFallback) {
    warnings.push('Using fallback quadrant analysis (simple center-based division)');
  }

  const usedQuadrantAnalysis = quadrantAnalysis.opticDiscFound &&
                                quadrantAnalysis.foveaFound &&
                                !quadrantAnalysis.usedFallback;

  return {
    imageId,
    eyeType,
    eyeTypeDetectionMethod,
    severity: guidelineResult.severity,
    severityLabel: guidelineResult.severity_label,
    severityOrder: guidelineResult.severity_order,
    severityColor: guidelineResult.severity_color,
    confidence: guidelineResult.confidence,
    lesions,
    quadrantAnalysis,
    quadrantLesions,
    criteria,
    usedQuadrantAnalysis,
    warnings,

    // Guideline information
    guideline: guidelineResult.guideline_id,
    guidelineName: guidelineResult.guideline_name,
    guidelineVersion: guidelineResult.guideline_version,
    treatments: guidelineResult.actions,
    followupDays: guidelineResult.followup_days,
    urgency: guidelineResult.urgency,
    rationale: guidelineResult.rationale,
    rule421CriteriaMet: guidelineResult.rule_421_criteria_met,

    timestamp: new Date().toISOString()
  };
}
