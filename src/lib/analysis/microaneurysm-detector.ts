/**
 * Microaneurysm Detector
 * 
 * Detects and analyzes retinal microaneurysms
 * Provides clinical information about microaneurysm density and distribution
 */

import type { Detection } from '@/lib/db/schema';
import { classManager } from '@/lib/classes/class-manager';
import type { SpatialCalibration } from './spatial-calibrator';

// ============================================================================
// Types
// ============================================================================

export interface MicroaneurysmAnalysis {
  /** Total number of microaneurysms detected */
  totalCount: number;

  /** Distribution description */
  distribution: 'scattered' | 'clustered' | 'diffuse';

  /** All microaneurysm detections */
  microaneurysms: Detection[];
}

// ============================================================================
// Microaneurysm Detection
// ============================================================================

/**
 * Find all microaneurysm detections
 * Uses class manager normalization
 */
export function findMicroaneurysms(detections: Detection[]): Detection[] {
  return detections.filter(d => {
    if (!d.class || typeof d.class !== 'string') {
      return false;
    }

    const normalizedName = classManager.normalizeName(d.class);
    
    if (normalizedName === 'microaneurysm') {
      return true;
    }

    const className = d.class.toLowerCase().trim();
    
    return ['microaneurysm', 'microaneurisma', 'ma'].some(term => 
      className.includes(term)
    );
  });
}

/**
 * Analyze distribution pattern
 */
function analyzeDistribution(microaneurysms: Detection[]): 'scattered' | 'clustered' | 'diffuse' {
  if (microaneurysms.length < 5) return 'scattered';
  if (microaneurysms.length > 20) return 'diffuse';
  return 'clustered';
}

/**
 * Analyze microaneurysms in the image
 */
export function analyzeMicroaneurysms(
  detections: Detection[],
  _calibration: SpatialCalibration
): MicroaneurysmAnalysis {
  const microaneurysms = findMicroaneurysms(detections);
  const totalCount = microaneurysms.length;
  const distribution = analyzeDistribution(microaneurysms);

  return {
    totalCount,
    distribution,
    microaneurysms,
  };
}
