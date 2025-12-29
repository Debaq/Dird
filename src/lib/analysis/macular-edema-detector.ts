/**
 * Macular Edema Detector
 *
 * Detects macular edema using hard exudates pattern analysis
 * Implements EMCS (Clinically Significant Macular Edema) and ETDRS criteria
 *
 * Key insight: Hard exudates forming a circinate pattern around the fovea
 * are a reliable indicator of macular edema, especially when direct
 * edema detection is challenging.
 */

import type { Detection } from '@/lib/db/schema';
import {
  type SpatialCalibration,
  type Point,
  getDetectionCenter,
  calculateMinimumDetectionDistanceToPoint,
  isCalibrationReliable
} from './spatial-calibrator';
import { classManager } from '@/lib/classes/class-manager';

// ============================================================================
// Types
// ============================================================================

/**
 * Macular edema detection criteria from clinical guideline
 * Each guideline can define its own method and thresholds
 */
export interface MacularEdemaCriteria {
  /** Enable macular edema detection */
  enabled: boolean;

  /** Detection method identifier (e.g., "emcs", "etdrs", "custom") */
  method: string;

  /** Maximum distance from fovea for hard exudates (in micrometers) */
  hard_exudates_distance_um: number;

  /** Minimum number of hard exudates required to flag edema */
  min_exudates_for_flag?: number;

  /** Enable circinate pattern detection */
  circinate_pattern_detection?: boolean;

  /** Minimum angular dispersion (0-1) to consider circinate pattern */
  min_angular_dispersion?: number;

  /** Visual zones configuration for display */
  visual_zones?: {
    show_foveal_zone: boolean;
    foveal_zone_radius_um: number;
    show_disc_diameter_zone?: boolean;
  };
}

/**
 * Result of macular edema detection
 */
export interface MacularEdemaResult {
  /** Was macular edema detected? */
  detected: boolean;

  /** Method used for detection */
  method: string;

  /** Hard exudates within the criteria distance */
  exudatesInZone: Detection[];

  /** Distance from each exudate to fovea (in micrometers) */
  distancesToFoveaUm: number[];

  /** Does the pattern form a circinate ring? */
  circinatePattern: boolean;

  /** Angular dispersion of exudates (0-1, higher = more dispersed around fovea) */
  angularDispersion?: number;

  /** Center point of fovea used for analysis */
  foveaCenter: Point;

  /** Calibration used for measurements */
  calibration: SpatialCalibration;

  /** Warnings generated during detection */
  warnings: string[];

  /** Descriptive message for clinical report */
  clinicalDescription?: string;
}

// ============================================================================
// Hard Exudate Detection
// ============================================================================

/**
 * Find all hard exudate detections
 * Uses class manager normalization to ensure all hard exudate variants are captured
 * This works for AI detections, manual annotations, and custom classes
 *
 * @param detections - All detections from image
 * @returns Array of hard exudate detections
 */
export function findHardExudates(detections: Detection[]): Detection[] {
  return detections.filter(d => {
    if (!d.class || typeof d.class !== 'string') {
      return false;
    }

    // Normalize the class name to technical name using classManager
    // This handles AI classes, aliases, and custom translations
    const normalizedName = classManager.normalizeName(d.class);

    // Check if normalized name is hard_exudate
    if (normalizedName === 'hard_exudate') {
      return true;
    }

    // Fallback to string matching for custom classes that don't normalize
    // This ensures backward compatibility with manually created classes
    const className = d.class.toLowerCase().trim();

    // Direct name matching (most common cases)
    if (['hard_exudate', 'hard exudate', 'hardexudate', 'exudate', 'hard-exudate'].includes(className)) {
      return true;
    }

    // Check if it contains 'exudate' or 'exudado' (Spanish)
    if (className.includes('exudat') || className.includes('exudado')) {
      // Exclude soft exudates / cotton wool spots
      if (className.includes('soft') || className.includes('cotton') || className.includes('algod')) {
        return false;
      }
      return true;
    }

    return false;
  });
}

/**
 * Find fovea detection
 * Uses class manager normalization to handle all fovea variants
 *
 * @param detections - All detections from image
 * @returns Fovea detection or null if not found
 */
export function findFovea(detections: Detection[]): Detection | null {
  return detections.find(d => {
    if (!d.class || typeof d.class !== 'string') {
      return false;
    }

    // Normalize the class name to technical name
    const normalizedName = classManager.normalizeName(d.class);
    if (normalizedName === 'fovea') {
      return true;
    }

    // Fallback to direct string matching
    return d.class.toLowerCase().trim() === 'fovea';
  }) || null;
}

// ============================================================================
// Circinate Pattern Detection
// ============================================================================

/**
 * Calculate angular dispersion of exudates around fovea
 * Returns value between 0 and 1, where:
 * - 0 = all exudates in same direction
 * - 1 = exudates uniformly distributed in all directions (perfect circinate)
 *
 * @param exudates - Hard exudate detections
 * @param foveaCenter - Center point of fovea
 * @returns Angular dispersion score (0-1)
 */
export function calculateAngularDispersion(
  exudates: Detection[],
  foveaCenter: Point
): number {
  if (exudates.length < 2) {
    return 0;
  }

  // Calculate angle of each exudate relative to fovea
  const angles: number[] = exudates.map(exudate => {
    const center = getDetectionCenter(exudate);
    const dx = center.x - foveaCenter.x;
    const dy = center.y - foveaCenter.y;
    return Math.atan2(dy, dx); // Returns angle in radians [-π, π]
  });

  // Sort angles
  const sortedAngles = [...angles].sort((a, b) => a - b);

  // Calculate gaps between consecutive angles
  const gaps: number[] = [];
  for (let i = 0; i < sortedAngles.length; i++) {
    const current = sortedAngles[i];
    const next = sortedAngles[(i + 1) % sortedAngles.length];
    let gap = next - current;

    // Handle wrap-around at ±π
    if (i === sortedAngles.length - 1) {
      gap = (2 * Math.PI) - (current - sortedAngles[0]);
    }

    gaps.push(gap);
  }

  // Calculate standard deviation of gaps
  // More uniform distribution = lower std dev = higher dispersion score
  const meanGap = (2 * Math.PI) / sortedAngles.length;
  const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - meanGap, 2), 0) / gaps.length;
  const stdDev = Math.sqrt(variance);

  // Normalize to 0-1 range (empirically, stdDev < 0.5 indicates good dispersion)
  const maxExpectedStdDev = Math.PI / 2;
  const dispersion = Math.max(0, 1 - (stdDev / maxExpectedStdDev));

  return dispersion;
}

/**
 * Detect if hard exudates form a circinate pattern
 *
 * @param exudates - Hard exudate detections in zone
 * @param foveaCenter - Center point of fovea
 * @param minDispersion - Minimum dispersion to consider circinate (default: 0.5)
 * @returns true if circinate pattern detected
 */
export function detectCircinatePattern(
  exudates: Detection[],
  foveaCenter: Point,
  minDispersion: number = 0.5
): { isCircinate: boolean; dispersion: number } {
  if (exudates.length < 3) {
    // Need at least 3 exudates to form a ring pattern
    return { isCircinate: false, dispersion: 0 };
  }

  const dispersion = calculateAngularDispersion(exudates, foveaCenter);
  const isCircinate = dispersion >= minDispersion;

  return { isCircinate, dispersion };
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect macular edema using clinical guideline criteria
 *
 * @param detections - All detections from image
 * @param fovea - Fovea detection
 * @param calibration - Spatial calibration data
 * @param criteria - Macular edema criteria from clinical guideline
 * @returns Macular edema detection result
 */
export function detectMacularEdema(
  detections: Detection[],
  fovea: Detection,
  calibration: SpatialCalibration,
  criteria: MacularEdemaCriteria
): MacularEdemaResult {
  const warnings: string[] = [];

  // Add calibration warnings
  warnings.push(...calibration.warnings);

  // Check calibration reliability
  if (!isCalibrationReliable(calibration)) {
    warnings.push('Spatial calibration may be unreliable - distance measurements should be verified');
  }

  // Get fovea center
  const foveaCenter = getDetectionCenter(fovea);

  // Find all hard exudates
  const allHardExudates = findHardExudates(detections);

  if (allHardExudates.length === 0) {
    return {
      detected: false,
      method: criteria.method,
      exudatesInZone: [],
      distancesToFoveaUm: [],
      circinatePattern: false,
      foveaCenter,
      calibration,
      warnings,
      clinicalDescription: 'noneFound'
    };
  }

  // Calculate MINIMUM distances (closest point of bbox to fovea center)
  // This is the correct geometric calculation for EMCS criteria
  const exudatesWithDistances = allHardExudates.map(exudate => ({
    detection: exudate,
    distanceUm: calculateMinimumDetectionDistanceToPoint(exudate, foveaCenter, calibration)
  }));

  const exudatesInZone = exudatesWithDistances
    .filter(item => item.distanceUm <= criteria.hard_exudates_distance_um)
    .map(item => item.detection);

  const distancesToFoveaUm = exudatesWithDistances
    .filter(item => item.distanceUm <= criteria.hard_exudates_distance_um)
    .map(item => item.distanceUm);

  // Check minimum count threshold
  const minRequired = criteria.min_exudates_for_flag || 1;
  const hasEnoughExudates = exudatesInZone.length >= minRequired;

  // Detect circinate pattern if enabled
  let circinatePattern = false;
  let angularDispersion: number | undefined;

  if (criteria.circinate_pattern_detection && exudatesInZone.length > 0) {
    const minDispersion = criteria.min_angular_dispersion || 0.5;
    const circinateResult = detectCircinatePattern(exudatesInZone, foveaCenter, minDispersion);
    circinatePattern = circinateResult.isCircinate;
    angularDispersion = circinateResult.dispersion;

    if (circinatePattern) {
      warnings.push(`Circinate pattern detected (dispersion: ${(angularDispersion * 100).toFixed(0)}%)`);
    }
  }

  // Determine if macular edema is detected
  const detected = hasEnoughExudates;

  // Generate clinical description key/info
  let clinicalDescription = '';
  if (detected) {
    clinicalDescription = `detectedInZone|count:${exudatesInZone.length},pattern:${circinatePattern},distance:${criteria.hard_exudates_distance_um}`;
  } else if (exudatesInZone.length > 0 && exudatesInZone.length < minRequired) {
    clinicalDescription = `onlyFewInZone|count:${exudatesInZone.length},min:${minRequired}`;
  } else {
    clinicalDescription = 'noneInZone';
  }

  return {
    detected,
    method: criteria.method,
    exudatesInZone,
    distancesToFoveaUm,
    circinatePattern,
    angularDispersion,
    foveaCenter,
    calibration,
    warnings,
    clinicalDescription
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the closest hard exudate to fovea
 *
 * @param result - Macular edema detection result
 * @returns Distance in micrometers to closest exudate, or null if none
 */
export function getClosestExudateDistance(result: MacularEdemaResult): number | null {
  if (result.distancesToFoveaUm.length === 0) {
    return null;
  }
  return Math.min(...result.distancesToFoveaUm);
}

/**
 * Get the farthest hard exudate from fovea (within zone)
 *
 * @param result - Macular edema detection result
 * @returns Distance in micrometers to farthest exudate, or null if none
 */
export function getFarthestExudateDistance(result: MacularEdemaResult): number | null {
  if (result.distancesToFoveaUm.length === 0) {
    return null;
  }
  return Math.max(...result.distancesToFoveaUm);
}

/**
 * Format macular edema result for display
 *
 * @param result - Macular edema detection result
 * @returns Formatted string for UI display
 */
export function formatMacularEdemaResult(result: MacularEdemaResult): string {
  if (!result.detected) {
    return `${result.method}: Not detected`;
  }

  const parts = [
    `${result.method}: Detected`,
    result.clinicalDescription
  ];

  if (result.circinatePattern) {
    parts.push('(circinate pattern)');
  }

  return parts.join(' - ');
}