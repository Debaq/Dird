import * as ort from 'onnxruntime-web';
import type { ModelMetadata } from './model-metadata';

export class ONNXModelManager {
  private session: ort.InferenceSession | null = null;
  private metadata: ModelMetadata | null = null;

  constructor() {
    // Configure ONNX Runtime
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
  }

  async loadModel(modelPath: string, metadata: ModelMetadata): Promise<void> {
    try {
      console.log(`Loading ONNX model from ${modelPath}...`);

      // Create inference session with WebGL and WASM backends
      this.session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['webgl', 'wasm'],
        graphOptimizationLevel: 'all',
      });

      this.metadata = metadata;

      console.log('Model loaded successfully');
      console.log('Input names:', this.session.inputNames);
      console.log('Output names:', this.session.outputNames);
    } catch (error) {
      console.error('Error loading ONNX model:', error);
      throw error;
    }
  }

  async runInference(imageData: Float32Array, dims: number[]): Promise<ort.InferenceSession.OnnxValueMapType> {
    if (!this.session) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    try {
      const tensor = new ort.Tensor('float32', imageData, dims);
      const feeds: Record<string, ort.Tensor> = {
        [this.session.inputNames[0]]: tensor,
      };

      const results = await this.session.run(feeds);
      return results;
    } catch (error) {
      console.error('Error running inference:', error);
      throw error;
    }
  }

  getMetadata(): ModelMetadata | null {
    return this.metadata;
  }

  isLoaded(): boolean {
    return this.session !== null;
  }

  async dispose(): Promise<void> {
    if (this.session) {
      await this.session.release();
      this.session = null;
      this.metadata = null;
    }
  }
}

// Preprocessing helper functions
export function preprocessImage(
  imageElement: HTMLImageElement,
  targetSize: [number, number]
): { data: Float32Array; dims: number[] } {
  const [targetWidth, targetHeight] = targetSize;

  // Create canvas for preprocessing
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d')!;

  // Draw and resize image
  ctx.drawImage(imageElement, 0, 0, targetWidth, targetHeight);

  // Get image data
  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const pixels = imageData.data;

  // Convert to CHW format (channels-first) and normalize to [0, 1]
  const float32Data = new Float32Array(3 * targetWidth * targetHeight);

  for (let i = 0; i < pixels.length; i += 4) {
    const pixelIndex = i / 4;
    const r = pixels[i] / 255.0;
    const g = pixels[i + 1] / 255.0;
    const b = pixels[i + 2] / 255.0;

    // CHW format: [C, H, W]
    float32Data[pixelIndex] = r; // R channel
    float32Data[targetWidth * targetHeight + pixelIndex] = g; // G channel
    float32Data[2 * targetWidth * targetHeight + pixelIndex] = b; // B channel
  }

  return {
    data: float32Data,
    dims: [1, 3, targetHeight, targetWidth], // [batch, channels, height, width]
  };
}

// Post-processing for YOLOv8 detection
export interface Detection {
  bbox: { x: number; y: number; width: number; height: number };
  class: string;
  confidence: number;
  classIndex: number;
}

export function postprocessDetections(
  output: ort.Tensor,
  metadata: ModelMetadata,
  originalWidth: number,
  originalHeight: number
): Detection[] {
  const detections: Detection[] = [];
  const outputData = output.data as Float32Array;
  const [, , numDetections] = output.dims;

  // YOLOv8 output format: [batch, 4 + num_classes, num_detections]
  const numClasses = metadata.classes.length;

  for (let i = 0; i < numDetections; i++) {
    // Extract box coordinates (normalized)
    const x = outputData[i];
    const y = outputData[numDetections + i];
    const w = outputData[2 * numDetections + i];
    const h = outputData[3 * numDetections + i];

    // Extract class scores
    let maxScore = 0;
    let maxClassIndex = 0;

    for (let c = 0; c < numClasses; c++) {
      const score = outputData[(4 + c) * numDetections + i];
      if (score > maxScore) {
        maxScore = score;
        maxClassIndex = c;
      }
    }

    // Filter by confidence threshold
    if (maxScore >= metadata.confidence_threshold) {
      detections.push({
        bbox: {
          x: (x - w / 2) * originalWidth,
          y: (y - h / 2) * originalHeight,
          width: w * originalWidth,
          height: h * originalHeight,
        },
        class: metadata.classes[maxClassIndex],
        confidence: maxScore,
        classIndex: maxClassIndex,
      });
    }
  }

  return detections;
}

// Non-Maximum Suppression
export function applyNMS(detections: Detection[], iouThreshold: number): Detection[] {
  if (detections.length === 0) return [];

  // Sort by confidence (descending)
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const keep: Detection[] = [];

  while (sorted.length > 0) {
    const current = sorted.shift()!;
    keep.push(current);

    // Remove overlapping boxes
    for (let i = sorted.length - 1; i >= 0; i--) {
      const iou = calculateIOU(current.bbox, sorted[i].bbox);
      if (iou > iouThreshold) {
        sorted.splice(i, 1);
      }
    }
  }

  return keep;
}

function calculateIOU(
  box1: { x: number; y: number; width: number; height: number },
  box2: { x: number; y: number; width: number; height: number }
): number {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const area1 = box1.width * box1.height;
  const area2 = box2.width * box2.height;
  const union = area1 + area2 - intersection;

  return union > 0 ? intersection / union : 0;
}
