/**
 * Spatial Calibrator
 *
 * Converts pixel measurements to micrometers (μm) using optic disc as reference
 * Essential for EMCS/ETDRS criteria that define distances in microns
 *
 * Standard reference: Optic disc diameter ≈ 1500 μm (ETDRS)
 */

import type { Detection } from '@/lib/db/schema';

// ============================================================================
// Constants
// ============================================================================

/**
 * Standard optic disc diameter in micrometers
 * Reference: ETDRS (Early Treatment Diabetic Retinopathy Study)
 */
export const STANDARD_OPTIC_DISC_DIAMETER_UM = 1500;

/**
 * Fallback calibration when optic disc is not detected
 * Assumes typical retinal photograph scale (45° field of view)
 * This is a rough estimate and should trigger warnings
 */
export const FALLBACK_MICRONS_PER_PIXEL = 10;

// ============================================================================
// Types
// ============================================================================

export interface SpatialCalibration {
  /** Conversion factor: micrometers per pixel */
  micronsPerPixel: number;

  /** Optic disc diameter in pixels (used for calibration) */
  opticDiscDiameterPixels: number;

  /** Optic disc diameter in micrometers (standard reference) */
  opticDiscDiameterMicrons: number;

  /** How calibration was performed */
  calibrationMethod: 'optic_disc' | 'fallback';

  /** Center point of optic disc in pixels */
  opticDiscCenter?: { x: number; y: number };

  /** Warnings generated during calibration */
  warnings: string[];
}

export interface Point {
  x: number;
  y: number;
}

// ============================================================================
// Calibration Functions
// ============================================================================

/**
 * Calibrate spatial measurements using optic disc as reference
 *
 * @param opticDisc - Detection of optic disc
 * @param opticDiscDiameterUm - Reference diameter in micrometers (default: 1500 μm)
 * @returns Spatial calibration data
 */
export function calibrateFromOpticDisc(
  opticDisc: Detection,
  opticDiscDiameterUm: number = STANDARD_OPTIC_DISC_DIAMETER_UM
): SpatialCalibration {
  const warnings: string[] = [];

  // Calculate optic disc diameter in pixels
  // Use average of width and height for better accuracy
  const avgDiameterPixels = (opticDisc.bbox.width + opticDisc.bbox.height) / 2;

  // Validate reasonable size
  if (avgDiameterPixels < 10) {
    warnings.push('Optic disc detection very small - calibration may be inaccurate');
  }
  if (avgDiameterPixels > 500) {
    warnings.push('Optic disc detection very large - calibration may be inaccurate');
  }

  // Calculate conversion factor
  const micronsPerPixel = opticDiscDiameterUm / avgDiameterPixels;

  // Calculate center
  const center = {
    x: opticDisc.bbox.x + opticDisc.bbox.width / 2,
    y: opticDisc.bbox.y + opticDisc.bbox.height / 2
  };

  return {
    micronsPerPixel,
    opticDiscDiameterPixels: avgDiameterPixels,
    opticDiscDiameterMicrons: opticDiscDiameterUm,
    calibrationMethod: 'optic_disc',
    opticDiscCenter: center,
    warnings
  };
}

/**
 * Create fallback calibration when optic disc is not available
 * Uses estimated average scale - LESS ACCURATE
 *
 * @returns Fallback spatial calibration with warnings
 */
export function createFallbackCalibration(): SpatialCalibration {
  return {
    micronsPerPixel: FALLBACK_MICRONS_PER_PIXEL,
    opticDiscDiameterPixels: STANDARD_OPTIC_DISC_DIAMETER_UM / FALLBACK_MICRONS_PER_PIXEL,
    opticDiscDiameterMicrons: STANDARD_OPTIC_DISC_DIAMETER_UM,
    calibrationMethod: 'fallback',
    warnings: [
      'Optic disc not detected - using fallback calibration',
      'Distance measurements may be significantly inaccurate'
    ]
  };
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert distance from pixels to micrometers
 *
 * @param pixels - Distance in pixels
 * @param calibration - Spatial calibration data
 * @returns Distance in micrometers
 */
export function pixelsToMicrons(
  pixels: number,
  calibration: SpatialCalibration
): number {
  return pixels * calibration.micronsPerPixel;
}

/**
 * Convert distance from micrometers to pixels
 *
 * @param microns - Distance in micrometers
 * @param calibration - Spatial calibration data
 * @returns Distance in pixels
 */
export function micronsToPixels(
  microns: number,
  calibration: SpatialCalibration
): number {
  return microns / calibration.micronsPerPixel;
}

// ============================================================================
// Distance Calculation Functions
// ============================================================================

/**
 * Calculate Euclidean distance between two points in pixels
 *
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Distance in pixels
 */
export function calculateDistancePixels(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate distance between two points in micrometers
 *
 * @param p1 - First point
 * @param p2 - Second point
 * @param calibration - Spatial calibration data
 * @returns Distance in micrometers
 */
export function calculateDistanceMicrons(
  p1: Point,
  p2: Point,
  calibration: SpatialCalibration
): number {
  const distancePixels = calculateDistancePixels(p1, p2);
  return pixelsToMicrons(distancePixels, calibration);
}

/**
 * Get center point of a detection bounding box
 *
 * @param detection - Detection with bbox
 * @returns Center point
 */
export function getDetectionCenter(detection: Detection): Point {
  return {
    x: detection.bbox.x + detection.bbox.width / 2,
    y: detection.bbox.y + detection.bbox.height / 2
  };
}

/**
 * Calculate distance from a detection to a point in micrometers
 * USES CENTER-TO-CENTER DISTANCE (legacy behavior)
 *
 * @param detection - Detection to measure from
 * @param point - Target point
 * @param calibration - Spatial calibration data
 * @returns Distance in micrometers
 * @deprecated Use calculateMinimumDetectionDistanceToPoint for EMCS criteria
 */
export function calculateDetectionDistanceToPoint(
  detection: Detection,
  point: Point,
  calibration: SpatialCalibration
): number {
  const center = getDetectionCenter(detection);
  return calculateDistanceMicrons(center, point, calibration);
}

/**
 * Calculate MINIMUM distance from any point of a detection bbox to a target point
 * This is the correct method for EMCS/ETDRS criteria
 *
 * Returns 0 if the point is inside the bbox
 *
 * @param detection - Detection with bbox
 * @param point - Target point (e.g., fovea center)
 * @param calibration - Spatial calibration data
 * @returns Minimum distance in micrometers
 */
export function calculateMinimumDetectionDistanceToPoint(
  detection: Detection,
  point: Point,
  calibration: SpatialCalibration
): number {
  const bbox = detection.bbox;

  // Check if point is inside the bbox
  if (
    point.x >= bbox.x &&
    point.x <= bbox.x + bbox.width &&
    point.y >= bbox.y &&
    point.y <= bbox.y + bbox.height
  ) {
    return 0; // Point is inside the detection
  }

  // Find closest point on bbox to target point
  const closestX = Math.max(bbox.x, Math.min(point.x, bbox.x + bbox.width));
  const closestY = Math.max(bbox.y, Math.min(point.y, bbox.y + bbox.height));

  const closestPoint: Point = { x: closestX, y: closestY };

  // Calculate distance from closest point to target
  return calculateDistanceMicrons(closestPoint, point, calibration);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate disc diameters (DD) from micrometers
 * Useful for ETDRS criteria that reference distances in disc diameters
 *
 * @param microns - Distance in micrometers
 * @param calibration - Spatial calibration data
 * @returns Distance in disc diameters
 */
export function micronsToDiscDiameters(
  microns: number,
  calibration: SpatialCalibration
): number {
  return microns / calibration.opticDiscDiameterMicrons;
}

/**
 * Convert disc diameters to micrometers
 *
 * @param discDiameters - Distance in disc diameters
 * @param calibration - Spatial calibration data
 * @returns Distance in micrometers
 */
export function discDiametersToMicrons(
  discDiameters: number,
  calibration: SpatialCalibration
): number {
  return discDiameters * calibration.opticDiscDiameterMicrons;
}

/**
 * Check if calibration is reliable for clinical use
 *
 * @param calibration - Spatial calibration to validate
 * @returns true if calibration is reliable
 */
export function isCalibrationReliable(calibration: SpatialCalibration): boolean {
  if (calibration.calibrationMethod === 'fallback') {
    return false;
  }

  // Check if optic disc size is reasonable (50-300 pixels typical for fundus photos)
  if (calibration.opticDiscDiameterPixels < 30 || calibration.opticDiscDiameterPixels > 400) {
    return false;
  }

  // Check if conversion factor is reasonable (2-30 μm/px typical)
  if (calibration.micronsPerPixel < 1 || calibration.micronsPerPixel > 50) {
    return false;
  }

  return true;
}
