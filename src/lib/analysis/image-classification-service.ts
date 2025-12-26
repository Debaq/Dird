/**
 * Image Classification Service
 * Manages saving and retrieving DR classifications per image
 */

import { db } from '../db/schema';
import type { ImageClassification } from '../db/schema';
import { classifyImageDR, type ImageDRClassification } from './image-dr-classifier';

/**
 * Save or update classification for an image
 */
export async function saveImageClassification(
  classification: ImageDRClassification
): Promise<number> {
  const now = new Date();

  // Check if classification already exists
  const existing = await db.imageClassifications
    .where('imageId')
    .equals(classification.imageId)
    .first();

  const record: ImageClassification = {
    imageId: classification.imageId,
    eyeType: classification.eyeType,
    eyeTypeDetectionMethod: classification.eyeTypeDetectionMethod,
    severity: classification.severity,
    confidence: classification.confidence,
    lesions: classification.lesions,
    quadrantAnalysisData: JSON.stringify(classification.quadrantAnalysis),
    quadrantLesionsData: JSON.stringify(classification.quadrantLesions),
    criteria: classification.criteria,
    usedQuadrantAnalysis: classification.usedQuadrantAnalysis,
    warnings: classification.warnings,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  if (existing) {
    // Update
    await db.imageClassifications.update(existing.id!, record);
    return existing.id!;
  } else {
    // Create
    return await db.imageClassifications.add(record);
  }
}

/**
 * Get classification for an image
 */
export async function getImageClassification(
  imageId: number
): Promise<ImageDRClassification | null> {
  const record = await db.imageClassifications
    .where('imageId')
    .equals(imageId)
    .first();

  if (!record) return null;

  return {
    imageId: record.imageId,
    eyeType: record.eyeType,
    eyeTypeDetectionMethod: record.eyeTypeDetectionMethod,
    severity: record.severity,
    confidence: record.confidence,
    lesions: record.lesions,
    quadrantAnalysis: JSON.parse(record.quadrantAnalysisData),
    quadrantLesions: JSON.parse(record.quadrantLesionsData),
    criteria: record.criteria,
    usedQuadrantAnalysis: record.usedQuadrantAnalysis,
    warnings: record.warnings,
    timestamp: record.updatedAt.toISOString()
  };
}

/**
 * Classify and save an image
 */
export async function classifyAndSaveImage(
  imageId: number
): Promise<ImageDRClassification | null> {
  try {
    // Get image
    const image = await db.images.get(imageId);
    if (!image) {
      console.error('Image not found:', imageId);
      return null;
    }

    // Get detections
    const detections = await db.detections
      .where('imageId')
      .equals(imageId)
      .toArray();

    // Classify (auto-detection happens inside classifyImageDR)
    const classification = await classifyImageDR(
      imageId,
      detections,
      image.width,
      image.height,
      image.eyeType // Passed as fallback only
    );

    // Update image.eyeType in DB if auto-detected successfully
    if (classification.eyeTypeDetectionMethod === 'auto' &&
        classification.eyeType !== 'unknown' &&
        image.eyeType !== classification.eyeType) {
      await db.images.update(imageId, {
        eyeType: classification.eyeType as 'OD' | 'OI'
      });
      console.log(`🔄 Auto-detected and updated image eyeType: "${image.eyeType}" → "${classification.eyeType}"`);
    }

    // Save classification
    await saveImageClassification(classification);

    // Log to console
    console.log('\n' + '='.repeat(80));
    console.log(`DR CLASSIFICATION - Image ${imageId} (${image.filename})`);
    console.log('='.repeat(80));
    console.log(`Eye: ${classification.eyeType} (${classification.eyeTypeDetectionMethod})`);
    console.log(`Severity: ${classification.severity}`);
    console.log(`Confidence: ${classification.confidence}`);
    console.log(`Used Quadrant Analysis: ${classification.usedQuadrantAnalysis}`);
    console.log(`\nLesions:`, classification.lesions);
    console.log(`\nCriteria:`, classification.criteria);
    if (classification.warnings.length > 0) {
      console.log(`\nWarnings:`, classification.warnings);
    }
    console.log('\n' + '='.repeat(80) + '\n');

    return classification;
  } catch (error) {
    console.error('Error classifying image:', error);
    return null;
  }
}

/**
 * Get all classifications for a session
 */
export async function getSessionClassifications(
  sessionId: number
): Promise<ImageDRClassification[]> {
  // Get all images in session
  const images = await db.images
    .where('sessionId')
    .equals(sessionId)
    .toArray();

  const classifications: ImageDRClassification[] = [];

  for (const image of images) {
    if (!image.id) continue;
    const classification = await getImageClassification(image.id);
    if (classification) {
      classifications.push(classification);
    }
  }

  return classifications;
}

/**
 * Classify all images in a session
 */
export async function classifySessionImages(
  sessionId: number
): Promise<ImageDRClassification[]> {
  const images = await db.images
    .where('sessionId')
    .equals(sessionId)
    .toArray();

  const classifications: ImageDRClassification[] = [];

  for (const image of images) {
    if (!image.id) continue;
    const classification = await classifyAndSaveImage(image.id);
    if (classification) {
      classifications.push(classification);
    }
  }

  console.log(`\nClassified ${classifications.length} images in session ${sessionId}\n`);

  return classifications;
}

/**
 * Delete classification for an image
 */
export async function deleteImageClassification(imageId: number): Promise<void> {
  const existing = await db.imageClassifications
    .where('imageId')
    .equals(imageId)
    .first();

  if (existing && existing.id) {
    await db.imageClassifications.delete(existing.id);
  }
}
