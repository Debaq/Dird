import type { ImageFilter } from '@/stores/image-processing-store';

declare const cv: any;

export async function applyFilterPipeline(
  sourceImage: HTMLImageElement,
  filters: ImageFilter[]
): Promise<HTMLCanvasElement> {
  let inputCanvas = document.createElement('canvas');
  inputCanvas.width = sourceImage.width;
  inputCanvas.height = sourceImage.height;
  const ctx = inputCanvas.getContext('2d')!;
  ctx.drawImage(sourceImage, 0, 0);

  for (const filter of filters) {
    if (!filter.enabled) continue;
    inputCanvas = await applyFilter(inputCanvas, filter);
  }

  return inputCanvas;
}

// ============================================================================
// Helpers — consistent channel handling.
// cv.imread() returns an RGBA (CV_8UC4) Mat in R,G,B,A order. The previous
// implementation used COLOR_BGR2* conversions, which treated RGBA as BGR and
// swapped red/blue everywhere. We standardize on RGB and only ever hand RGBA
// (or normalized) Mats to cv.imshow.
// ============================================================================

/** Read a canvas into a 3-channel RGB Mat (alpha dropped). Caller must delete. */
function readRGB(canvas: HTMLCanvasElement): any {
  const rgba = cv.imread(canvas);
  const rgb = new cv.Mat();
  cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
  rgba.delete();
  return rgb;
}

/** Display a 1- (gray), 3- (RGB) or 4-channel (RGBA) Mat onto a canvas correctly. */
function showMat(mat: any, canvas: HTMLCanvasElement): void {
  const ch = mat.channels();
  if (ch === 4) {
    cv.imshow(canvas, mat);
    return;
  }
  let rgba: any = null;
  try {
    rgba = new cv.Mat();
    cv.cvtColor(mat, rgba, ch === 1 ? cv.COLOR_GRAY2RGBA : cv.COLOR_RGB2RGBA);
    cv.imshow(canvas, rgba);
  } finally {
    if (rgba) rgba.delete();
  }
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const RGB_CHANNEL_INDEX: Record<string, number> = { red: 0, green: 1, blue: 2 };

async function applyFilter(
  inputCanvas: HTMLCanvasElement,
  filter: ImageFilter
): Promise<HTMLCanvasElement> {
  switch (filter.type) {
    case 'brightness':
      return applyBrightness(inputCanvas, filter.config.value ?? 0);
    case 'contrast':
      return applyContrast(inputCanvas, filter.config.value ?? 1.0);
    case 'saturation':
      return applySaturation(inputCanvas, filter.config.value ?? 1.0);
    case 'gamma':
      return applyGamma(inputCanvas, filter.config.value ?? 1.0);
    case 'green_channel':
      return applyChannelExtraction(inputCanvas, 'green');
    case 'red_channel':
      return applyChannelExtraction(inputCanvas, 'red');
    case 'blue_channel':
      return applyChannelExtraction(inputCanvas, 'blue');
    case 'grayscale':
      return applyGrayscale(inputCanvas);
    case 'clahe':
      return applyCLAHE(
        inputCanvas,
        filter.config.clipLimit ?? 2.0,
        filter.config.tileGridSize ?? 8,
        filter.config.channel ?? 'luminance'
      );
    case 'threshold':
      return applyThreshold(inputCanvas, filter.config.type ?? 'otsu', filter.config.threshold ?? 127);
    case 'edge_detection':
      return applyEdgeDetection(inputCanvas, filter.config);
    case 'sharpening':
      return applySharpening(inputCanvas, filter.config.value ?? 1.0);
    case 'blur':
      return applyBlur(inputCanvas, filter.config.blurType ?? 'gaussian', filter.config.kernelSize ?? 5);
    case 'morphology':
      return applyMorphology(inputCanvas, filter.config);
    case 'histogram_equalization':
      return applyHistogramEqualization(inputCanvas);
    case 'invert':
      return applyInvert(inputCanvas);
    case 'frangi':
      return applyVesselEnhance(inputCanvas, filter.config);
    case 'tophat':
      return applyTopHat(inputCanvas, filter.config.kernelSize ?? 15);
    case 'color_mapping':
      return applyColorMapping(inputCanvas, filter.config.colorSpace ?? 'hsv');
    default:
      return inputCanvas;
  }
}

// ============ BASIC (Canvas 2D CSS filters — correct & fast) ============

function applyBrightness(canvas: HTMLCanvasElement, brightness: number): HTMLCanvasElement {
  const output = makeCanvas(canvas.width, canvas.height);
  const ctx = output.getContext('2d')!;
  ctx.filter = `brightness(${100 + brightness}%)`;
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';
  return output;
}

function applyContrast(canvas: HTMLCanvasElement, contrast: number): HTMLCanvasElement {
  const output = makeCanvas(canvas.width, canvas.height);
  const ctx = output.getContext('2d')!;
  ctx.filter = `contrast(${contrast * 100}%)`;
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';
  return output;
}

function applySaturation(canvas: HTMLCanvasElement, saturation: number): HTMLCanvasElement {
  const output = makeCanvas(canvas.width, canvas.height);
  const ctx = output.getContext('2d')!;
  ctx.filter = `saturate(${saturation * 100}%)`;
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';
  return output;
}

/** Gamma correction via LUT — brightens dark periphery (gamma>1) without clipping highlights. */
function applyGamma(canvas: HTMLCanvasElement, gamma: number): HTMLCanvasElement {
  let rgb: any = null;
  let lut: any = null;
  let dst: any = null;
  const g = gamma <= 0 ? 1.0 : gamma;
  try {
    rgb = readRGB(canvas);
    lut = new cv.Mat(1, 256, cv.CV_8UC1);
    for (let i = 0; i < 256; i++) {
      lut.data[i] = Math.min(255, Math.max(0, Math.round(255 * Math.pow(i / 255, 1 / g))));
    }
    dst = new cv.Mat();
    cv.LUT(rgb, lut, dst);
    const output = makeCanvas(canvas.width, canvas.height);
    showMat(dst, output);
    return output;
  } finally {
    if (rgb) rgb.delete();
    if (lut) lut.delete();
    if (dst) dst.delete();
  }
}

// ============ OPENCV FILTERS (RGB convention) ============

/** Extract a single RGB channel and show it as grayscale (green = best for retinal lesions/vessels). */
function applyChannelExtraction(canvas: HTMLCanvasElement, channel: 'red' | 'green' | 'blue'): HTMLCanvasElement {
  let rgb: any = null;
  let channels: any = null;
  try {
    rgb = readRGB(canvas);
    channels = new cv.MatVector();
    cv.split(rgb, channels);
    const sel = channels.get(RGB_CHANNEL_INDEX[channel]);
    const output = makeCanvas(canvas.width, canvas.height);
    showMat(sel, output); // 1-channel -> shown as grayscale
    return output;
  } finally {
    if (rgb) rgb.delete();
    if (channels) channels.delete();
  }
}

function applyGrayscale(canvas: HTMLCanvasElement): HTMLCanvasElement {
  let rgb: any = null;
  let gray: any = null;
  try {
    rgb = readRGB(canvas);
    gray = new cv.Mat();
    cv.cvtColor(rgb, gray, cv.COLOR_RGB2GRAY);
    const output = makeCanvas(canvas.width, canvas.height);
    showMat(gray, output);
    return output;
  } finally {
    if (rgb) rgb.delete();
    if (gray) gray.delete();
  }
}

/**
 * CLAHE — contrast-limited adaptive histogram equalization.
 * - channel = 'luminance' (default): on the L* channel of CIELAB, preserves color.
 * - channel = 'green'|'red'|'blue': on that single channel, shown as enhanced grayscale
 *   (green is the classic fundus channel for vessels/microaneurysms).
 */
function applyCLAHE(
  canvas: HTMLCanvasElement,
  clipLimit: number,
  tileSize: number,
  channel: string
): HTMLCanvasElement {
  let rgb: any = null;
  let clahe: any = null;
  const tile = Math.max(1, Math.round(tileSize));
  try {
    rgb = readRGB(canvas);
    clahe = new cv.CLAHE(clipLimit, new cv.Size(tile, tile));
    const output = makeCanvas(canvas.width, canvas.height);

    if (channel === 'luminance') {
      let lab: any = null;
      let chans: any = null;
      try {
        lab = new cv.Mat();
        cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab);
        chans = new cv.MatVector();
        cv.split(lab, chans);
        const l = chans.get(0);
        clahe.apply(l, l);
        cv.merge(chans, lab);
        cv.cvtColor(lab, rgb, cv.COLOR_Lab2RGB);
        showMat(rgb, output);
      } finally {
        if (lab) lab.delete();
        if (chans) chans.delete();
      }
    } else {
      // Apply CLAHE to the chosen RGB channel and recombine -> stays in COLOR
      // (for a grayscale single-channel view use the "Canal Verde/Rojo/Azul" filter).
      let chans: any = null;
      try {
        chans = new cv.MatVector();
        cv.split(rgb, chans);
        const c = chans.get(RGB_CHANNEL_INDEX[channel] ?? 1);
        clahe.apply(c, c);
        cv.merge(chans, rgb);
        showMat(rgb, output);
      } finally {
        if (chans) chans.delete();
      }
    }
    return output;
  } finally {
    if (rgb) rgb.delete();
    if (clahe) clahe.delete();
  }
}

function applyThreshold(canvas: HTMLCanvasElement, type: string, value: number): HTMLCanvasElement {
  let rgb: any = null;
  let gray: any = null;
  let thresh: any = null;
  try {
    rgb = readRGB(canvas);
    gray = new cv.Mat();
    cv.cvtColor(rgb, gray, cv.COLOR_RGB2GRAY);
    thresh = new cv.Mat();
    const threshTypes: Record<string, number> = {
      binary: cv.THRESH_BINARY,
      binary_inv: cv.THRESH_BINARY_INV,
      trunc: cv.THRESH_TRUNC,
      tozero: cv.THRESH_TOZERO,
      tozero_inv: cv.THRESH_TOZERO_INV,
      otsu: cv.THRESH_BINARY + cv.THRESH_OTSU,
    };
    cv.threshold(gray, thresh, value, 255, threshTypes[type] ?? cv.THRESH_BINARY);
    const output = makeCanvas(canvas.width, canvas.height);
    showMat(thresh, output);
    return output;
  } finally {
    if (rgb) rgb.delete();
    if (gray) gray.delete();
    if (thresh) thresh.delete();
  }
}

function applyEdgeDetection(canvas: HTMLCanvasElement, config: any): HTMLCanvasElement {
  let rgb: any = null;
  let gray: any = null;
  let blurred: any = null;
  let edges: any = null;
  try {
    rgb = readRGB(canvas);
    gray = new cv.Mat();
    cv.cvtColor(rgb, gray, cv.COLOR_RGB2GRAY);
    // light denoise so edges aren't dominated by noise
    blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0);
    edges = new cv.Mat();

    const method = config?.method ?? 'canny';
    if (method === 'canny') {
      cv.Canny(blurred, edges, config?.threshold1 ?? 50, config?.threshold2 ?? 150);
    } else if (method === 'sobel') {
      // gradient magnitude from dx and dy (the old dx=dy=1 was near-useless)
      let gx: any = null, gy: any = null, agx: any = null, agy: any = null;
      try {
        gx = new cv.Mat(); gy = new cv.Mat(); agx = new cv.Mat(); agy = new cv.Mat();
        cv.Sobel(blurred, gx, cv.CV_16S, 1, 0, 3);
        cv.Sobel(blurred, gy, cv.CV_16S, 0, 1, 3);
        cv.convertScaleAbs(gx, agx);
        cv.convertScaleAbs(gy, agy);
        cv.addWeighted(agx, 0.5, agy, 0.5, 0, edges);
      } finally {
        if (gx) gx.delete(); if (gy) gy.delete(); if (agx) agx.delete(); if (agy) agy.delete();
      }
    } else if (method === 'laplacian') {
      let lap: any = null;
      try {
        lap = new cv.Mat();
        cv.Laplacian(blurred, lap, cv.CV_16S, 3);
        cv.convertScaleAbs(lap, edges);
      } finally {
        if (lap) lap.delete();
      }
    }
    const output = makeCanvas(canvas.width, canvas.height);
    showMat(edges, output);
    return output;
  } finally {
    if (rgb) rgb.delete();
    if (gray) gray.delete();
    if (blurred) blurred.delete();
    if (edges) edges.delete();
  }
}

function applySharpening(canvas: HTMLCanvasElement, intensity: number): HTMLCanvasElement {
  let rgb: any = null;
  let dst: any = null;
  let kernel: any = null;
  try {
    rgb = readRGB(canvas);
    dst = new cv.Mat();
    kernel = cv.matFromArray(3, 3, cv.CV_32F, [
      0, -intensity, 0,
      -intensity, 1 + 4 * intensity, -intensity,
      0, -intensity, 0,
    ]);
    cv.filter2D(rgb, dst, -1, kernel);
    const output = makeCanvas(canvas.width, canvas.height);
    showMat(dst, output);
    return output;
  } finally {
    if (rgb) rgb.delete();
    if (dst) dst.delete();
    if (kernel) kernel.delete();
  }
}

function applyBlur(canvas: HTMLCanvasElement, blurType: string, kernelSize: number): HTMLCanvasElement {
  let rgb: any = null;
  let dst: any = null;
  // median/gaussian need odd kernels
  let k = Math.max(1, Math.round(kernelSize));
  if (k % 2 === 0) k += 1;
  try {
    rgb = readRGB(canvas);
    dst = new cv.Mat();
    if (blurType === 'gaussian') {
      cv.GaussianBlur(rgb, dst, new cv.Size(k, k), 0);
    } else if (blurType === 'median') {
      cv.medianBlur(rgb, dst, k);
    } else if (blurType === 'bilateral') {
      cv.bilateralFilter(rgb, dst, k, 75, 75);
    }
    const output = makeCanvas(canvas.width, canvas.height);
    showMat(dst, output);
    return output;
  } finally {
    if (rgb) rgb.delete();
    if (dst) dst.delete();
  }
}

function applyMorphology(canvas: HTMLCanvasElement, config: any): HTMLCanvasElement {
  let rgb: any = null;
  let dst: any = null;
  let kernel: any = null;
  try {
    rgb = readRGB(canvas);
    dst = new cv.Mat();
    kernel = cv.getStructuringElement(
      cv.MORPH_ELLIPSE,
      new cv.Size(config?.kernelSize ?? 3, config?.kernelSize ?? 3)
    );
    const it = config?.iterations ?? 1;
    if (config?.morphType === 'dilate') {
      cv.dilate(rgb, dst, kernel, new cv.Point(-1, -1), it);
    } else if (config?.morphType === 'erode') {
      cv.erode(rgb, dst, kernel, new cv.Point(-1, -1), it);
    } else {
      rgb.copyTo(dst);
    }
    const output = makeCanvas(canvas.width, canvas.height);
    showMat(dst, output);
    return output;
  } finally {
    if (rgb) rgb.delete();
    if (dst) dst.delete();
    if (kernel) kernel.delete();
  }
}

/** Histogram equalization on the L* channel — boosts global contrast while keeping color. */
function applyHistogramEqualization(canvas: HTMLCanvasElement): HTMLCanvasElement {
  let rgb: any = null;
  let lab: any = null;
  let chans: any = null;
  try {
    rgb = readRGB(canvas);
    lab = new cv.Mat();
    cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab);
    chans = new cv.MatVector();
    cv.split(lab, chans);
    const l = chans.get(0);
    cv.equalizeHist(l, l);
    cv.merge(chans, lab);
    cv.cvtColor(lab, rgb, cv.COLOR_Lab2RGB);
    const output = makeCanvas(canvas.width, canvas.height);
    showMat(rgb, output);
    return output;
  } finally {
    if (rgb) rgb.delete();
    if (lab) lab.delete();
    if (chans) chans.delete();
  }
}

/** Invert RGB only (leave alpha intact — the old bitwise_not on RGBA also inverted alpha). */
function applyInvert(canvas: HTMLCanvasElement): HTMLCanvasElement {
  let rgb: any = null;
  let dst: any = null;
  try {
    rgb = readRGB(canvas);
    dst = new cv.Mat();
    cv.bitwise_not(rgb, dst);
    const output = makeCanvas(canvas.width, canvas.height);
    showMat(dst, output);
    return output;
  } finally {
    if (rgb) rgb.delete();
    if (dst) dst.delete();
  }
}

/**
 * Vessel / dark-structure enhancement. Black-hat on the green channel (best vessel
 * contrast in fundus) highlights thin dark structures (vessels, microhemorrhages).
 * Not a true multi-scale Frangi, but an honest, useful approximation.
 */
function applyVesselEnhance(canvas: HTMLCanvasElement, config: any): HTMLCanvasElement {
  let rgb: any = null;
  let chans: any = null;
  let blackhat: any = null;
  let kernel: any = null;
  const k = Math.max(3, config?.kernelSize ?? 11);
  try {
    rgb = readRGB(canvas);
    chans = new cv.MatVector();
    cv.split(rgb, chans);
    const green = chans.get(1);
    kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(k, k));
    blackhat = new cv.Mat();
    cv.morphologyEx(green, blackhat, cv.MORPH_BLACKHAT, kernel);
    const output = makeCanvas(canvas.width, canvas.height);
    showMat(blackhat, output);
    return output;
  } finally {
    if (rgb) rgb.delete();
    if (chans) chans.delete();
    if (blackhat) blackhat.delete();
    if (kernel) kernel.delete();
  }
}

/** Top-hat on the green channel — highlights bright structures (exudates). */
function applyTopHat(canvas: HTMLCanvasElement, kernelSize: number): HTMLCanvasElement {
  let rgb: any = null;
  let chans: any = null;
  let kernel: any = null;
  let tophat: any = null;
  const k = Math.max(3, kernelSize);
  try {
    rgb = readRGB(canvas);
    chans = new cv.MatVector();
    cv.split(rgb, chans);
    const green = chans.get(1);
    kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(k, k));
    tophat = new cv.Mat();
    cv.morphologyEx(green, tophat, cv.MORPH_TOPHAT, kernel);
    const output = makeCanvas(canvas.width, canvas.height);
    showMat(tophat, output);
    return output;
  } finally {
    if (rgb) rgb.delete();
    if (chans) chans.delete();
    if (kernel) kernel.delete();
    if (tophat) tophat.delete();
  }
}

/** Pseudo-color view: map grayscale luminance through an OpenCV colormap (false color). */
function applyColorMapping(canvas: HTMLCanvasElement, colorSpace: string): HTMLCanvasElement {
  let rgb: any = null;
  let gray: any = null;
  let colored: any = null;
  try {
    rgb = readRGB(canvas);
    gray = new cv.Mat();
    cv.cvtColor(rgb, gray, cv.COLOR_RGB2GRAY);
    const maps: Record<string, number> = {
      hsv: cv.COLORMAP_HSV,
      lab: cv.COLORMAP_JET,
      ycrcb: cv.COLORMAP_VIRIDIS ?? cv.COLORMAP_JET,
    };
    colored = new cv.Mat();
    cv.applyColorMap(gray, colored, maps[colorSpace] ?? cv.COLORMAP_JET);
    // applyColorMap outputs BGR -> swap to RGB for display
    cv.cvtColor(colored, colored, cv.COLOR_BGR2RGB);
    const output = makeCanvas(canvas.width, canvas.height);
    showMat(colored, output);
    return output;
  } finally {
    if (rgb) rgb.delete();
    if (gray) gray.delete();
    if (colored) colored.delete();
  }
}
