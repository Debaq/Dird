/**
 * Optic Disc Segmentation Updater
 *
 * Handles regeneration of optic disc masks when bbox is modified
 * and cascade deletion when detection is removed
 */

import { db } from '@/lib/db/schema';
import { generateOpticDiscMask, isOpenCVReady } from './optic-disc-refiner';

/**
 * Delete optic disc segmentation when detection is deleted
 */
export async function deleteOpticDiscSegmentation(
  detectionId: number
): Promise<void> {
  try {
    // Get the detection
    const detection = await db.detections.get(detectionId);

    if (!detection) {
      return;
    }

    // Only process optic_disc detections
    if (detection.class !== 'optic_disc' && detection.class !== 'optic disc') {
      return;
    }

    // Find and delete segmentations for this image's optic disc
    const segmentations = await db.segmentations
      .where('imageId')
      .equals(detection.imageId)
      .and(seg => seg.class === 'optic_disc' || seg.class === 'optic disc')
      .toArray();

    for (const seg of segmentations) {
      if (seg.id) {
        await db.segmentations.delete(seg.id);
      }
    }

    console.log('Deleted optic disc segmentation(s) for detection:', detectionId);

  } catch (error) {
    console.error('Error deleting optic disc segmentation:', error);
  }
}

/**
 * Regenerate optic disc segmentation when detection bbox is modified
 */
export async function updateOpticDiscSegmentation(
  imageElement: HTMLImageElement,
  detectionId: number,
  newBbox: { x: number; y: number; width: number; height: number }
): Promise<boolean> {

  if (!isOpenCVReady()) {
    console.warn('OpenCV not ready, cannot update optic disc segmentation');
    return false;
  }

  try {
    // Get the detection
    const detection = await db.detections.get(detectionId);

    if (!detection) {
      console.error('Detection not found:', detectionId);
      return false;
    }

    // Only process optic_disc detections
    if (detection.class !== 'optic_disc' && detection.class !== 'optic disc') {
      return false;
    }

    // Generate new mask with updated bbox
    const segmentation = await generateOpticDiscMask(
      imageElement,
      newBbox,
      detection.confidence || 0.5
    );

    if (!segmentation) {
      console.warn('Could not generate optic disc mask (ROI may be too dark or invalid)');
      return false;
    }

    // Find existing segmentation for this detection
    const existingSegmentations = await db.segmentations
      .where('imageId')
      .equals(detection.imageId)
      .and(seg => seg.class === 'optic_disc' || seg.class === 'optic disc')
      .toArray();

    // Delete old segmentation(s)
    for (const seg of existingSegmentations) {
      if (seg.id) {
        await db.segmentations.delete(seg.id);
      }
    }

    // Add new segmentation (copy type from detection)
    await db.segmentations.add({
      imageId: detection.imageId,
      type: detection.type, // 'ai' or 'manual' - copy from detection
      modelVersion: detection.modelVersion,
      maskData: segmentation.maskData,
      class: 'optic_disc',
      confidence: segmentation.circle.confidence,
      opacity: 0.4,
      visible: true,
      createdAt: new Date()
    });

    console.log('Updated optic disc segmentation for detection:', detectionId);
    return true;

  } catch (error) {
    console.error('Error updating optic disc segmentation:', error);
    return false;
  }
}
