import type { ImageFilter } from '@/stores/image-processing-store';

declare const cv: any;

export async function applyFilterPipeline(
  sourceImage: HTMLImageElement,
  filters: ImageFilter[]
): Promise<HTMLCanvasElement> {
  // Canvas temporal de entrada
  let inputCanvas = document.createElement('canvas');
  inputCanvas.width = sourceImage.width;
  inputCanvas.height = sourceImage.height;
  const ctx = inputCanvas.getContext('2d')!;
  ctx.drawImage(sourceImage, 0, 0);

  // Procesar cada filtro secuencialmente
  for (const filter of filters) {
    if (!filter.enabled) continue;

    inputCanvas = await applyFilter(inputCanvas, filter);
  }

  return inputCanvas;
}

async function applyFilter(
  inputCanvas: HTMLCanvasElement,
  filter: ImageFilter
): Promise<HTMLCanvasElement> {
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = inputCanvas.width;
  outputCanvas.height = inputCanvas.height;

  switch (filter.type) {
    case 'brightness':
      return applyBrightness(inputCanvas, filter.config.value || 0);

    case 'contrast':
      return applyContrast(inputCanvas, filter.config.value || 1.0);

    case 'saturation':
      return applySaturation(inputCanvas, filter.config.value || 1.0);

    case 'green_channel':
      return applyChannelExtraction(inputCanvas, 'green');

    case 'red_channel':
      return applyChannelExtraction(inputCanvas, 'red');

    case 'blue_channel':
      return applyChannelExtraction(inputCanvas, 'blue');

    case 'grayscale':
      return applyGrayscale(inputCanvas);

    case 'clahe':
      return applyCLAHE(inputCanvas, filter.config.clipLimit!, filter.config.tileGridSize!);

    case 'threshold':
      return applyThreshold(inputCanvas, filter.config.type!, filter.config.threshold!);

    case 'edge_detection':
      return applyEdgeDetection(inputCanvas, filter.config);

    case 'sharpening':
      return applySharpening(inputCanvas, filter.config.value || 1.0);

    case 'blur':
      return applyBlur(inputCanvas, filter.config.blurType!, filter.config.kernelSize!);

    case 'morphology':
      return applyMorphology(inputCanvas, filter.config);

    case 'histogram_equalization':
      return applyHistogramEqualization(inputCanvas);

    case 'invert':
      return applyInvert(inputCanvas);

    case 'frangi':
      return applyFrangi(inputCanvas, filter.config);

    case 'tophat':
      return applyTopHat(inputCanvas, filter.config.kernelSize!);

    case 'color_mapping':
      return applyColorMapping(inputCanvas, filter.config.colorSpace!);

    default:
      return inputCanvas;
  }
}

// ============ FILTROS BÁSICOS (Canvas 2D) ============

function applyBrightness(canvas: HTMLCanvasElement, brightness: number): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = canvas.width;
  output.height = canvas.height;
  const ctx = output.getContext('2d')!;

  ctx.filter = `brightness(${100 + brightness}%)`;
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';

  return output;
}

function applyContrast(canvas: HTMLCanvasElement, contrast: number): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = canvas.width;
  output.height = canvas.height;
  const ctx = output.getContext('2d')!;

  ctx.filter = `contrast(${contrast * 100}%)`;
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';

  return output;
}

function applySaturation(canvas: HTMLCanvasElement, saturation: number): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = canvas.width;
  output.height = canvas.height;
  const ctx = output.getContext('2d')!;

  ctx.filter = `saturate(${saturation * 100}%)`;
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';

  return output;
}

// ============ FILTROS OPENCV ============

function applyChannelExtraction(canvas: HTMLCanvasElement, channel: 'red' | 'green' | 'blue'): HTMLCanvasElement {
  let src: any = null;
  let channels: any = null;
  let selectedChannel: any = null;
  let bgr: any = null;

  try {
    src = cv.imread(canvas);
    channels = new cv.MatVector();
    cv.split(src, channels);

    const channelIndex = channel === 'red' ? 2 : channel === 'green' ? 1 : 0;
    selectedChannel = channels.get(channelIndex);

    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;

    // Convertir a BGR para visualización
    bgr = new cv.Mat();
    cv.cvtColor(selectedChannel, bgr, cv.COLOR_GRAY2BGR);
    cv.imshow(output, bgr);

    return output;
  } finally {
    if (src) src.delete();
    if (channels) channels.delete();
    if (selectedChannel) selectedChannel.delete();
    if (bgr) bgr.delete();
  }
}

function applyGrayscale(canvas: HTMLCanvasElement): HTMLCanvasElement {
  let src: any = null;
  let gray: any = null;
  let bgr: any = null;

  try {
    src = cv.imread(canvas);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_BGR2GRAY);

    // Convertir back a BGR para compatibilidad
    bgr = new cv.Mat();
    cv.cvtColor(gray, bgr, cv.COLOR_GRAY2BGR);

    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    cv.imshow(output, bgr);

    return output;
  } finally {
    if (src) src.delete();
    if (gray) gray.delete();
    if (bgr) bgr.delete();
  }
}

function applyCLAHE(canvas: HTMLCanvasElement, clipLimit: number, tileSize: number): HTMLCanvasElement {
  let src: any = null;
  let lab: any = null;
  let channels: any = null;
  let lChannel: any = null;
  let clahe: any = null;
  let bgr: any = null;

  try {
    src = cv.imread(canvas);
    lab = new cv.Mat();
    cv.cvtColor(src, lab, cv.COLOR_BGR2Lab);

    channels = new cv.MatVector();
    cv.split(lab, channels);

    clahe = new cv.CLAHE(clipLimit, new cv.Size(tileSize, tileSize));
    lChannel = channels.get(0);
    clahe.apply(lChannel, lChannel);

    cv.merge(channels, lab);

    bgr = new cv.Mat();
    cv.cvtColor(lab, bgr, cv.COLOR_Lab2BGR);

    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    cv.imshow(output, bgr);

    return output;
  } finally {
    if (src) src.delete();
    if (lab) lab.delete();
    if (channels) channels.delete();
    if (lChannel) lChannel.delete();
    if (clahe) clahe.delete();
    if (bgr) bgr.delete();
  }
}

function applyThreshold(canvas: HTMLCanvasElement, type: string, value: number): HTMLCanvasElement {
  let src: any = null;
  let gray: any = null;
  let thresh: any = null;
  let bgr: any = null;

  try {
    src = cv.imread(canvas);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_BGR2GRAY);

    thresh = new cv.Mat();

    const threshTypes: Record<string, number> = {
      binary: cv.THRESH_BINARY,
      binary_inv: cv.THRESH_BINARY_INV,
      trunc: cv.THRESH_TRUNC,
      tozero: cv.THRESH_TOZERO,
      tozero_inv: cv.THRESH_TOZERO_INV,
      otsu: cv.THRESH_BINARY + cv.THRESH_OTSU
    };

    cv.threshold(gray, thresh, value, 255, threshTypes[type]);

    // Convertir back a BGR
    bgr = new cv.Mat();
    cv.cvtColor(thresh, bgr, cv.COLOR_GRAY2BGR);

    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    cv.imshow(output, bgr);

    return output;
  } finally {
    if (src) src.delete();
    if (gray) gray.delete();
    if (thresh) thresh.delete();
    if (bgr) bgr.delete();
  }
}

function applyEdgeDetection(canvas: HTMLCanvasElement, config: any): HTMLCanvasElement {
  let src: any = null;
  let gray: any = null;
  let edges: any = null;
  let bgr: any = null;

  try {
    src = cv.imread(canvas);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_BGR2GRAY);

    edges = new cv.Mat();

    if (config.method === 'canny') {
      cv.Canny(gray, edges, config.threshold1, config.threshold2);
    } else if (config.method === 'sobel') {
      cv.Sobel(gray, edges, cv.CV_8U, 1, 1, 3);
    } else if (config.method === 'laplacian') {
      cv.Laplacian(gray, edges, cv.CV_8U, 1);
    }

    bgr = new cv.Mat();
    cv.cvtColor(edges, bgr, cv.COLOR_GRAY2BGR);

    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    cv.imshow(output, bgr);

    return output;
  } finally {
    if (src) src.delete();
    if (gray) gray.delete();
    if (edges) edges.delete();
    if (bgr) bgr.delete();
  }
}

function applySharpening(canvas: HTMLCanvasElement, intensity: number): HTMLCanvasElement {
  let src: any = null;
  let dst: any = null;
  let kernel: any = null;

  try {
    src = cv.imread(canvas);
    dst = new cv.Mat();

    kernel = cv.matFromArray(3, 3, cv.CV_32F, [
      0, -intensity, 0,
      -intensity, 1 + 4 * intensity, -intensity,
      0, -intensity, 0
    ]);

    cv.filter2D(src, dst, -1, kernel);

    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    cv.imshow(output, dst);

    return output;
  } finally {
    if (src) src.delete();
    if (dst) dst.delete();
    if (kernel) kernel.delete();
  }
}

function applyBlur(canvas: HTMLCanvasElement, blurType: string, kernelSize: number): HTMLCanvasElement {
  let src: any = null;
  let dst: any = null;

  try {
    src = cv.imread(canvas);
    dst = new cv.Mat();

    const ksize = new cv.Size(kernelSize, kernelSize);

    if (blurType === 'gaussian') {
      cv.GaussianBlur(src, dst, ksize, 0);
    } else if (blurType === 'median') {
      cv.medianBlur(src, dst, kernelSize);
    } else if (blurType === 'bilateral') {
      cv.bilateralFilter(src, dst, kernelSize, 75, 75);
    }

    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    cv.imshow(output, dst);

    return output;
  } finally {
    if (src) src.delete();
    if (dst) dst.delete();
  }
}

function applyMorphology(canvas: HTMLCanvasElement, config: any): HTMLCanvasElement {
  let src: any = null;
  let dst: any = null;
  let kernel: any = null;

  try {
    src = cv.imread(canvas);
    dst = new cv.Mat();

    kernel = cv.getStructuringElement(
      cv.MORPH_RECT,
      new cv.Size(config.kernelSize, config.kernelSize)
    );

    if (config.morphType === 'dilate') {
      cv.dilate(src, dst, kernel, new cv.Point(-1, -1), config.iterations);
    } else if (config.morphType === 'erode') {
      cv.erode(src, dst, kernel, new cv.Point(-1, -1), config.iterations);
    }

    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    cv.imshow(output, dst);

    return output;
  } finally {
    if (src) src.delete();
    if (dst) dst.delete();
    if (kernel) kernel.delete();
  }
}

function applyHistogramEqualization(canvas: HTMLCanvasElement): HTMLCanvasElement {
  let src: any = null;
  let gray: any = null;
  let equalized: any = null;
  let bgr: any = null;

  try {
    src = cv.imread(canvas);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_BGR2GRAY);

    equalized = new cv.Mat();
    cv.equalizeHist(gray, equalized);

    bgr = new cv.Mat();
    cv.cvtColor(equalized, bgr, cv.COLOR_GRAY2BGR);

    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    cv.imshow(output, bgr);

    return output;
  } finally {
    if (src) src.delete();
    if (gray) gray.delete();
    if (equalized) equalized.delete();
    if (bgr) bgr.delete();
  }
}

function applyInvert(canvas: HTMLCanvasElement): HTMLCanvasElement {
  let src: any = null;
  let dst: any = null;

  try {
    src = cv.imread(canvas);
    dst = new cv.Mat();

    cv.bitwise_not(src, dst);

    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    cv.imshow(output, dst);

    return output;
  } finally {
    if (src) src.delete();
    if (dst) dst.delete();
  }
}

function applyFrangi(canvas: HTMLCanvasElement, _config: any): HTMLCanvasElement {
  // Implementación simplificada de Frangi (vessel enhancement)
  // Aproximación: Top-Hat negro para realzar estructuras oscuras (vasos)
  let src: any = null;
  let gray: any = null;
  let kernel: any = null;
  let blackhat: any = null;
  let bgr: any = null;

  try {
    src = cv.imread(canvas);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_BGR2GRAY);

    kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(9, 9));
    blackhat = new cv.Mat();
    cv.morphologyEx(gray, blackhat, cv.MORPH_BLACKHAT, kernel);

    bgr = new cv.Mat();
    cv.cvtColor(blackhat, bgr, cv.COLOR_GRAY2BGR);

    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    cv.imshow(output, bgr);

    return output;
  } finally {
    if (src) src.delete();
    if (gray) gray.delete();
    if (kernel) kernel.delete();
    if (blackhat) blackhat.delete();
    if (bgr) bgr.delete();
  }
}

function applyTopHat(canvas: HTMLCanvasElement, kernelSize: number): HTMLCanvasElement {
  let src: any = null;
  let gray: any = null;
  let kernel: any = null;
  let tophat: any = null;
  let bgr: any = null;

  try {
    src = cv.imread(canvas);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_BGR2GRAY);

    kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(kernelSize, kernelSize));
    tophat = new cv.Mat();
    cv.morphologyEx(gray, tophat, cv.MORPH_TOPHAT, kernel);

    bgr = new cv.Mat();
    cv.cvtColor(tophat, bgr, cv.COLOR_GRAY2BGR);

    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    cv.imshow(output, bgr);

    return output;
  } finally {
    if (src) src.delete();
    if (gray) gray.delete();
    if (kernel) kernel.delete();
    if (tophat) tophat.delete();
    if (bgr) bgr.delete();
  }
}

function applyColorMapping(canvas: HTMLCanvasElement, colorSpace: string): HTMLCanvasElement {
  let src: any = null;
  let converted: any = null;

  try {
    src = cv.imread(canvas);
    converted = new cv.Mat();

    const mappings: Record<string, number> = {
      hsv: cv.COLOR_BGR2HSV,
      lab: cv.COLOR_BGR2Lab,
      ycrcb: cv.COLOR_BGR2YCrCb
    };

    cv.cvtColor(src, converted, mappings[colorSpace]);

    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    cv.imshow(output, converted);

    return output;
  } finally {
    if (src) src.delete();
    if (converted) converted.delete();
  }
}
