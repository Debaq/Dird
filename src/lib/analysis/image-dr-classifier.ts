/**
 * Image-based DR Classifier
 * Classifies diabetic retinopathy PER IMAGE (not per session)
 * Integrates with quadrant system and auto-detects eye type
 * Now supports multi-guideline classification system
 */

import { Detection } from '../db/schema';
import { quadrantCalculator, type QuadrantAnalysis } from './quadrant-calculator';
import { classifyWithGuideline } from '../clinical-guidelines/multi-guideline-classifier';
import { classManager } from '../classes/class-manager';
import { calibrateFromOpticDisc, createFallbackCalibration, type SpatialCalibration } from './spatial-calibrator';
import { detectMacularEdema, findFovea, type MacularEdemaResult } from './macular-edema-detector';
import { loadGuideline } from '../clinical-guidelines/guideline-loader';

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

  // Macular edema detection
  macularEdema?: {
    detected: boolean;
    method: string;
    exudatesCount: number;
    circinatePattern: boolean;
    description: string;
    calibration: SpatialCalibration;
  };

  timestamp: string;
}

/**
 * Legacy mapping for backward compatibility with LesionCounts interface
 * Maps technical_names from model to LesionCounts keys
 *
 * IMPORTANT: Only map classes that are ACTUALLY detected by the current model
 * (currently_detected: true in model JSON)
 */
const TECHNICAL_NAME_TO_LESION_COUNTS: Record<string, keyof LesionCounts> = {
  // Classes currently detected by the model (DIRDv1r1)
  'microhemorrhages': 'microaneurysms', // Model detects microhemorrhages, map to microaneurysms for DR classification
  'hemorrhage': 'hemorrhages',
  'hard_exudate': 'hardExudates',
  'cotton_wool_spot': 'softExudates',
  'neovascularization': 'neovascularization',

  // Legacy classes (for backward compatibility, but NOT currently detected)
  'microaneurysm': 'microaneurysms',
};

/**
 * Normalize class name using classManager
 * Returns the technical_name from the model or null if not found
 */
function normalizeClassName(className: string): string | null {
  return classManager.normalizeName(className);
}

/**
 * Map technical_name to LesionCounts key
 * Used for backward compatibility with LesionCounts interface
 */
function mapToLesionCountsKey(technicalName: string): keyof LesionCounts | null {
  return TECHNICAL_NAME_TO_LESION_COUNTS[technicalName] || null;
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
    d.class && typeof d.class === 'string' && ['optic_disc', 'optic disc'].includes(d.class.toLowerCase().trim())
  );
  const fovea = detections.find(d =>
    d.class && typeof d.class === 'string' && d.class.toLowerCase().trim() === 'fovea'
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
 * Count lesions WITHOUT normalization - preserves original model class names
 * This allows the guideline's class_mapping to handle the mapping
 */
export function countRawLesions(detections: Detection[]): Record<string, number> {
  const counts: Record<string, number> = {};

  detections.forEach(detection => {
    // Skip if class is not defined
    if (!detection.class || typeof detection.class !== 'string') {
      console.warn('Detection without valid class property:', detection);
      return;
    }

    const className = detection.class.toLowerCase().trim();

    // Skip landmarks
    if (['optic_disc', 'optic disc', 'fovea', 'macula'].includes(className)) {
      return;
    }

    if (!counts[className]) {
      counts[className] = 0;
    }
    counts[className]++;
  });

  return counts;
}

/**
 * Count lesions by type (DEPRECATED - use countRawLesions + guideline mapping instead)
 * Kept for backwards compatibility
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
    // Skip if class is not defined
    if (!detection.class || typeof detection.class !== 'string') {
      return;
    }

    // Normalize to technical_name first
    const technicalName = normalizeClassName(detection.class);
    if (technicalName) {
      // Map technical_name to LesionCounts key
      const lesionType = mapToLesionCountsKey(technicalName);
      if (lesionType && lesionType in counts) {
        counts[lesionType]++;
      }
    }
  });

  return counts;
}

/**
 * Count lesions by quadrant WITHOUT normalization
 * Returns raw class names from the model
 */
export function countRawLesionsByQuadrant(
  detections: Detection[],
  _quadrantAnalysis: QuadrantAnalysis
): Record<string, Record<string, number>> {
  const quadrantLesions: Record<string, Record<string, number>> = {
    'superior-temporal': {},
    'inferior-temporal': {},
    'superior-nasal': {},
    'inferior-nasal': {}
  };

  // Find optic disc and fovea
  const opticDisc = detections.find(d =>
    d.class && typeof d.class === 'string' && ['optic_disc', 'optic disc'].includes(d.class.toLowerCase().trim())
  );
  const fovea = detections.find(d =>
    d.class && typeof d.class === 'string' && d.class.toLowerCase().trim() === 'fovea'
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
    // Skip if class is not defined
    if (!detection.class || typeof detection.class !== 'string') {
      continue;
    }

    const className = detection.class.toLowerCase().trim();

    // Skip landmarks
    if (['optic_disc', 'optic disc', 'fovea', 'macula'].includes(className)) {
      continue;
    }

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
    let quadrant: string;
    if (normalizedAngle >= 0 && normalizedAngle < PI_2) {
      quadrant = 'superior-temporal';
    } else if (normalizedAngle >= PI_2 && normalizedAngle <= Math.PI) {
      quadrant = 'superior-nasal';
    } else if (normalizedAngle < 0 && normalizedAngle >= -PI_2) {
      quadrant = 'inferior-temporal';
    } else {
      quadrant = 'inferior-nasal';
    }

    // Count
    if (!quadrantLesions[quadrant][className]) {
      quadrantLesions[quadrant][className] = 0;
    }
    quadrantLesions[quadrant][className]++;
  }

  return quadrantLesions;
}

/**
 * Count lesions by quadrant (DEPRECATED - use countRawLesionsByQuadrant + guideline mapping)
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
    d.class && typeof d.class === 'string' && ['optic_disc', 'optic disc'].includes(d.class.toLowerCase().trim())
  );
  const fovea = detections.find(d =>
    d.class && typeof d.class === 'string' && d.class.toLowerCase().trim() === 'fovea'
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
    // Skip if class is not defined
    if (!detection.class || typeof detection.class !== 'string') {
      continue;
    }

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

    const lesionTypeKey = mapToLesionCountsKey(lesionType);
    if (lesionTypeKey && lesionTypeKey in quadrantLesions[quadrant]) {
      (quadrantLesions[quadrant] as any)[lesionTypeKey]++;
    }
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

  // Count lesions WITHOUT normalization (let guideline mapping handle it)
  const rawLesions = countRawLesions(detections);

  // Quadrant analysis
  const quadrantAnalysis = quadrantCalculator.analyzeQuadrants(detections, imageWidth, imageHeight);

  // Count lesions by quadrant WITHOUT normalization
  const rawQuadrantLesions = countRawLesionsByQuadrant(detections, quadrantAnalysis);

  // Determine confidence based on quadrant analysis quality
  let baseConfidence: 'low' | 'moderate' | 'high' = 'moderate';
  if (quadrantAnalysis.usedFallback) {
    baseConfidence = 'low';
  } else if (quadrantAnalysis.opticDiscFound && quadrantAnalysis.foveaFound) {
    baseConfidence = 'high';
  }

  // Use guideline ID or fallback to default 'icdr_2024'
  const activeGuidelineId = guidelineId || 'icdr_2024';

  // Pass RAW lesions (guideline mapping will normalize them)
  // Add metadata fields that classifyWithGuideline expects
  const rawLesionsWithMeta: any = {
    ...rawLesions,
    total_lesions: Object.values(rawLesions).reduce((sum: number, val) => sum + (val as number), 0),
    lesion_types_count: Object.keys(rawLesions).filter(key => rawLesions[key] > 0).length,
  };

  // Pass RAW quadrant lesions (if available)
  const rawQuadrantLesionsOrUndefined = quadrantAnalysis.opticDiscFound && quadrantAnalysis.foveaFound
    ? rawQuadrantLesions
    : undefined;

  // Classify using guideline (will apply class_mapping internally)
  let guidelineResult;
  try {
    guidelineResult = await classifyWithGuideline(
      activeGuidelineId,
      rawLesionsWithMeta as any,
      rawQuadrantLesionsOrUndefined as any,
      baseConfidence
    );
  } catch (error) {
    console.error('Error classifying with guideline:', error);
    // Fallback removed to prevent bad clinical decisions
    throw new Error(`Guideline classification error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Build criteria from guideline result and raw lesions
  const criteria: string[] = [];

  if (guidelineResult.rule_421_details && guidelineResult.rule_421_details.length > 0) {
    criteria.push(...guidelineResult.rule_421_details);
  }

  // For criteria display, aggregate raw lesion counts by normalized type
  // This is just for human-readable output
  const totalByType: Record<string, number> = {};
  for (const [className, count] of Object.entries(rawLesions)) {
    // Normalize to technical_name
    const technicalName = normalizeClassName(className);
    if (technicalName) {
      // Map to LesionCounts key for display compatibility
      const displayType = mapToLesionCountsKey(technicalName) || technicalName;
      if (!totalByType[displayType]) {
        totalByType[displayType] = 0;
      }
      totalByType[displayType] += count;
    } else {
      // Unknown class, keep original name
      if (!totalByType[className]) {
        totalByType[className] = 0;
      }
      totalByType[className] += count;
    }
  }

  if (totalByType['neovascularization'] && totalByType['neovascularization'] > 0) {
    criteria.push(`Neovascularization detected (${totalByType['neovascularization']} areas)`);
  }
  if (totalByType['hemorrhages'] && totalByType['hemorrhages'] > 0) {
    criteria.push(`Hemorrhages: ${totalByType['hemorrhages']}`);
  }
  if (totalByType['microaneurysms'] && totalByType['microaneurysms'] > 0) {
    criteria.push(`Microaneurysms: ${totalByType['microaneurysms']}`);
  }
  if (totalByType['hardExudates'] && totalByType['hardExudates'] > 0) {
    criteria.push(`Hard exudates: ${totalByType['hardExudates']}`);
  }
  if (totalByType['softExudates'] && totalByType['softExudates'] > 0) {
    criteria.push(`Cotton wool spots: ${totalByType['softExudates']}`);
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

  // ============================================================================
  // Macular Edema Detection
  // ============================================================================

  let macularEdemaResult: MacularEdemaResult | null = null;
  let macularEdemaData: ImageDRClassification['macularEdema'] = undefined;

  try {
    // Load guideline to access macular_edema_criteria
    const guideline = await loadGuideline(activeGuidelineId);

    if (guideline.macular_edema_criteria?.enabled) {
      // Find fovea
      const fovea = findFovea(detections);

      if (fovea) {
        // Find optic disc for spatial calibration
        const opticDisc = detections.find(d =>
          d.class && typeof d.class === 'string' &&
          ['optic_disc', 'optic disc'].includes(d.class.toLowerCase().trim())
        );

        // Calibrate spatial measurements
        let calibration: SpatialCalibration;
        if (opticDisc) {
          calibration = calibrateFromOpticDisc(opticDisc);
          warnings.push(...calibration.warnings);
        } else {
          calibration = createFallbackCalibration();
          warnings.push(...calibration.warnings);
        }

        // Detect macular edema
        macularEdemaResult = detectMacularEdema(
          detections,
          fovea,
          calibration,
          guideline.macular_edema_criteria
        );

        // Add warnings from macular edema detection
        warnings.push(...macularEdemaResult.warnings);

        // Add to criteria if detected
        if (macularEdemaResult.detected) {
          const emcsWarning = `⚠️ ${macularEdemaResult.method} DETECTADO: ${macularEdemaResult.clinicalDescription}`;
          criteria.unshift(emcsWarning);

          // Add specific warning about vision threat
          warnings.unshift(`🔴 AMENAZA A LA VISIÓN: ${macularEdemaResult.method} detectado - Requiere evaluación oftalmológica urgente`);

          console.log(`[DR Classifier] ${macularEdemaResult.method} detected:`, {
            exudatesCount: macularEdemaResult.exudatesInZone.length,
            circinatePattern: macularEdemaResult.circinatePattern,
            description: macularEdemaResult.clinicalDescription
          });
        }

        // Build macularEdemaData for result
        macularEdemaData = {
          detected: macularEdemaResult.detected,
          method: macularEdemaResult.method,
          exudatesCount: macularEdemaResult.exudatesInZone.length,
          circinatePattern: macularEdemaResult.circinatePattern,
          description: macularEdemaResult.clinicalDescription || '',
          calibration: macularEdemaResult.calibration
        };
      } else {
        warnings.push('Fovea not detected - macular edema analysis cannot be performed');
      }
    }
  } catch (error) {
    console.error('Error detecting macular edema:', error);
    warnings.push('Macular edema detection failed - analysis incomplete');
  }

  // Create normalized lesion counts for storage (using old normalizer for backwards compat)
  const normalizedLesions: LesionCounts = {
    microaneurysms: totalByType['microaneurysms'] || 0,
    hemorrhages: totalByType['hemorrhages'] || 0,
    hardExudates: totalByType['hardExudates'] || 0,
    softExudates: totalByType['softExudates'] || 0,
    neovascularization: totalByType['neovascularization'] || 0
  };

  // Create normalized quadrant lesions for storage
  const normalizedQuadrantLesions: QuadrantLesionCounts = {
    'superior-temporal': { microaneurysms: 0, hemorrhages: 0, hardExudates: 0, softExudates: 0, neovascularization: 0 },
    'inferior-temporal': { microaneurysms: 0, hemorrhages: 0, hardExudates: 0, softExudates: 0, neovascularization: 0 },
    'superior-nasal': { microaneurysms: 0, hemorrhages: 0, hardExudates: 0, softExudates: 0, neovascularization: 0 },
    'inferior-nasal': { microaneurysms: 0, hemorrhages: 0, hardExudates: 0, softExudates: 0, neovascularization: 0 }
  };

  // Normalize quadrant lesions
  for (const [quadrant, rawCounts] of Object.entries(rawQuadrantLesions)) {
    for (const [className, count] of Object.entries(rawCounts)) {
      const technicalName = normalizeClassName(className);
      if (technicalName) {
        const lesionTypeKey = mapToLesionCountsKey(technicalName);
        if (lesionTypeKey && lesionTypeKey in normalizedQuadrantLesions[quadrant as keyof QuadrantLesionCounts]) {
          (normalizedQuadrantLesions[quadrant as keyof QuadrantLesionCounts] as any)[lesionTypeKey] += count;
        }
      }
    }
  }

  return {
    imageId,
    eyeType,
    eyeTypeDetectionMethod,
    severity: guidelineResult.severity,
    severityLabel: guidelineResult.severity_label,
    severityOrder: guidelineResult.severity_order,
    severityColor: guidelineResult.severity_color,
    confidence: guidelineResult.confidence,
    lesions: normalizedLesions,
    quadrantAnalysis,
    quadrantLesions: normalizedQuadrantLesions,
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

    // Macular edema detection
    macularEdema: macularEdemaData,

    timestamp: new Date().toISOString()
  };
}
