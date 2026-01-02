import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Landmark, LandmarkType } from '@/types/annotations';
import type { Detection } from '@/lib/db/schema';
import { db } from '@/lib/db/schema';
import { quadrantCalculator, QuadrantAnalysis } from '@/lib/analysis/quadrant-calculator';

interface UseLandmarksAndQuadrantsProps {
  imageId: number;
  imageWidth: number;
  imageHeight: number;
  detections: Detection[];
}

export function useLandmarksAndQuadrants({
  imageId,
  imageWidth,
  imageHeight,
  detections,
}: UseLandmarksAndQuadrantsProps) {
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [selectedLandmarkType, setSelectedLandmarkType] = useState<LandmarkType>('optic_disc');

  const loadLandmarks = useCallback(async () => {
    const newLandmarks: Landmark[] = [];

    // 1. Load landmarks from AI detections
    for (const detection of detections) {
      // Skip if class is not defined
      if (!detection.class || typeof detection.class !== 'string') {
        continue;
      }

      const detClass = detection.class.toLowerCase().trim();
      if (detClass === 'optic_disc' || detClass === 'optic disc') {
        newLandmarks.push({
          id: `ai-od-${detection.id}`,
          type: 'optic_disc',
          x: detection.bbox.x + detection.bbox.width / 2,
          y: detection.bbox.y + detection.bbox.height / 2,
          radius: Math.max(detection.bbox.width, detection.bbox.height) / 2,
          source: 'ai',
          confidence: detection.confidence,
          visible: detection.visible,
        });
      } else if (detClass === 'fovea') {
        newLandmarks.push({
          id: `ai-fovea-${detection.id}`,
          type: 'fovea',
          x: detection.bbox.x + detection.bbox.width / 2,
          y: detection.bbox.y + detection.bbox.height / 2,
          radius: Math.max(detection.bbox.width, detection.bbox.height) / 2,
          source: 'ai',
          confidence: detection.confidence,
          visible: detection.visible,
        });
      }
    }

    // 2. Load manual landmarks from database (stored as detections with type='manual')
    const manualLandmarks = await db.detections
      .where('imageId')
      .equals(imageId)
      .and((d) => d.type === 'manual' && (d.class === 'optic_disc' || d.class === 'fovea'))
      .toArray();

    for (const landmark of manualLandmarks) {
      newLandmarks.push({
        id: `manual-${landmark.class}-${landmark.id}`,
        type: landmark.class as LandmarkType,
        x: landmark.bbox.x + landmark.bbox.width / 2,
        y: landmark.bbox.y + landmark.bbox.height / 2,
        radius: Math.max(landmark.bbox.width, landmark.bbox.height) / 2,
        source: 'manual',
        visible: landmark.visible,
      });
    }

    setLandmarks(newLandmarks);
  }, [imageId, detections]);

  // Load landmarks from detections (AI) and manual placements (from database)
  useEffect(() => {
    loadLandmarks();
  }, [loadLandmarks]);

  // Calculate quadrant analysis
  const quadrantAnalysis: QuadrantAnalysis | null = useMemo(() => {
    if (detections.length === 0 || imageWidth === 0 || imageHeight === 0) {
      return null;
    }

    // Convert detections to the format expected by quadrantCalculator
    const detectionsForAnalysis = detections.map(d => ({
      bbox: d.bbox,
      class: d.class,
      confidence: d.confidence || 0,
      classIndex: 0, // Not used in quadrant analysis
    }));

    return quadrantCalculator.analyzeQuadrants(
      detectionsForAnalysis,
      imageWidth,
      imageHeight
    );
  }, [detections, imageWidth, imageHeight]);

  // Add or update a landmark
  const addOrUpdateLandmark = async (
    type: LandmarkType,
    x: number,
    y: number,
    radius: number = 30
  ) => {
    // Check if landmark of this type already exists (AI or manual)
    const existingLandmark = landmarks.find((l) => l.type === type);

    if (existingLandmark) {
      // Get the existing radius to maintain size
      const existingRadius = existingLandmark.radius;

      // Update existing landmark (will convert to manual if it was AI)
      await updateLandmark(existingLandmark.id, x, y, existingRadius);
    } else {
      // Create new landmark
      await db.detections.add({
        imageId,
        type: 'manual',
        bbox: {
          x: x - radius,
          y: y - radius,
          width: radius * 2,
          height: radius * 2,
        },
        class: type,
        visible: true,
        createdAt: new Date(),
      });

      // Reload landmarks to get the new one from database
      await loadLandmarks();
    }
  };

  // Update landmark position
  const updateLandmark = async (landmarkId: string, x: number, y: number, radius?: number) => {
    // Extract database ID from landmark ID (can be AI or manual)
    const manualMatch = landmarkId.match(/manual-.*-(\d+)/);
    const aiMatch = landmarkId.match(/ai-.*-(\d+)/);
    const match = manualMatch || aiMatch;

    if (!match) return;

    const dbId = parseInt(match[1]);
    const landmark = landmarks.find((l) => l.id === landmarkId);
    if (!landmark) return;

    const newRadius = radius || landmark.radius;

    // Update in database - convert to manual type if it was AI
    await db.detections.update(dbId, {
      type: 'manual',
      bbox: {
        x: x - newRadius,
        y: y - newRadius,
        width: newRadius * 2,
        height: newRadius * 2,
      },
    });

    // Reload landmarks to reflect the changes from database
    await loadLandmarks();
  };

  // Delete a landmark
  const deleteLandmark = async (landmarkId: string) => {
    // Extract database ID (can be AI or manual)
    const manualMatch = landmarkId.match(/manual-.*-(\d+)/);
    const aiMatch = landmarkId.match(/ai-.*-(\d+)/);
    const match = manualMatch || aiMatch;

    if (!match) return;

    const dbId = parseInt(match[1]);

    // Delete from database
    await db.detections.delete(dbId);

    // Reload landmarks to reflect the deletion
    await loadLandmarks();
  };

  return {
    landmarks,
    selectedLandmarkType,
    setSelectedLandmarkType,
    quadrantAnalysis,
    addOrUpdateLandmark,
    updateLandmark,
    deleteLandmark,
    reloadLandmarks: loadLandmarks,
  };
}
