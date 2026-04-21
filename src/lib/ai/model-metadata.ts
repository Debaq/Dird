export interface CriticalFinding {
  issue: string;
  metric?: string;
  observation: string;
  cause?: string;
  implication?: string;
}

export interface AnalysisReport {
  status: 'EXCELLENT' | 'GOOD' | 'REQUIRES_IMPROVEMENT' | 'CRITICAL';
  critical_findings: CriticalFinding[];
  recommendations_next_steps: string[];
}

export interface PerformanceMetrics {
  global: {
    mAP50: number;
    'mAP50-95': number;
    precision_overall: number;
    recall_overall: number;
  };
  per_class_mAP50: Record<string, number>;
}

export interface ModelInfo {
  version: string;
  type: string;
  date_trained: string;
  input_size: [number, number];
}

export type OutputFormat = 'yolo_raw' | 'end2end_nms';
export type BboxFormat = 'cxcywh' | 'xyxy';
export type BboxCoordSpace = 'input_pixels' | 'normalized';

export interface OutputSpec {
  format: OutputFormat;
  bbox_format: BboxFormat;
  bbox_coord_space?: BboxCoordSpace;
  tensor_layout?: string[];
  nms_applied_by_model?: boolean;
  max_detections?: number;
}

export interface ClassDefinitionMetadata {
  index: number;
  technical_name: string;
  display_name_en: string;
  display_name_es: string;
  category: 'anatomical_landmark' | 'lesion';
  severity_impact: 'none' | 'mild' | 'mild_to_moderate' | 'moderate' | 'moderate_to_severe' | 'severe';
  description_en: string;
  description_es: string;
  currently_detected: boolean;
  aliases?: string[];
}

export interface ModelMetadata {
  model_info?: ModelInfo;
  output_spec?: OutputSpec;
  clinical_equivalents?: Record<string, string[]>;
  classes?: string[] | ClassDefinitionMetadata[];
  performance_metrics?: PerformanceMetrics;
  analysis_report?: AnalysisReport;

  // Legacy fields for backward compatibility
  model_version?: string;
  model_type?: 'detection' | 'segmentation';
  model_name?: string;
  input_size?: [number, number];
  confidence_threshold?: number;
  iou_threshold?: number;
  date_trained?: string;
  metrics?: {
    mAP50?: number;
    mAP50_95?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    per_class_mAP50?: Record<string, number>;
  };

  // New structure fields
  class_groups?: Record<string, number[]>;
  color_palette?: Record<string, string>;
  usage_notes?: {
    normalization?: string;
    classification?: string;
    severity_impact?: string;
    categories?: string;
  };
  training_info?: {
    dataset?: string;
    num_images?: number;
    num_annotations?: number;
    epochs?: number;
    framework?: string;
    input_resolution?: string;
    known_issues?: string[];
    recommended_improvements?: string[];
  };
}

export interface TrainingInfo {
  dataset?: string;
  num_images?: number;
  num_annotations?: number;
  epochs?: number;
  framework?: string;
  input_resolution?: string;
  known_issues?: string[];
  recommended_improvements?: string[];
}

export interface ModelFile {
  path: string;
  metadata: ModelMetadata;
}

export async function loadModelMetadata(metadataPath: string): Promise<ModelMetadata> {
  try {
    const response = await fetch(metadataPath);
    if (!response.ok) {
      throw new Error(`Failed to load model metadata: ${response.statusText}`);
    }
    const metadata = await response.json();
    return metadata as ModelMetadata;
  } catch (error) {
    console.error('Error loading model metadata:', error);
    throw error;
  }
}

export async function getAvailableModels(): Promise<ModelFile[]> {
  const models: ModelFile[] = [];

  try {
    // Detection model
    const detectionMetadata = await loadModelMetadata('/models/detection-v1.0.0.json');
    models.push({
      path: '/models/detection-v1.0.0.onnx',
      metadata: detectionMetadata,
    });
  } catch (error) {
    console.warn('Detection model not available:', error);
  }

  try {
    // Segmentation model
    const segmentationMetadata = await loadModelMetadata('/models/segmentation-v1.0.0.json');
    models.push({
      path: '/models/segmentation-v1.0.0.onnx',
      metadata: segmentationMetadata,
    });
  } catch (error) {
    console.warn('Segmentation model not available:', error);
  }

  return models;
}

export function getClassColor(className: string, metadata?: ModelMetadata): string {
  // ONLY use color_palette from metadata - no hardcoded colors
  if (metadata?.color_palette && metadata.color_palette[className]) {
    return metadata.color_palette[className];
  }

  // Minimal fallback ONLY if metadata is not available
  // This should rarely happen - metadata should always be loaded
  return '#20B5AE'; // Generic teal color for unknown/unloaded classes
}
