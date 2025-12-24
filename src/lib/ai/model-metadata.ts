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

export interface ModelMetadata {
  model_info: ModelInfo;
  classes: string[];
  performance_metrics: PerformanceMetrics;
  analysis_report: AnalysisReport;

  // Legacy fields for backward compatibility
  model_version?: string;
  model_type?: 'detection' | 'segmentation';
  input_size?: [number, number];
  confidence_threshold?: number;
  iou_threshold?: number;
  date_trained?: string;
  metrics?: {
    mAP50?: number;
    precision?: number;
    recall?: number;
  };
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

export function getClassColor(className: string): string {
  const colors: Record<string, string> = {
    // Current model classes
    optic_disc: '#4CAF50',        // Verde - estructura normal
    hard_exudate: '#F9A825',      // Amarillo oscuro - exudados
    fovea: '#2196F3',             // Azul - estructura normal
    hemorrhage: '#D32F2F',        // Rojo - hemorragia
    cotton_wool_spot: '#FDD835',  // Amarillo claro - manchas algodonosas
    microhemorrhages: '#FF6B6B',  // Rojo claro - microhemorragias
    edema: '#9C27B0',             // Púrpura - edema

    // Legacy classes (backward compatibility)
    microaneurysm: '#FF6B6B',
    soft_exudate: '#FDD835',
    neovascularization: '#7B1FA2',
  };

  return colors[className] || '#20B5AE';
}
