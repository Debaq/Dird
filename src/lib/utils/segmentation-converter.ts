/**
 * Segmentation Converter
 * Converts paintedPixels arrays to Base64 PNG masks for Annotix export
 */

/**
 * Convert painted pixels (array of "x,y" strings) to Base64 PNG mask
 */
export function paintedPixelsToMask(
  paintedPixels: string[],
  imageWidth: number,
  imageHeight: number
): string | null {
  if (!paintedPixels || paintedPixels.length === 0) {
    return null;
  }

  // Create canvas for mask
  const canvas = document.createElement('canvas');
  canvas.width = imageWidth;
  canvas.height = imageHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  // Create ImageData (RGBA)
  const imageData = ctx.createImageData(imageWidth, imageHeight);
  const data = imageData.data;

  // Fill with transparent (all zeros)
  data.fill(0);

  // Mark painted pixels as white with full opacity
  for (const pixel of paintedPixels) {
    const [xStr, yStr] = pixel.split(',');
    const x = parseInt(xStr, 10);
    const y = parseInt(yStr, 10);

    if (isNaN(x) || isNaN(y) || x < 0 || x >= imageWidth || y < 0 || y >= imageHeight) {
      continue; // Skip invalid pixels
    }

    const index = (y * imageWidth + x) * 4;
    data[index] = 255;     // R
    data[index + 1] = 255; // G
    data[index + 2] = 255; // B
    data[index + 3] = 255; // A (opaque)
  }

  // Put ImageData to canvas
  ctx.putImageData(imageData, 0, 0);

  // Convert to Base64 PNG
  try {
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error converting painted pixels to mask:', error);
    return null;
  }
}

/**
 * Get bounding box from painted pixels
 */
export function getBboxFromPaintedPixels(paintedPixels: string[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  if (!paintedPixels || paintedPixels.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pixel of paintedPixels) {
    const [xStr, yStr] = pixel.split(',');
    const x = parseInt(xStr, 10);
    const y = parseInt(yStr, 10);

    if (isNaN(x) || isNaN(y)) {
      continue;
    }

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}
