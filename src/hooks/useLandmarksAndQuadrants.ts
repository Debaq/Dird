import { useState, useEffect, useMemo } from 'react';
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

  // Load landmarks from detections (AI) and manual placements (from database)
  useEffect(() => {
    loadLandmarks();
  }, [imageId, detections]);

  const loadLandmarks = async () => {
    const newLandmarks: Landmark[] = [];

    // 1. Load landmarks from AI detections
    for (const detection of detections) {
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
  };

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
    // Check if landmark of this type already exists
    const existingLandmark = landmarks.find(
      (l) => l.type === type && l.source === 'manual'
    );

    if (existingLandmark) {
      // Update existing landmark
      await updateLandmark(existingLandmark.id, x, y, radius);
    } else {
      // Create new landmark
      const landmarkDetection = await db.detections.add({
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

      // Add to local state
      setLandmarks((prev) => [
        ...prev,
        {
          id: `manual-${type}-${landmarkDetection}`,
          type,
          x,
          y,
          radius,
          source: 'manual',
          visible: true,
        },
      ]);
    }
  };

  // Update landmark position
  const updateLandmark = async (landmarkId: string, x: number, y: number, radius?: number) => {
    // Extract database ID from landmark ID
    const match = landmarkId.match(/manual-.*-(\d+)/);
    if (!match) return;

    const dbId = parseInt(match[1]);
    const landmark = landmarks.find((l) => l.id === landmarkId);
    if (!landmark) return;

    const newRadius = radius || landmark.radius;

    // Update in database
    await db.detections.update(dbId, {
      bbox: {
        x: x - newRadius,
        y: y - newRadius,
        width: newRadius * 2,
        height: newRadius * 2,
      },
    });

    // Update local state
    setLandmarks((prev) =>
      prev.map((l) =>
        l.id === landmarkId ? { ...l, x, y, radius: newRadius } : l
      )
    );
  };

  // Delete a landmark
  const deleteLandmark = async (landmarkId: string) => {
    // Extract database ID
    const match = landmarkId.match(/manual-.*-(\d+)/);
    if (!match) return;

    const dbId = parseInt(match[1]);

    // Delete from database
    await db.detections.delete(dbId);

    // Update local state
    setLandmarks((prev) => prev.filter((l) => l.id !== landmarkId));
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
