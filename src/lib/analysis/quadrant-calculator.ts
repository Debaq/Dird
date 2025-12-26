/**
 * Generic Detection interface compatible with both DB schema and ONNX manager
 */
export interface Detection {
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  class: string;
}

/**
 * Quadrant types based on retinal anatomy
 * - ST: Superior Temporal (upper right from optic disc)
 * - IT: Inferior Temporal (lower right from optic disc)
 * - SN: Superior Nasal (upper left from optic disc)
 * - IN: Inferior Nasal (lower left from optic disc)
 */
export type QuadrantType = 'superior-temporal' | 'inferior-temporal' | 'superior-nasal' | 'inferior-nasal';

export interface QuadrantAnalysis {
  'superior-temporal': number;
  'inferior-temporal': number;
  'superior-nasal': number;
  'inferior-nasal': number;
  total: number;
  usedFallback: boolean;
  opticDiscFound: boolean;
  foveaFound: boolean;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * QuadrantCalculator
 *
 * Implements geometric vectorial logic to classify retinal lesions into anatomical quadrants
 * based on the optic disc and fovea positions.
 *
 * Algorithm:
 * 1. Find optic disc (OD) and fovea in detections
 * 2. If both exist:
 *    - Set OD center as origin (0,0)
 *    - Calculate vector from OD to fovea (defines temporal axis, 0 degrees)
 *    - For each lesion: calculate angle relative to OD, normalize by eye rotation
 * 3. If missing OD or fovea: use fallback (simple image center division)
 * 4. Classify lesions into quadrants based on normalized angle
 */
export class QuadrantCalculator {
  /**
   * Analyze detections and classify lesions by quadrant
   */
  analyzeQuadrants(detections: Detection[], imageWidth: number, imageHeight: number): QuadrantAnalysis {
    const analysis: QuadrantAnalysis = {
      'superior-temporal': 0,
      'inferior-temporal': 0,
      'superior-nasal': 0,
      'inferior-nasal': 0,
      total: 0,
      usedFallback: false,
      opticDiscFound: false,
      foveaFound: false,
    };

    // Step 1: Find optic disc and fovea
    const opticDisc = this.findDetection(detections, ['optic_disc', 'optic disc']);
    const fovea = this.findDetection(detections, ['fovea']);

    analysis.opticDiscFound = opticDisc !== null;
    analysis.foveaFound = fovea !== null;

    // Step 2: Check if we can use anatomical reference
    if (opticDisc && fovea) {
      // Use anatomical quadrant analysis
      this.analyzeWithAnatomicalReference(detections, opticDisc, fovea, analysis);
    } else {
      // Step 2 (fallback): Use simple center-based division
      analysis.usedFallback = true;
      this.analyzeWithFallback(detections, imageWidth, imageHeight, analysis);
    }

    return analysis;
  }

  /**
   * Find first detection matching any of the given class names
   */
  private findDetection(detections: Detection[], classNames: string[]): Detection | null {
    const normalizedNames = classNames.map(name => name.toLowerCase().trim());

    return detections.find(detection =>
      normalizedNames.includes(detection.class.toLowerCase().trim())
    ) || null;
  }

  /**
   * Get center point of a bounding box
   */
  private getBBoxCenter(bbox: { x: number; y: number; width: number; height: number }): Point {
    return {
      x: bbox.x + bbox.width / 2,
      y: bbox.y + bbox.height / 2,
    };
  }

  /**
   * Analyze using anatomical reference (optic disc and fovea)
   *
   * Geometric approach:
   * - Origin: center of optic disc
   * - Temporal axis (0°): vector from OD to fovea
   * - Calculate rotation angle of the eye
   * - Normalize each lesion's angle by subtracting rotation
   */
  private analyzeWithAnatomicalReference(
    detections: Detection[],
    opticDisc: Detection,
    fovea: Detection,
    analysis: QuadrantAnalysis
  ): void {
    // Get centers
    const odCenter = this.getBBoxCenter(opticDisc.bbox);
    const foveaCenter = this.getBBoxCenter(fovea.bbox);

    // Step 3: Calculate eye rotation angle
    // Vector from OD to fovea defines the temporal axis
    const dx = foveaCenter.x - odCenter.x;
    const dy = foveaCenter.y - odCenter.y;

    // Rotation angle of the eye (in radians)
    // atan2 returns angle in range [-π, π]
    const eyeRotation = Math.atan2(dy, dx);

    // Step 4: Classify each lesion (excluding OD and fovea)
    for (const detection of detections) {
      // Skip optic disc and fovea themselves
      const detClass = detection.class.toLowerCase().trim();
      if (detClass === 'optic_disc' || detClass === 'optic disc' || detClass === 'fovea') {
        continue;
      }

      // Get lesion center
      const lesionCenter = this.getBBoxCenter(detection.bbox);

      // Calculate angle relative to optic disc
      const lesionDx = lesionCenter.x - odCenter.x;
      const lesionDy = lesionCenter.y - odCenter.y;
      const lesionAngle = Math.atan2(lesionDy, lesionDx);

      // Normalize angle by subtracting eye rotation
      // This "straightens" the eye so temporal is always 0°
      let normalizedAngle = lesionAngle - eyeRotation;

      // Normalize to range [-π, π]
      normalizedAngle = this.normalizeAngle(normalizedAngle);

      // Classify into quadrant
      const quadrant = this.angleToQuadrant(normalizedAngle);
      analysis[quadrant]++;
      analysis.total++;
    }
  }

  /**
   * Normalize angle to range [-π, π]
   */
  private normalizeAngle(angle: number): number {
    // Normalize to [-π, π]
    while (angle > Math.PI) {
      angle -= 2 * Math.PI;
    }
    while (angle < -Math.PI) {
      angle += 2 * Math.PI;
    }
    return angle;
  }

  /**
   * Classify angle into quadrant
   *
   * Quadrant mapping (after normalization, temporal = 0°):
   * - Superior Temporal: 0° to 90° (0 to π/2)
   * - Superior Nasal: 90° to 180° (π/2 to π)
   * - Inferior Nasal: -180° to -90° (-π to -π/2)
   * - Inferior Temporal: -90° to 0° (-π/2 to 0)
   */
  private angleToQuadrant(normalizedAngle: number): QuadrantType {
    const PI_2 = Math.PI / 2;

    if (normalizedAngle >= 0 && normalizedAngle < PI_2) {
      return 'superior-temporal';
    } else if (normalizedAngle >= PI_2 && normalizedAngle <= Math.PI) {
      return 'superior-nasal';
    } else if (normalizedAngle < 0 && normalizedAngle >= -PI_2) {
      return 'inferior-temporal';
    } else {
      // normalizedAngle < -PI_2 && normalizedAngle >= -PI
      return 'inferior-nasal';
    }
  }

  /**
   * Fallback analysis using simple image center division
   * When optic disc or fovea is not detected
   */
  private analyzeWithFallback(
    detections: Detection[],
    imageWidth: number,
    imageHeight: number,
    analysis: QuadrantAnalysis
  ): void {
    const centerX = imageWidth / 2;
    const centerY = imageHeight / 2;

    for (const detection of detections) {
      // Skip anatomical landmarks
      const detClass = detection.class.toLowerCase().trim();
      if (detClass === 'optic_disc' || detClass === 'optic disc' || detClass === 'fovea') {
        continue;
      }

      const lesionCenter = this.getBBoxCenter(detection.bbox);

      // Simple quadrant division based on image center
      const isRight = lesionCenter.x >= centerX;
      const isTop = lesionCenter.y < centerY;

      let quadrant: QuadrantType;
      if (isRight && isTop) {
        quadrant = 'superior-temporal';
      } else if (isRight && !isTop) {
        quadrant = 'inferior-temporal';
      } else if (!isRight && isTop) {
        quadrant = 'superior-nasal';
      } else {
        quadrant = 'inferior-nasal';
      }

      analysis[quadrant]++;
      analysis.total++;
    }
  }

  /**
   * Format analysis for display
   */
  formatAnalysis(analysis: QuadrantAnalysis): string {
    const st = analysis['superior-temporal'];
    const it = analysis['inferior-temporal'];
    const sn = analysis['superior-nasal'];
    const in_ = analysis['inferior-nasal'];

    let result = `Quadrant Analysis: ST=${st}, IT=${it}, SN=${sn}, IN=${in_} (Total: ${analysis.total})`;

    if (analysis.usedFallback) {
      result += ' [Fallback: center-based division]';
    }

    if (!analysis.opticDiscFound) {
      result += ' [Warning: Optic disc not detected]';
    }

    if (!analysis.foveaFound) {
      result += ' [Warning: Fovea not detected]';
    }

    return result;
  }
}

// Singleton instance
export const quadrantCalculator = new QuadrantCalculator();
