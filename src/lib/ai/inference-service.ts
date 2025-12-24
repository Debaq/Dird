import { ONNXModelManager, preprocessImage, postprocessDetections, applyNMS } from './onnx-manager';
import type { Detection } from './onnx-manager';
import type { ModelMetadata } from './model-metadata';
import { db } from '@/lib/db/schema';
import { modelDownloader } from './model-downloader';
import { useConfigStore } from '@/stores/config-store';

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
      return;
    }

    // Otherwise, download from GitHub
    const { modelUrl, metadata: downloadedMetadata } = await modelDownloader.downloadModel('detection');
    this.detectionModel = new ONNXModelManager();
    await this.detectionModel.loadModel(modelUrl, downloadedMetadata);
  }

  /**
   * Load segmentation model from GitHub or local
   */
  async loadSegmentationModel(modelPath?: string, metadata?: ModelMetadata): Promise<void> {
    // If path and metadata provided, use them directly (backward compatibility)
    if (modelPath && metadata) {
      this.segmentationModel = new ONNXModelManager();
      await this.segmentationModel.loadModel(modelPath, metadata);
      return;
    }

    // Otherwise, download from GitHub
    const { modelUrl, metadata: downloadedMetadata } = await modelDownloader.downloadModel('segmentation');
    this.segmentationModel = new ONNXModelManager();
    await this.segmentationModel.loadModel(modelUrl, downloadedMetadata);
  }

  async detectObjects(imageElement: HTMLImageElement, imageId: number): Promise<Detection[]> {
    if (!this.detectionModel || !this.detectionModel.isLoaded()) {
      throw new Error('Detection model not loaded');
    }

    const metadata = this.detectionModel.getMetadata()!;
    console.log('🔍 Metadata:', metadata);

    // Preprocess image
    const { data, dims } = preprocessImage(imageElement, metadata.input_size);
    console.log('📐 Input dims:', dims);

    // Run inference
    const results = await this.detectionModel.runInference(data, dims);
    console.log('🤖 Inference results:', results);

    // Get output tensor (assuming first output is detections)
    const outputName = Object.keys(results)[0];
    const output = results[outputName];
    console.log('📊 Output tensor:', {
      name: outputName,
      dims: output.dims,
      size: output.size,
      dataPreview: Array.from(output.data as Float32Array).slice(0, 20)
    });

    // Get sensitivity from config
    const sensitivity = useConfigStore.getState().config.localModels.detection.sensitivity;
    console.log('🎚️ Using sensitivity override:', sensitivity);

    // Post-process results
    let detections = postprocessDetections(
      output,
      metadata,
      imageElement.width,
      imageElement.height,
      sensitivity
    );
    console.log('🎯 Detections before NMS:', detections.length, detections);

    // Apply NMS
    detections = applyNMS(detections, metadata.iou_threshold);
    console.log('✅ Detections after NMS:', detections.length, detections);

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

    console.log(`💾 Saving ${detections.length} detections to database for image ${imageId}`);

    for (const detection of detections) {
      const id = await db.detections.add({
        imageId,
        type: 'ai',
        modelVersion,
        bbox: detection.bbox,
        class: detection.class,
        confidence: detection.confidence,
        visible: true,
        createdAt: now,
      });
      console.log(`  ✓ Saved detection ${id}:`, detection.class, detection.confidence);
    }

    console.log(`✅ All detections saved successfully`);
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
