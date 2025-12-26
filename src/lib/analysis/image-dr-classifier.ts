/**
 * Image-based DR Classifier
 * Classifies diabetic retinopathy PER IMAGE (not per session)
 * Integrates with quadrant system and auto-detects eye type
 */

import { Detection } from '../db/schema';
import { quadrantCalculator, type QuadrantAnalysis } from './quadrant-calculator';

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
  severity: DRSeverityLevel;
  confidence: 'low' | 'moderate' | 'high';
  lesions: LesionCounts;
  quadrantAnalysis: QuadrantAnalysis;
  quadrantLesions: QuadrantLesionCounts;
  criteria: string[];
  usedQuadrantAnalysis: boolean;
  warnings: string[];
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
 * Apply 4-2-1 rule for severe NPDR using quadrant analysis
 */
function checkSevereNPDR_421Rule(
  quadrantLesions: QuadrantLesionCounts,
  _quadrantAnalysis: QuadrantAnalysis
): { isSevere: boolean; criteria: string[] } {
  const criteria: string[] = [];

  // Count quadrants with severe hemorrhages/microaneurysms
  // Severe = >= 5 hemorrhages OR >= 10 microaneurysms in a quadrant
  const quadrantsWithSevereHemorrhages = Object.entries(quadrantLesions).filter(([_, counts]) => {
    return counts.hemorrhages >= 5 || counts.microaneurysms >= 10;
  }).length;

  // Check 4-2-1 rule criteria
  if (quadrantsWithSevereHemorrhages >= 4) {
    criteria.push(`Severe hemorrhages/microaneurysms in ${quadrantsWithSevereHemorrhages} quadrants (4-2-1 rule: criterion 1)`);
    return { isSevere: true, criteria };
  }

  // Note: Venous beading and IRMA would be checked here when those classes are available
  // For now, we approximate with soft exudates (cotton wool spots) which indicate ischemia
  const quadrantsWithIschemia = Object.entries(quadrantLesions).filter(([_, counts]) => {
    return counts.softExudates >= 2;
  }).length;

  if (quadrantsWithIschemia >= 2) {
    criteria.push(`Signs of ischemia (cotton wool spots) in ${quadrantsWithIschemia} quadrants (approximates venous beading criterion)`);
    return { isSevere: true, criteria };
  }

  return { isSevere: false, criteria: [] };
}

/**
 * Classify severity for a single image
 */
export function classifySeverity(
  lesions: LesionCounts,
  quadrantAnalysis: QuadrantAnalysis,
  quadrantLesions: QuadrantLesionCounts
): {
  severity: DRSeverityLevel;
  criteria: string[];
  confidence: 'low' | 'moderate' | 'high';
  usedQuadrantAnalysis: boolean;
} {
  const criteria: string[] = [];
  let usedQuadrantAnalysis = false;

  // PDR - Highest priority
  if (lesions.neovascularization > 0) {
    criteria.push(`Neovascularization detected (${lesions.neovascularization} areas)`);
    return {
      severity: 'pdr',
      criteria,
      confidence: 'high',
      usedQuadrantAnalysis: false
    };
  }

  // Severe NPDR - Use quadrant analysis if available
  if (quadrantAnalysis.opticDiscFound && quadrantAnalysis.foveaFound && !quadrantAnalysis.usedFallback) {
    usedQuadrantAnalysis = true;
    const { isSevere, criteria: severeCriteria } = checkSevereNPDR_421Rule(quadrantLesions, quadrantAnalysis);

    if (isSevere) {
      criteria.push(...severeCriteria);
      return {
        severity: 'severe_npdr',
        criteria,
        confidence: 'moderate',
        usedQuadrantAnalysis: true
      };
    }
  } else {
    // Fallback: use total counts (less accurate)
    const hasSevereHemorrhages = lesions.hemorrhages >= 20;
    const hasSoftExudates = lesions.softExudates >= 3;

    if (hasSevereHemorrhages || hasSoftExudates) {
      if (hasSevereHemorrhages) {
        criteria.push(`Multiple hemorrhages detected (${lesions.hemorrhages})`);
      }
      if (hasSoftExudates) {
        criteria.push(`Cotton wool spots present (${lesions.softExudates})`);
      }
      criteria.push('Approximated severe NPDR (quadrant analysis not available)');
      return {
        severity: 'severe_npdr',
        criteria,
        confidence: 'low',
        usedQuadrantAnalysis: false
      };
    }
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
    if (lesions.microaneurysms > 0) criteria.push(`Microaneurysms: ${lesions.microaneurysms}`);
    if (lesions.hemorrhages > 0) criteria.push(`Hemorrhages: ${lesions.hemorrhages}`);
    if (lesions.hardExudates > 0) criteria.push(`Hard exudates: ${lesions.hardExudates}`);
    criteria.push('Multiple lesion types present');
    return {
      severity: 'moderate_npdr',
      criteria,
      confidence: 'moderate',
      usedQuadrantAnalysis
    };
  }

  // Mild NPDR
  if (lesions.microaneurysms > 0) {
    criteria.push(`Only microaneurysms detected (${lesions.microaneurysms})`);
    return {
      severity: 'mild_npdr',
      criteria,
      confidence: 'high',
      usedQuadrantAnalysis
    };
  }

  // No DR
  criteria.push('No retinopathy lesions detected');
  return {
    severity: 'no_dr',
    criteria,
    confidence: 'high',
    usedQuadrantAnalysis
  };
}

/**
 * Main classification function for a single image
 */
export async function classifyImageDR(
  imageId: number,
  detections: Detection[],
  imageWidth: number,
  imageHeight: number,
  manualEyeType?: 'OD' | 'OI'
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

  // Classify severity
  const { severity, criteria, confidence, usedQuadrantAnalysis } = classifySeverity(
    lesions,
    quadrantAnalysis,
    quadrantLesions
  );

  // Add warnings
  if (!quadrantAnalysis.opticDiscFound) {
    warnings.push('Optic disc not detected - quadrant-based 4-2-1 rule cannot be applied accurately');
  }
  if (!quadrantAnalysis.foveaFound) {
    warnings.push('Fovea not detected - quadrant-based 4-2-1 rule cannot be applied accurately');
  }
  if (quadrantAnalysis.usedFallback) {
    warnings.push('Using fallback quadrant analysis (simple center-based division)');
  }

  return {
    imageId,
    eyeType,
    eyeTypeDetectionMethod,
    severity,
    confidence,
    lesions,
    quadrantAnalysis,
    quadrantLesions,
    criteria,
    usedQuadrantAnalysis,
    warnings,
    timestamp: new Date().toISOString()
  };
}
