/**
 * Hemorrhage Detector
 * 
 * Detects and analyzes retinal hemorrhages
 * Provides clinical information about hemorrhage severity and distribution
 */

import type { Detection } from '@/lib/db/schema';
import { classManager } from '@/lib/classes/class-manager';
import type { SpatialCalibration } from './spatial-calibrator';

// ============================================================================
// Types
// ============================================================================

export interface HemorrhageAnalysis {
  /** Total number of hemorrhages detected */
  totalCount: number;

  /** Distribution by quadrant */
  byQuadrant: {
    superior: number;
    inferior: number;
    nasal: number;
    temporal: number;
  };

  /** All hemorrhage detections */
  hemorrhages: Detection[];
}

// ============================================================================
// Hemorrhage Detection
// ============================================================================

/**
 * Find all hemorrhage detections
 * Uses class manager normalization
 */
export function findHemorrhages(detections: Detection[]): Detection[] {
  return detections.filter(d => {
    if (!d.class || typeof d.class !== 'string') {
      return false;
    }

    const normalizedName = classManager.normalizeName(d.class);
    
    if (normalizedName === 'hemorrhage') {
      return true;
    }

    const className = d.class.toLowerCase().trim();
    
    return ['hemorrhage', 'hemorragia', 'bleeding'].some(term => 
      className.includes(term)
    );
  });
}

/**
 * Determine quadrant for a detection
 * Simplified quadrant assignment based on center position
 */
function getQuadrant(detection: Detection, imageWidth: number, imageHeight: number): 
  'superior' | 'inferior' | 'nasal' | 'temporal' {
  const centerX = detection.bbox.x + detection.bbox.width / 2;
  const centerY = detection.bbox.y + detection.bbox.height / 2;
  
  const midX = imageWidth / 2;
  const midY = imageHeight / 2;
  
  const isUpper = centerY < midY;
  const isLeft = centerX < midX;
  
  // Simplified quadrant assignment
  // This should ideally use optic disc position for proper orientation
  if (isUpper && isLeft) return 'superior';
  if (isUpper && !isLeft) return 'temporal';
  if (!isUpper && isLeft) return 'nasal';
  return 'inferior';
}

/**
 * Analyze hemorrhages in the image
 */
export function analyzeHemorrhages(
  detections: Detection[],
  _calibration: SpatialCalibration,
  imageWidth: number = 1000,
  imageHeight: number = 1000
): HemorrhageAnalysis {
  const hemorrhages = findHemorrhages(detections);
  const totalCount = hemorrhages.length;
  
  // Count by quadrant
  const byQuadrant = {
    superior: 0,
    inferior: 0,
    nasal: 0,
    temporal: 0,
  };
  
  hemorrhages.forEach(h => {
    const quadrant = getQuadrant(h, imageWidth, imageHeight);
    byQuadrant[quadrant]++;
  });

  return {
    totalCount,
    byQuadrant,
    hemorrhages,
  };
}
