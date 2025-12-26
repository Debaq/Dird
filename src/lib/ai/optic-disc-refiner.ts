/**
 * Optic Disc Refinement Module
 *
 * Detects the precise circular boundary of the optic disc within
 * the YOLO bounding box and generates a segmentation mask
 */

// OpenCV types (will be available globally when opencv.js is loaded)
declare const cv: any;

export interface OpticDiscCircle {
  x: number;        // center X relative to full image
  y: number;        // center Y relative to full image
  radius: number;
  confidence: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OpticDiscSegmentation {
  circle: OpticDiscCircle;
  maskData: string;  // Base64 encoded mask
  bbox: BoundingBox; // Original YOLO bbox (unchanged)
}

/**
 * Check if OpenCV.js is loaded and available
 */
export function isOpenCVReady(): boolean {
  return typeof cv !== 'undefined' && cv.Mat !== undefined;
}

/**
 * Wait for OpenCV.js to be ready (with timeout)
 */
export function waitForOpenCV(timeoutMs: number = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkInterval = setInterval(() => {
      if (isOpenCVReady()) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 100);
  });
}

/**
 * Generate optic disc segmentation mask using OpenCV circle detection
 * DOES NOT modify the YOLO bbox - only creates a circular mask within it
 *
 * @param imageElement - HTML Image element containing the fundus image
 * @param bbox - Bounding box from YOLO detection (will NOT be modified)
 * @param originalConfidence - Original YOLO confidence score
 * @returns Segmentation data with circular mask and original bbox
 */
export async function generateOpticDiscMask(
  imageElement: HTMLImageElement,
  bbox: BoundingBox,
  originalConfidence: number
): Promise<OpticDiscSegmentation | null> {

  // Fallback: if OpenCV not available, return null
  if (!isOpenCVReady()) {
    console.warn('OpenCV not available, cannot generate optic disc mask');
    return null;
  }

  let src: any = null;
  let gray: any = null;
  let roi: any = null;
  let mask: any = null;

  try {
    // 1. Load image into OpenCV Mat
    src = cv.imread(imageElement);
    const imageWidth = src.cols;
    const imageHeight = src.rows;

    // 2. Convert to grayscale
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // 3. Extract ROI from YOLO bbox (exact bbox)
    const roiX = Math.max(0, Math.floor(bbox.x));
    const roiY = Math.max(0, Math.floor(bbox.y));
    const roiWidth = Math.min(gray.cols - roiX, Math.floor(bbox.width));
    const roiHeight = Math.min(gray.rows - roiY, Math.floor(bbox.height));

    const rect = new cv.Rect(roiX, roiY, roiWidth, roiHeight);
    roi = gray.roi(rect);

    // 4. Validate ROI brightness (optic disc should be bright)
    const avgBrightness = calculateAverageBrightness(roi);

    if (avgBrightness < 120) {
      console.warn('ROI too dark for optic disc, skipping segmentation');
      return null;
    }

    // 5. Use bbox center as disc center (YOLO already positioned it correctly)
    const centerX = roiWidth / 2;
    const centerY = roiHeight / 2;

    // 6. Calculate radius to fit INSIDE bbox (never exceed)
    const maxRadius = Math.min(roiWidth, roiHeight) / 2;
    const radiusX = maxRadius * 0.95;  // slightly smaller horizontally
    const radiusY = maxRadius * 0.90;  // even smaller vertically (oval shape)

    // 7. Create segmentation mask with alpha channel (RGBA)
    mask = new cv.Mat.zeros(imageHeight, imageWidth, cv.CV_8UC4);

    // Convert to absolute image coords
    const absoluteX = roiX + centerX;
    const absoluteY = roiY + centerY;

    // Draw filled ellipse with white color and 40% base opacity (optic discs are oval, not circular)
    // Background is already (0,0,0,0) - transparent black
    // Alpha = 102 (40% of 255) - layer slider will control final opacity from this base
    cv.ellipse(
      mask,
      new cv.Point(absoluteX, absoluteY),
      new cv.Size(radiusX, radiusY),
      0,      // rotation angle
      0,      // start angle
      360,    // end angle (full ellipse)
      new cv.Scalar(255, 255, 255, 102), // white with 40% alpha (102/255)
      -1      // filled
    );

    // 8. Convert mask to Base64 PNG (PNG supports transparency)
    const canvas = document.createElement('canvas');
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    cv.imshow(canvas, mask);
    const maskData = canvas.toDataURL('image/png');

    canvas.remove();

    console.log(`Optic disc mask: center=(${absoluteX.toFixed(1)}, ${absoluteY.toFixed(1)}), radii=(${radiusX.toFixed(1)}, ${radiusY.toFixed(1)})`);

    return {
      circle: {
        x: absoluteX,
        y: absoluteY,
        radius: maxRadius,
        confidence: originalConfidence
      },
      maskData,
      bbox
    };

  } catch (error) {
    console.error('Error generating optic disc mask:', error);
    return null;

  } finally {
    // Clean up OpenCV Mats
    if (src) src.delete();
    if (gray) gray.delete();
    if (roi) roi.delete();
    if (mask) mask.delete();
  }
}

/**
 * Calculate average brightness of entire ROI
 */
function calculateAverageBrightness(mat: any): number {
  let sum = 0;
  let count = 0;

  for (let y = 0; y < mat.rows; y++) {
    for (let x = 0; x < mat.cols; x++) {
      sum += mat.ucharAt(y, x);
      count++;
    }
  }

  return count > 0 ? sum / count : 0;
}

/**
 * Batch generate masks for multiple optic disc detections
 * Useful if YOLO detects discs in both eyes
 */
export async function generateMultipleOpticDiscMasks(
  imageElement: HTMLImageElement,
  detections: Array<{ bbox: BoundingBox; confidence: number }>
): Promise<OpticDiscSegmentation[]> {
  const masks: OpticDiscSegmentation[] = [];

  for (const detection of detections) {
    const mask = await generateOpticDiscMask(
      imageElement,
      detection.bbox,
      detection.confidence
    );
    if (mask) {
      masks.push(mask);
    }
  }

  return masks;
}
