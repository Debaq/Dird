import { ONNXModelManager, preprocessImage, postprocessDetections, applyNMS } from './onnx-manager';
import type { Detection } from './onnx-manager';
import type { ModelMetadata } from './model-metadata';
import { db } from '@/lib/db/schema';
import { modelDownloader, type DownloadProgressCallback } from './model-downloader';
import { useConfigStore } from '@/stores/config-store';
import { useInferenceMetricsStore } from '@/stores/inference-metrics-store';
import { classManager } from '@/lib/classes/class-manager';
import { generateOpticDiscMask, isOpenCVReady } from './optic-disc-refiner';
import { quadrantCalculator } from '@/lib/analysis/quadrant-calculator';
import { classifyAndSaveImage } from '@/lib/analysis/image-classification-service';

export class InferenceService {
  private detectionModel: ONNXModelManager | null = null;
  private segmentationModel: ONNXModelManager | null = null;

  /**
   * Load detection model from GitHub or local
   */
  async loadDetectionModel(
    modelPath?: string, 
    metadata?: ModelMetadata,
    onProgress?: DownloadProgressCallback
  ): Promise<void> {
    // If path and metadata provided, use them directly (backward compatibility)
    if (modelPath && metadata) {
      this.detectionModel = new ONNXModelManager();
      await this.detectionModel.loadModel(modelPath, metadata);
      // Update class manager with loaded metadata
      classManager.setModelMetadata(metadata);
      return;
    }

    // Otherwise, download from GitHub
    const { modelUrl, metadata: downloadedMetadata } = await modelDownloader.downloadModel('detection', onProgress);
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

    const inputSize = metadata.model_info?.input_size || metadata.input_size || [640, 640];

    const t0 = performance.now();
    const { data, dims } = preprocessImage(imageElement, inputSize);
    const t1 = performance.now();

    const results = await this.detectionModel.runInference(data, dims);
    const t2 = performance.now();

    const outputName = Object.keys(results)[0];
    const output = results[outputName];

    const sensitivity = useConfigStore.getState().config.localModels.detection.sensitivity;

    let detections = postprocessDetections(
      output,
      metadata,
      imageElement.width,
      imageElement.height,
      sensitivity
    );
    const t3 = performance.now();

    let nms_ms: number | null = null;
    if (!metadata.output_spec?.nms_applied_by_model) {
      const iouThreshold = metadata.iou_threshold || 0.45;
      detections = applyNMS(detections, iouThreshold);
      nms_ms = performance.now() - t3;
    }
    const t4 = performance.now();

    // Spatial analysis (quadrant calculation)
    const quadrantAnalysis = quadrantCalculator.analyzeQuadrants(
      detections,
      imageElement.width,
      imageElement.height
    );
    const t5 = performance.now();

    console.log('Quadrant Analysis:', quadrantCalculator.formatAnalysis(quadrantAnalysis));

    const modelVersion = metadata.model_info?.version || metadata.model_version || 'unknown';
    await this.saveDetections(imageId, detections, modelVersion);

    const config = useConfigStore.getState().config;
    if (config.processing.opticDiscRefinement) {
      await this.generateOpticDiscSegmentations(imageElement, imageId, detections, modelVersion);
    }

    // Clinical classification
    const t6 = performance.now();
    try {
      await classifyAndSaveImage(imageId);
    } catch (error) {
      console.error('Error auto-classifying image after AI processing:', error);
    }
    const t7 = performance.now();

    useInferenceMetricsStore.getState().addEntry({
      timestamp: Date.now(),
      modelVersion,
      imageWidth: imageElement.width,
      imageHeight: imageElement.height,
      numDetections: detections.length,
      preprocess_ms: +(t1 - t0).toFixed(2),
      inference_ms: +(t2 - t1).toFixed(2),
      postprocess_ms: +(t3 - t2).toFixed(2),
      nms_ms: nms_ms !== null ? +nms_ms.toFixed(2) : null,
      spatial_ms: +(t5 - t4).toFixed(2),
      clinical_ms: +(t7 - t6).toFixed(2),
      total_ms: +((t1 - t0) + (t2 - t1) + (t3 - t2) + (nms_ms ?? 0) + (t5 - t4) + (t7 - t6)).toFixed(2),
    });

    return detections;
  }

  /**
   * Generate optic disc segmentation masks and save to database
   */
  private async generateOpticDiscSegmentations(
    imageElement: HTMLImageElement,
    imageId: number,
    detections: Detection[],
    modelVersion: string
  ): Promise<void> {
    // Check if OpenCV is available
    if (!isOpenCVReady()) {
      console.warn('OpenCV not ready, skipping optic disc segmentation');
      return;
    }

    const now = new Date();

    for (const detection of detections) {
      // Only process optic_disc detections
      if (detection.class === 'optic_disc' || detection.class === 'optic disc') {
        try {
          // Generate circular mask
          const segmentation = await generateOpticDiscMask(
            imageElement,
            detection.bbox,
            detection.confidence
          );

          if (segmentation) {
            // Save segmentation to database
            await db.segmentations.add({
              imageId,
              type: 'ai',
              modelVersion,
              maskData: segmentation.maskData,
              class: 'optic_disc',
              confidence: segmentation.circle.confidence,
              opacity: 0.4,
              visible: true,
              createdAt: now
            });
          }

        } catch (error) {
          console.error('Error generating optic disc segmentation:', error);
        }
      }
    }
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
