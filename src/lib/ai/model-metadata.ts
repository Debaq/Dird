export interface ModelMetadata {
  model_version: string;
  model_type: 'detection' | 'segmentation';
  classes: string[];
  input_size: [number, number];
  confidence_threshold: number;
  iou_threshold: number;
  date_trained: string;
  metrics?: {
    mAP50?: number;
    precision?: number;
    recall?: number;
  };
}

export interface ModelInfo {
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

export async function getAvailableModels(): Promise<ModelInfo[]> {
  const models: ModelInfo[] = [];

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
    microaneurysm: '#FF6B6B',
    hard_exudate: '#F9A825',
    soft_exudate: '#FDD835',
    hemorrhage: '#D32F2F',
    neovascularization: '#7B1FA2',
  };

  return colors[className] || '#20B5AE';
}
