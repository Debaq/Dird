import * as ort from 'onnxruntime-web';
import type { ModelMetadata, ClassDefinitionMetadata, BboxFormat } from './model-metadata';
import { useConfigStore } from '@/stores/config-store';

export class ONNXModelManager {
  private session: ort.InferenceSession | null = null;
  private metadata: ModelMetadata | null = null;

  constructor() {
    const config = useConfigStore.getState().config;
    const cpuVendor = config.processing.cpuVendor;

    // Configure ONNX Runtime with optimized settings based on CPU vendor
    // Different vendors may benefit from different thread configurations
    if (cpuVendor === 'arm') {
      // ARM processors typically work better with single thread in WASM
      ort.env.wasm.numThreads = 1;
    } else if (cpuVendor === 'intel' || cpuVendor === 'amd') {
      // x86 processors can handle more threads
      ort.env.wasm.numThreads = 1; // Keep at 1 for stability, but can be increased
    } else {
      // Auto mode: conservative single-threaded approach
      ort.env.wasm.numThreads = 1;
    }

    ort.env.wasm.simd = true;

    // Use CDN for WASM files (most reliable option)
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';

    // Configure logging based on CPU vendor setting
    if (cpuVendor === 'auto') {
      // Auto mode: suppress CPU vendor warnings as they're cosmetic on Linux
      ort.env.logLevel = 'error';
    } else {
      // Manual configuration: show warnings so user can verify settings
      ort.env.logLevel = 'warning';
      console.log(`🔧 ONNX Runtime configured for ${cpuVendor.toUpperCase()} CPU`);
    }

    // ONNX Runtime configured with optimized settings
  }

  async loadModel(modelPath: string, metadata: ModelMetadata): Promise<void> {
    try {
      // Fetch the model as ArrayBuffer for better compatibility
      let modelData: ArrayBuffer;

      if (modelPath.startsWith('http://') || modelPath.startsWith('https://')) {
        const response = await fetch(modelPath, {
          mode: 'cors',
          cache: 'force-cache'
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch model: ${response.statusText}`);
        }

        modelData = await response.arrayBuffer();
      } else {
        // For local files, fetch as ArrayBuffer
        const response = await fetch(modelPath);
        if (!response.ok) {
          throw new Error(`Failed to fetch local model: ${response.statusText}`);
        }
        modelData = await response.arrayBuffer();
      }

      // Validate ArrayBuffer
      if (!modelData || modelData.byteLength === 0) {
        throw new Error('Invalid model data: empty ArrayBuffer');
      }

      // Try with minimal optimization first (safer for newer models)
      try {
        this.session = await ort.InferenceSession.create(modelData, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'disabled',
        });
      } catch (error) {
        // If that fails, try with extended optimization
        this.session = await ort.InferenceSession.create(modelData, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'extended',
        });
      }

      this.metadata = metadata;

    } catch (error) {
      // Provide more helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('getValue')) {
          throw new Error(
            'Model incompatible with browser runtime. ' +
            'The model may have been exported with an unsupported ONNX opset version. ' +
            'Please re-export with opset_version=13-15 for best browser compatibility.'
          );
        }

        if (error.message.includes('operator')) {
          throw new Error(
            'Model contains unsupported operators. ' +
            'Please simplify the model or use standard ONNX operators.'
          );
        }

        if (error.message.includes('fetch') || error.message.includes('network')) {
          throw new Error(
            'Network error while loading model. ' +
            'Please check your internet connection and try again.'
          );
        }
      }

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

// Post-processing for model detection
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
  originalHeight: number,
  confidenceThreshold?: number
): Detection[] {
  const detections: Detection[] = [];
  const outputData = output.data as Float32Array;
  const dims = output.dims;

  // Get classes (new format or legacy)
  const allClasses = metadata.classes || [];

  // CRITICAL: Filter only currently_detected classes for the model
  // The model was trained with fewer classes than listed in metadata
  let classes: any[];
  if (allClasses.length > 0 && typeof allClasses[0] === 'object' && 'currently_detected' in allClasses[0]) {
    // New format with metadata - filter only currently_detected
    classes = (allClasses as ClassDefinitionMetadata[]).filter(c => c.currently_detected);
  } else {
    // Legacy format - use all
    classes = allClasses;
  }

  // Helper function to get class name (handles both string[] and ClassDefinitionMetadata[])
  const getClassName = (index: number): string => {
    const classItem = classes[index];
    if (typeof classItem === 'string') {
      return classItem;
    } else if (classItem && typeof classItem === 'object' && 'technical_name' in classItem) {
      return classItem.technical_name;
    }
    return `class_${index}`;
  };

  // Get threshold (parameter, legacy field, or default)
  const threshold = confidenceThreshold !== undefined
    ? confidenceThreshold
    : (metadata.confidence_threshold || 0.5);

  const numClasses = classes.length;
  const inputSize = metadata.model_info?.input_size?.[0] || metadata.input_size?.[0] || 640;
  const scaleX = originalWidth / inputSize;
  const scaleY = originalHeight / inputSize;

  // Format declared by metadata spec (preferred) or auto-detected from shape.
  const spec = metadata.output_spec;
  const isEnd2End =
    spec?.format === 'end2end_nms' ||
    (spec === undefined && dims.length === 3 && dims[2] === 6);

  if (isEnd2End) {
    // [batch, D, 6] = [x1, y1, x2, y2, score, class_idx]. NMS already applied.
    const numDets = dims[1];
    const cols = dims[2];
    const bboxFormat: BboxFormat = spec?.bbox_format ?? 'xyxy';
    for (let i = 0; i < numDets; i++) {
      const off = i * cols;
      const score = outputData[off + 4];
      if (score < threshold) continue;
      const ci = outputData[off + 5] | 0;
      if (ci < 0 || ci >= numClasses) continue;

      let bboxX: number, bboxY: number, bboxWidth: number, bboxHeight: number;
      if (bboxFormat === 'cxcywh') {
        const cx = outputData[off];
        const cy = outputData[off + 1];
        const w = outputData[off + 2];
        const h = outputData[off + 3];
        bboxX = (cx - w / 2) * scaleX;
        bboxY = (cy - h / 2) * scaleY;
        bboxWidth = w * scaleX;
        bboxHeight = h * scaleY;
      } else {
        const x1 = outputData[off];
        const y1 = outputData[off + 1];
        const x2 = outputData[off + 2];
        const y2 = outputData[off + 3];
        bboxX = x1 * scaleX;
        bboxY = y1 * scaleY;
        bboxWidth = (x2 - x1) * scaleX;
        bboxHeight = (y2 - y1) * scaleY;
      }

      detections.push({
        bbox: { x: bboxX, y: bboxY, width: bboxWidth, height: bboxHeight },
        class: getClassName(ci),
        confidence: score,
        classIndex: ci,
      });
    }
    return detections;
  }

  // Legacy YOLO raw: [batch, num_detections, 4 + num_classes] (transposed)
  //                  or [batch, 4 + num_classes, num_detections]
  let numDetections: number;
  let isTransposed = false;

  if (dims.length === 3) {
    if (dims[1] === 4 + numClasses || dims[1] === 84) {
      numDetections = dims[2];
      isTransposed = false;
    } else {
      numDetections = dims[1];
      isTransposed = true;
    }
  } else {
    throw new Error(`Unexpected output dimensions: ${dims}`);
  }

  for (let i = 0; i < numDetections; i++) {
    let x, y, w, h;
    let maxScore = 0;
    let maxClassIndex = 0;

    if (isTransposed) {
      // Format: [batch, detections, 4+classes]
      const offset = i * (4 + numClasses);
      x = outputData[offset];
      y = outputData[offset + 1];
      w = outputData[offset + 2];
      h = outputData[offset + 3];

      for (let c = 0; c < numClasses; c++) {
        const score = outputData[offset + 4 + c];
        if (score > maxScore) {
          maxScore = score;
          maxClassIndex = c;
        }
      }
    } else {
      // Format: [batch, 4+classes, detections]
      x = outputData[i];
      y = outputData[numDetections + i];
      w = outputData[2 * numDetections + i];
      h = outputData[3 * numDetections + i];

      for (let c = 0; c < numClasses; c++) {
        const score = outputData[(4 + c) * numDetections + i];
        if (score > maxScore) {
          maxScore = score;
          maxClassIndex = c;
        }
      }
    }

    if (maxScore >= threshold) {
      const bboxX = (x - w / 2) * scaleX;
      const bboxY = (y - h / 2) * scaleY;
      const bboxWidth = w * scaleX;
      const bboxHeight = h * scaleY;

      detections.push({
        bbox: {
          x: bboxX,
          y: bboxY,
          width: bboxWidth,
          height: bboxHeight,
        },
        class: getClassName(maxClassIndex),
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
