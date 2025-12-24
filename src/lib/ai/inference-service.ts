import { ONNXModelManager, preprocessImage, postprocessDetections, applyNMS } from './onnx-manager';
import type { Detection } from './onnx-manager';
import type { ModelMetadata } from './model-metadata';
import { db } from '@/lib/db/schema';
import { modelDownloader } from './model-downloader';
import { useConfigStore } from '@/stores/config-store';
import { classManager } from '@/lib/classes/class-manager';

export class InferenceService {
  private detectionModel: ONNXModelManager | null = null;
  private segmentationModel: ONNXModelManager | null = null;

  /**
   * Load detection model from GitHub or local
   */
  async loadDetectionModel(modelPath?: string, metadata?: ModelMetadata): Promise<void> {
    // If path and metadata provided, use them directly (backward compatibility)
    if (modelPath && metadata) {
      this.detectionModel = new ONNXModelManager();
      await this.detectionModel.loadModel(modelPath, metadata);
      // Update class manager with loaded metadata
      classManager.setModelMetadata(metadata);
      return;
    }

    // Otherwise, download from GitHub
    const { modelUrl, metadata: downloadedMetadata } = await modelDownloader.downloadModel('detection');
    this.detectionModel = new ONNXModelManager();
    await this.detectionModel.loadModel(modelUrl, downloadedMetadata);
    // Update class manager with loaded metadata
    classManager.setModelMetadata(downloadedMetadata);
  }

  /**
   * Load segmentation model from GitHub or local
   */
  async loadSegmentationModel(modelPath?: string, metadata?: ModelMetadata): Promise<void> {
    // If path and metadata provided, use them directly (backward compatibility)
    if (modelPath && metadata) {
      this.segmentationModel = new ONNXModelManager();
      await this.segmentationModel.loadModel(modelPath, metadata);
      // Update class manager with loaded metadata
      classManager.setModelMetadata(metadata);
      return;
    }

    // Otherwise, download from GitHub
    const { modelUrl, metadata: downloadedMetadata } = await modelDownloader.downloadModel('segmentation');
    this.segmentationModel = new ONNXModelManager();
    await this.segmentationModel.loadModel(modelUrl, downloadedMetadata);
    // Update class manager with loaded metadata
    classManager.setModelMetadata(downloadedMetadata);
  }

  async detectObjects(imageElement: HTMLImageElement, imageId: number): Promise<Detection[]> {
    if (!this.detectionModel || !this.detectionModel.isLoaded()) {
      throw new Error('Detection model not loaded');
    }

    const metadata = this.detectionModel.getMetadata()!;

    // Get input size (new format or legacy)
    const inputSize = metadata.model_info?.input_size || metadata.input_size || [640, 640];

    // Preprocess image
    const { data, dims } = preprocessImage(imageElement, inputSize);

    // Run inference
    const results = await this.detectionModel.runInference(data, dims);

    // Get output tensor (assuming first output is detections)
    const outputName = Object.keys(results)[0];
    const output = results[outputName];

    // Get sensitivity from config
    const sensitivity = useConfigStore.getState().config.localModels.detection.sensitivity;

    // Post-process results
    let detections = postprocessDetections(
      output,
      metadata,
      imageElement.width,
      imageElement.height,
      sensitivity
    );

    // Apply NMS
    const iouThreshold = metadata.iou_threshold || 0.45;
    detections = applyNMS(detections, iouThreshold);

    // Save detections to database
    const modelVersion = metadata.model_info?.version || metadata.model_version || 'unknown';
    await this.saveDetections(imageId, detections, modelVersion);

    return detections;
  }

  private async saveDetections(
    imageId: number,
    detections: Detection[],
    modelVersion: string
  ): Promise<void> {
    const now = new Date();

    for (const detection of detections) {
      await db.detections.add({
        imageId,
        type: 'ai',
        modelVersion,
        bbox: detection.bbox,
        class: detection.class,
        confidence: detection.confidence,
        visible: true,
        createdAt: now,
      });
    }
  }

  async segmentImage(imageElement: HTMLImageElement): Promise<any> {
    if (!this.segmentationModel || !this.segmentationModel.isLoaded()) {
      throw new Error('Segmentation model not loaded');
    }

    const metadata = this.segmentationModel.getMetadata()!;

    // Get input size (new format or legacy)
    const inputSize = metadata.model_info?.input_size || metadata.input_size || [640, 640];

    // Preprocess image
    const { data, dims } = preprocessImage(imageElement, inputSize);

    // Run inference
    const results = await this.segmentationModel.runInference(data, dims);

    // Post-process segmentation masks (to be implemented)
    // This would depend on the specific segmentation model output format

    return results;
  }

  isDetectionModelLoaded(): boolean {
    return this.detectionModel !== null && this.detectionModel.isLoaded();
  }

  isSegmentationModelLoaded(): boolean {
    return this.segmentationModel !== null && this.segmentationModel.isLoaded();
  }

  async dispose(): Promise<void> {
    if (this.detectionModel) {
      await this.detectionModel.dispose();
      this.detectionModel = null;
    }
    if (this.segmentationModel) {
      await this.segmentationModel.dispose();
      this.segmentationModel = null;
    }
  }
}

// Singleton instance
export const inferenceService = new InferenceService();
