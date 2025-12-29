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
 * Detailed circinate pattern analysis
 */
export interface CircinatePatternAnalysis {
  /** Overall circinate score (0-1) combining all metrics */
  overallScore: number;

  /** Angular dispersion (0-1, higher = more uniform distribution) */
  angularDispersion: number;

  /** Radial concentration (0-1, higher = exudates at similar distance) */
  radialConcentration: number;

  /** Circle fit quality (0-1, higher = points follow a circle) */
  circleFitQuality: number;

  /** Pattern completeness (0-1, higher = no large gaps) */
  completeness: number;

  /** Largest angular gap in degrees */
  maxAngularGapDegrees: number;

  /** Is this a complete ring? (completeness > threshold) */
  isCompleteRing: boolean;

  /** Is this a partial/incomplete ring? (has pattern but gaps exist) */
  isPartialRing: boolean;

  /** Fitted circle parameters */
  fittedCircle?: {
    center: Point;
    radius: number;
    radiusMicrons: number;
    meanFitError: number;
  };

  /** Radial distance statistics (in micrometers) */
  radialStats?: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    coefficientOfVariation: number;
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

  /** Detailed circinate pattern analysis (if enabled) */
  circinateAnalysis?: CircinatePatternAnalysis;

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
// Circinate Pattern Detection - Advanced Analysis
// ============================================================================

/**
 * Calculate radial concentration of exudates
 * Measures how consistently exudates are positioned at similar distances from fovea
 *
 * Returns 0-1 where:
 * - 1 = all exudates at exactly same distance (perfect ring)
 * - 0 = exudates at very different distances (scattered)
 *
 * @param distances - Array of distances in micrometers
 * @returns Radial concentration score (0-1)
 */
export function calculateRadialConcentration(distances: number[]): {
  concentration: number;
  mean: number;
  stdDev: number;
  coefficientOfVariation: number;
} {
  if (distances.length === 0) {
    return { concentration: 0, mean: 0, stdDev: 0, coefficientOfVariation: 0 };
  }

  if (distances.length === 1) {
    return { concentration: 1, mean: distances[0], stdDev: 0, coefficientOfVariation: 0 };
  }

  // Calculate mean distance
  const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;

  // Calculate standard deviation
  const variance = distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / distances.length;
  const stdDev = Math.sqrt(variance);

  // Coefficient of variation (CV) = stdDev / mean
  // CV represents relative variability
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;

  // Convert CV to concentration score (0-1)
  // CV < 0.15 = excellent concentration (score ~1)
  // CV > 0.5 = poor concentration (score ~0)
  const concentration = Math.max(0, Math.min(1, 1 - (coefficientOfVariation / 0.5)));

  return {
    concentration,
    mean,
    stdDev,
    coefficientOfVariation
  };
}

/**
 * Analyze angular gaps between exudates
 * Detects large gaps that indicate incomplete rings
 *
 * @param angles - Sorted array of angles in radians
 * @returns Gap analysis including max gap and completeness score
 */
export function calculateAngularGaps(angles: number[]): {
  gaps: number[];
  maxGapRadians: number;
  maxGapDegrees: number;
  completeness: number;
  isComplete: boolean;
} {
  if (angles.length < 2) {
    return {
      gaps: [],
      maxGapRadians: 0,
      maxGapDegrees: 0,
      completeness: 0,
      isComplete: false
    };
  }

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

    gaps.push(Math.abs(gap));
  }

  // Find maximum gap
  const maxGapRadians = Math.max(...gaps);
  const maxGapDegrees = (maxGapRadians * 180) / Math.PI;

  // Calculate completeness score based on max gap
  // Gaps < 60° = complete ring (score ~1)
  // Gaps > 120° = incomplete ring (score ~0)
  const maxAcceptableGapRadians = (120 * Math.PI) / 180; // 120 degrees
  const completeness = Math.max(0, Math.min(1, 1 - (maxGapRadians / maxAcceptableGapRadians)));

  // Consider complete if max gap < 90 degrees
  const completeThresholdDegrees = 90;
  const isComplete = maxGapDegrees < completeThresholdDegrees;

  return {
    gaps,
    maxGapRadians,
    maxGapDegrees,
    completeness,
    isComplete
  };
}

/**
 * Fit a circle to points using least squares method
 * Uses algebraic circle fitting (Kasa method)
 *
 * @param points - Array of points to fit
 * @returns Fitted circle parameters and quality metrics
 */
export function fitCircleToPoints(points: Point[]): {
  center: Point;
  radius: number;
  meanError: number;
  maxError: number;
  fitQuality: number;
} | null {
  if (points.length < 3) {
    return null;
  }

  // Kasa method: algebraic circle fitting
  // Fits equation: (x - cx)^2 + (y - cy)^2 = r^2

  const n = points.length;
  let sumX = 0, sumY = 0;
  let sumX2 = 0, sumY2 = 0;
  let sumX3 = 0, sumY3 = 0;
  let sumXY = 0, sumX2Y = 0, sumXY2 = 0;

  for (const p of points) {
    const x = p.x;
    const y = p.y;
    const x2 = x * x;
    const y2 = y * y;

    sumX += x;
    sumY += y;
    sumX2 += x2;
    sumY2 += y2;
    sumX3 += x2 * x;
    sumY3 += y2 * y;
    sumXY += x * y;
    sumX2Y += x2 * y;
    sumXY2 += x * y2;
  }

  // Build linear system: A * [cx, cy] = B
  const A = (n * sumX2) - (sumX * sumX);
  const B = (n * sumXY) - (sumX * sumY);
  const C = (n * sumY2) - (sumY * sumY);
  const D = 0.5 * ((n * sumX3) - (sumX * sumX2) + (n * sumXY2) - (sumX * sumY2));
  const E = 0.5 * ((n * sumX2Y) - (sumY * sumX2) + (n * sumY3) - (sumY * sumY2));

  const denominator = (A * C) - (B * B);

  if (Math.abs(denominator) < 1e-10) {
    // Points are collinear or degenerate
    return null;
  }

  // Solve for center
  const cx = ((D * C) - (B * E)) / denominator;
  const cy = ((A * E) - (B * D)) / denominator;

  // Calculate radius
  const sumR2 = points.reduce((sum, p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return sum + (dx * dx + dy * dy);
  }, 0);

  const radius = Math.sqrt(sumR2 / n);

  // Calculate fit errors (residuals)
  const errors = points.map(p => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const distToCenter = Math.sqrt(dx * dx + dy * dy);
    return Math.abs(distToCenter - radius);
  });

  const meanError = errors.reduce((sum, e) => sum + e, 0) / errors.length;
  const maxError = Math.max(...errors);

  // Calculate fit quality (0-1)
  // Quality decreases with mean error relative to radius
  // meanError/radius < 0.1 = excellent (score ~1)
  // meanError/radius > 0.3 = poor (score ~0)
  const relativeError = meanError / radius;
  const fitQuality = Math.max(0, Math.min(1, 1 - (relativeError / 0.3)));

  return {
    center: { x: cx, y: cy },
    radius,
    meanError,
    maxError,
    fitQuality
  };
}

/**
 * Comprehensive circinate pattern analysis
 * Combines multiple metrics to detect both complete and partial rings
 *
 * @param exudates - Hard exudate detections
 * @param foveaCenter - Center point of fovea
 * @param calibration - Spatial calibration for distance conversion
 * @returns Detailed circinate pattern analysis
 */
export function analyzeCircinatePattern(
  exudates: Detection[],
  foveaCenter: Point,
  calibration: SpatialCalibration
): CircinatePatternAnalysis | null {
  if (exudates.length < 3) {
    return null;
  }

  // Calculate angles for each exudate
  const angles = exudates.map(exudate => {
    const center = getDetectionCenter(exudate);
    const dx = center.x - foveaCenter.x;
    const dy = center.y - foveaCenter.y;
    return Math.atan2(dy, dx);
  });

  // Calculate distances from fovea (in micrometers)
  const distances = exudates.map(exudate =>
    calculateMinimumDetectionDistanceToPoint(exudate, foveaCenter, calibration)
  );

  // Get exudate centers for circle fitting
  const centers = exudates.map(e => getDetectionCenter(e));

  // 1. Angular dispersion (existing metric)
  const angularDispersion = calculateAngularDispersion(exudates, foveaCenter);

  // 2. Radial concentration (NEW)
  const radialAnalysis = calculateRadialConcentration(distances);

  // 3. Angular gaps analysis (NEW - improved)
  const gapAnalysis = calculateAngularGaps(angles);

  // 4. Circle fitting (NEW)
  const circleFit = fitCircleToPoints(centers);

  // Calculate overall circinate score
  // Weighted combination of all metrics
  const weights = {
    angularDispersion: 0.30,    // Distribution around fovea
    radialConcentration: 0.25,   // Consistency of distance
    completeness: 0.25,          // No large gaps
    circleFitQuality: 0.20       // Geometric fit
  };

  const circleFitQuality = circleFit ? circleFit.fitQuality : 0;

  const overallScore =
    (angularDispersion * weights.angularDispersion) +
    (radialAnalysis.concentration * weights.radialConcentration) +
    (gapAnalysis.completeness * weights.completeness) +
    (circleFitQuality * weights.circleFitQuality);

  // Determine if complete or partial ring
  // Complete ring: high score AND no large gaps
  const isCompleteRing = overallScore >= 0.7 && gapAnalysis.isComplete;

  // Partial ring: decent score but has gaps, OR good individual metrics
  const isPartialRing = !isCompleteRing && (
    (overallScore >= 0.4 && overallScore < 0.7) ||
    (angularDispersion >= 0.5 && radialAnalysis.concentration >= 0.6) ||
    (gapAnalysis.completeness >= 0.5)
  );

  return {
    overallScore,
    angularDispersion,
    radialConcentration: radialAnalysis.concentration,
    circleFitQuality,
    completeness: gapAnalysis.completeness,
    maxAngularGapDegrees: gapAnalysis.maxGapDegrees,
    isCompleteRing,
    isPartialRing,
    fittedCircle: circleFit ? {
      center: circleFit.center,
      radius: circleFit.radius,
      radiusMicrons: circleFit.radius * calibration.micronsPerPixel,
      meanFitError: circleFit.meanError
    } : undefined,
    radialStats: {
      mean: radialAnalysis.mean,
      stdDev: radialAnalysis.stdDev,
      min: Math.min(...distances),
      max: Math.max(...distances),
      coefficientOfVariation: radialAnalysis.coefficientOfVariation
    }
  };
}

// ============================================================================
// Circinate Pattern Detection - Legacy Functions
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
      circinateAnalysis: undefined,
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
  let circinateAnalysis: CircinatePatternAnalysis | undefined;

  if (criteria.circinate_pattern_detection && exudatesInZone.length > 0) {
    // Use advanced analysis if enough exudates
    if (exudatesInZone.length >= 3) {
      circinateAnalysis = analyzeCircinatePattern(exudatesInZone, foveaCenter, calibration) || undefined;

      if (circinateAnalysis) {
        angularDispersion = circinateAnalysis.angularDispersion;

        // Detect circinate pattern using comprehensive analysis
        // Accept both complete and partial rings
        circinatePattern = circinateAnalysis.isCompleteRing || circinateAnalysis.isPartialRing;

        if (circinateAnalysis.isCompleteRing) {
          warnings.push(
            `Complete circinate ring detected (score: ${(circinateAnalysis.overallScore * 100).toFixed(0)}%)`
          );
        } else if (circinateAnalysis.isPartialRing) {
          warnings.push(
            `Partial circinate pattern detected (score: ${(circinateAnalysis.overallScore * 100).toFixed(0)}%, max gap: ${circinateAnalysis.maxAngularGapDegrees.toFixed(0)}°)`
          );
        }
      }
    } else {
      // Fallback to simple dispersion for < 3 exudates
      const minDispersion = criteria.min_angular_dispersion || 0.5;
      const circinateResult = detectCircinatePattern(exudatesInZone, foveaCenter, minDispersion);
      circinatePattern = circinateResult.isCircinate;
      angularDispersion = circinateResult.dispersion;

      if (circinatePattern) {
        warnings.push(`Circinate pattern detected (dispersion: ${(angularDispersion * 100).toFixed(0)}%)`);
      }
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
    circinateAnalysis,
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