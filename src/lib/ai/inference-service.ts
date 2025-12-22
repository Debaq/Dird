import { ONNXModelManager, preprocessImage, postprocessDetections, applyNMS } from './onnx-manager';
import type { Detection } from './onnx-manager';
import type { ModelMetadata } from './model-metadata';
import { db } from '@/lib/db/schema';

export class InferenceService {
  private detectionModel: ONNXModelManager | null = null;
  private segmentationModel: ONNXModelManager | null = null;

  async loadDetectionModel(modelPath: string, metadata: ModelMetadata): Promise<void> {
    this.detectionModel = new ONNXModelManager();
    await this.detectionModel.loadModel(modelPath, metadata);
  }

  async loadSegmentationModel(modelPath: string, metadata: ModelMetadata): Promise<void> {
    this.segmentationModel = new ONNXModelManager();
    await this.segmentationModel.loadModel(modelPath, metadata);
  }

  async detectObjects(imageElement: HTMLImageElement, imageId: number): Promise<Detection[]> {
    if (!this.detectionModel || !this.detectionModel.isLoaded()) {
      throw new Error('Detection model not loaded');
    }

    const metadata = this.detectionModel.getMetadata()!;

    // Preprocess image
    const { data, dims } = preprocessImage(imageElement, metadata.input_size);

    // Run inference
    const results = await this.detectionModel.runInference(data, dims);

    // Get output tensor (assuming first output is detections)
    const outputName = Object.keys(results)[0];
    const output = results[outputName];

    // Post-process results
    let detections = postprocessDetections(
      output,
      metadata,
      imageElement.width,
      imageElement.height
    );

    // Apply NMS
    detections = applyNMS(detections, metadata.iou_threshold);

    // Save detections to database
    await this.saveDetections(imageId, detections, metadata.model_version);

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

    // Preprocess image
    const { data, dims } = preprocessImage(imageElement, metadata.input_size);

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
