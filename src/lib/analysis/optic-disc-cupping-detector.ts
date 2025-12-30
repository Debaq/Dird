/**
 * Optic Disc Cupping Detector
 *
 * Analyzes optic disc and cup to measure excavation (cupping)
 * Calculates cup/disc ratio and rim distances
 */

import type { Detection } from '@/lib/db/schema';
import { classManager } from '@/lib/classes/class-manager';
import type { SpatialCalibration } from './spatial-calibrator';

// ============================================================================
// Types
// ============================================================================

export interface OpticDiscCuppingAnalysis {
  /** Cup to disc ratio (vertical) */
  cupDiscRatioVertical: number | null;

  /** Cup to disc ratio (horizontal) */
  cupDiscRatioHorizontal: number | null;

  /** Average cup/disc ratio */
  cupDiscRatioAverage: number | null;

  /** Rim distances in pixels */
  rimDistances: {
    superior: number | null;
    inferior: number | null;
    nasal: number | null;
    temporal: number | null;
  };

  /** Rim distances in micrometers (calibrated) */
  rimDistancesMicrometers: {
    superior: number | null;
    inferior: number | null;
    nasal: number | null;
    temporal: number | null;
  };

  /** Disc detection */
  disc: Detection | null;

  /** Cup detection */
  cup: Detection | null;
}

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Find optic disc detection
 * Uses class manager normalization
 */
export function findOpticDisc(detections: Detection[]): Detection | null {
  const disc = detections.find(d => {
    if (!d.class || typeof d.class !== 'string') {
      return false;
    }

    const normalizedName = classManager.normalizeName(d.class);

    // Check normalized name first (most reliable)
    if (normalizedName === 'optic_disc' || normalizedName === 'disc') {
      return true;
    }

    // Fallback: Direct string matching for backward compatibility
    const className = d.class.toLowerCase().trim();
    return ['optic disc', 'optic_disc', 'disc', 'disco optico', 'disco óptico', 'disco'].some(term =>
      className === term || className.includes(term)
    );
  });

  return disc || null;
}

/**
 * Find optic cup detection
 * Uses class manager normalization
 */
export function findOpticCup(detections: Detection[]): Detection | null {
  const cup = detections.find(d => {
    if (!d.class || typeof d.class !== 'string') {
      return false;
    }

    const normalizedName = classManager.normalizeName(d.class);

    // Check normalized name first (most reliable)
    if (normalizedName === 'optic_cup' || normalizedName === 'cup') {
      return true;
    }

    // Fallback: Direct string matching for backward compatibility
    const className = d.class.toLowerCase().trim();
    return ['optic cup', 'optic_cup', 'cup', 'excavacion', 'excavación', 'copa', 'copa optica', 'copa óptica'].some(term =>
      className === term || className.includes(term)
    );
  });

  return cup || null;
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Calculate cup to disc ratio
 * Uses vertical and horizontal measurements
 */
function calculateCupDiscRatio(
  cup: Detection,
  disc: Detection
): { vertical: number; horizontal: number; average: number } {
  // Vertical ratio
  const cupHeight = cup.bbox.height;
  const discHeight = disc.bbox.height;
  const verticalRatio = cupHeight / discHeight;

  // Horizontal ratio
  const cupWidth = cup.bbox.width;
  const discWidth = disc.bbox.width;
  const horizontalRatio = cupWidth / discWidth;

  // Average
  const average = (verticalRatio + horizontalRatio) / 2;

  return {
    vertical: verticalRatio,
    horizontal: horizontalRatio,
    average
  };
}

/**
 * Calculate rim distances (disc edge to cup edge)
 * in pixels
 *
 * Uses precise disc points if available, otherwise falls back to bbox
 */
function calculateRimDistances(
  cup: Detection,
  disc: Detection
): {
  superior: number;
  inferior: number;
  nasal: number;
  temporal: number;
} {
  // Calculate cup center
  const cupCenterX = cup.bbox.x + cup.bbox.width / 2;
  const cupCenterY = cup.bbox.y + cup.bbox.height / 2;
  const cupHalfWidth = cup.bbox.width / 2;
  const cupHalfHeight = cup.bbox.height / 2;

  // Check if disc has precise points
  const precisePoints = disc.metadata?.precisePoints as {
    superior: { x: number; y: number };
    inferior: { x: number; y: number };
    nasal: { x: number; y: number };
    temporal: { x: number; y: number };
  } | undefined;

  if (precisePoints) {
    // Calculate distances from cup edges to precise disc points
    const cupTop = cupCenterY - cupHalfHeight;
    const cupBottom = cupCenterY + cupHalfHeight;
    const cupLeft = cupCenterX - cupHalfWidth;
    const cupRight = cupCenterX + cupHalfWidth;

    return {
      superior: Math.abs(precisePoints.superior.y - cupTop),
      inferior: Math.abs(precisePoints.inferior.y - cupBottom),
      nasal: Math.abs(precisePoints.nasal.x - cupRight), // Assuming nasal is on right
      temporal: Math.abs(precisePoints.temporal.x - cupLeft), // Assuming temporal is on left
    };
  } else {

    // Fallback to bbox-based calculation
    const discCenterX = disc.bbox.x + disc.bbox.width / 2;
    const discCenterY = disc.bbox.y + disc.bbox.height / 2;
    const discHalfWidth = disc.bbox.width / 2;
    const discHalfHeight = disc.bbox.height / 2;

    // Superior rim (top edge)
    const superior = Math.abs(
      (discCenterY - discHalfHeight) - (cupCenterY - cupHalfHeight)
    );

    // Inferior rim (bottom edge)
    const inferior = Math.abs(
      (discCenterY + discHalfHeight) - (cupCenterY + cupHalfHeight)
    );

    // Nasal rim (left edge - assuming standard orientation)
    const nasal = Math.abs(
      (discCenterX - discHalfWidth) - (cupCenterX - cupHalfWidth)
    );

    // Temporal rim (right edge)
    const temporal = Math.abs(
      (discCenterX + discHalfWidth) - (cupCenterX + cupHalfWidth)
    );

    return {
      superior,
      inferior,
      nasal,
      temporal
    };
  }
}

/**
 * Analyze optic disc cupping
 */
export function analyzeOpticDiscCupping(
  detections: Detection[],
  calibration: SpatialCalibration
): OpticDiscCuppingAnalysis {
  const disc = findOpticDisc(detections);
  const cup = findOpticCup(detections);

  // If we don't have both disc and cup, return empty analysis
  if (!disc || !cup) {
    return {
      cupDiscRatioVertical: null,
      cupDiscRatioHorizontal: null,
      cupDiscRatioAverage: null,
      rimDistances: {
        superior: null,
        inferior: null,
        nasal: null,
        temporal: null
      },
      rimDistancesMicrometers: {
        superior: null,
        inferior: null,
        nasal: null,
        temporal: null
      },
      disc: disc || null,
      cup: cup || null
    };
  }

  // Calculate ratios
  const ratios = calculateCupDiscRatio(cup, disc);

  // Calculate rim distances in pixels
  const rimDistances = calculateRimDistances(cup, disc);

  // Convert rim distances to micrometers using calibration
  const rimDistancesMicrometers = {
    superior: rimDistances.superior * calibration.micronsPerPixel,
    inferior: rimDistances.inferior * calibration.micronsPerPixel,
    nasal: rimDistances.nasal * calibration.micronsPerPixel,
    temporal: rimDistances.temporal * calibration.micronsPerPixel,
  };

  return {
    cupDiscRatioVertical: ratios.vertical,
    cupDiscRatioHorizontal: ratios.horizontal,
    cupDiscRatioAverage: ratios.average,
    rimDistances,
    rimDistancesMicrometers,
    disc,
    cup
  };
}
