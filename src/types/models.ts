export interface ModelMetadata {
  model_version: string;
  model_type: 'detection' | 'segmentation';
  classes: string[];
  input_size: [number, number];
  confidence_threshold: number;
  iou_threshold: number;
  date_trained: string;
  metrics: {
    mAP50: number;
    precision: number;
    recall: number;
  };
}

export interface InferenceResult {
  detections?: DetectionOutput[];
  segmentations?: SegmentationOutput[];
  modelVersion: string;
  processingTime: number;
  source: 'local' | 'api';
}

export interface DetectionOutput {
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  class: string;
  confidence: number;
}

export interface SegmentationOutput {
  maskData: string;
  class: string;
  confidence: number;
}

export type ModelType = 'detection' | 'segmentation';

export interface ModelConfig {
  enabled: boolean;
  modelPath: string;
  metadata?: ModelMetadata;
}

// API Inference Types
export interface APIInferenceRequest {
  image: string; // base64 encoded
  modelType: ModelType;
  modelName?: string;
  confidenceThreshold?: number;
  iouThreshold?: number;
}

export interface APIInferenceResponse {
  success: boolean;
  data?: {
    detections?: DetectionOutput[];
    segmentations?: SegmentationOutput[];
    modelVersion: string;
    processingTime: number;
  };
  error?: {
    code: string;
    message: string;
  };
}
