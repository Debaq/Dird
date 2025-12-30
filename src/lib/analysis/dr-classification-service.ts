/**
 * DR Classification Service
 * Integrates the DR classifier with database queries
 */

import { db } from '../db/schema';
import { useConfigStore } from '@/stores/config-store';
import {
  classifyDiabeticRetinopathy,
  formatClassificationText,
  type DRClassification
} from './dr-classifier';
import { logger } from '@/utils/logger';

/**
 * Classify DR for a specific session
 */
export async function classifySessionDR(sessionId: number): Promise<DRClassification | null> {
  try {
    // Get session
    const session = await db.sessions.get(sessionId);
    if (!session) {
      logger.database.error('Session not found', { sessionId });
      return null;
    }

    // Get patient
    const patient = await db.patients.get(session.patientId);
    if (!patient) {
      logger.database.error('Patient not found', { patientId: session.patientId });
      return null;
    }

    // Get all images for this session
    const images = await db.images
      .where('sessionId')
      .equals(sessionId)
      .toArray();

    if (images.length === 0) {
      logger.drClassification.warn('No images found for session', { sessionId });
      return null;
    }

    // Get detections for all images, grouped by eye
    const detectionsByEye = new Map<'OD' | 'OI', any[]>();

    for (const image of images) {
      if (!image.id) continue;

      const detections = await db.detections
        .where('imageId')
        .equals(image.id)
        .toArray();

      const eyeType = image.eyeType;
      const existing = detectionsByEye.get(eyeType) || [];
      detectionsByEye.set(eyeType, [...existing, ...detections]);
    }

    // Get active guideline
    const activeGuideline = useConfigStore.getState().config.activeGuideline;

    // Perform classification
    const classification = await classifyDiabeticRetinopathy(detectionsByEye, patient, activeGuideline);

    // Log results
    logger.drClassification.log('DR Classification Result', {
      sessionId,
      patient: patient.name,
      sessionDate: session.date,
      classification: formatClassificationText(classification),
      rawData: classification
    });

    return classification;
  } catch (error) {
    logger.drClassification.error('Error classifying DR', error);
    return null;
  }
}

/**
 * Classify DR for a specific patient (latest session)
 */
export async function classifyPatientDR(patientId: number): Promise<DRClassification | null> {
  try {
    // Get latest session for this patient
    const sessions = await db.sessions
      .where('patientId')
      .equals(patientId)
      .reverse()
      .sortBy('date');

    if (sessions.length === 0) {
      logger.database.warn('No sessions found for patient', { patientId });
      return null;
    }

    const latestSession = sessions[0];
    if (!latestSession.id) {
      logger.database.error('Session has no ID');
      return null;
    }

    return await classifySessionDR(latestSession.id);
  } catch (error) {
    logger.drClassification.error('Error classifying patient DR', error);
    return null;
  }
}

/**
 * Compare classifications across multiple sessions for a patient
 */
export async function compareSessionClassifications(
  sessionIds: number[]
): Promise<DRClassification[]> {
  const classifications: DRClassification[] = [];

  for (const sessionId of sessionIds) {
    const classification = await classifySessionDR(sessionId);
    if (classification) {
      classifications.push(classification);
    }
  }

  // Log comparison
  if (classifications.length > 1) {
    const comparisonData = classifications.map((c, idx) => ({
      sessionNumber: idx + 1,
      date: new Date(c.timestamp).toLocaleDateString(),
      overall: c.overallSeverity,
      OD: c.rightEye?.severity,
      OI: c.leftEye?.severity
    }));

    logger.drClassification.log('Temporal Comparison', { sessions: comparisonData });
  }

  return classifications;
}

/**
 * Get classification statistics for all patients
 */
export async function getGlobalStatistics(): Promise<{
  totalPatients: number;
  classificationCounts: Record<string, number>;
  highRiskPatients: number;
}> {
  const patients = await db.patients.toArray();
  const stats = {
    totalPatients: patients.length,
    classificationCounts: {
      no_dr: 0,
      mild_npdr: 0,
      moderate_npdr: 0,
      severe_npdr: 0,
      pdr: 0
    },
    highRiskPatients: 0
  };

  for (const patient of patients) {
    if (!patient.id) continue;

    const classification = await classifyPatientDR(patient.id);
    if (classification) {
      stats.classificationCounts[classification.overallSeverity]++;

      // High risk: severe NPDR or PDR
      if (classification.overallSeverity === 'severe_npdr' ||
          classification.overallSeverity === 'pdr') {
        stats.highRiskPatients++;
      }
    }
  }

  logger.drClassification.log('Global DR Statistics', stats);

  return stats;
}

/**
 * Export classification to JSON file (for external systems)
 */
export function exportClassificationJSON(classification: DRClassification): string {
  return JSON.stringify({
    version: '1.0.0',
    classification,
    exportedAt: new Date().toISOString(),
    disclaimer: 'This is an AI-assisted classification suggestion. Clinical correlation required.'
  }, null, 2);
}
