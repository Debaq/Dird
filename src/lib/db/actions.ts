import { db, Session, Image, Detection, Segmentation, Report } from './schema';

export async function duplicateSession(sessionId: number): Promise<number> {
  let newSessionId: number | undefined;

  await db.transaction('rw', [db.sessions, db.images, db.detections, db.segmentations, db.reports], async () => {
    // 1. Get original session and related data
    const originalSession = await db.sessions.get(sessionId);
    if (!originalSession) {
      throw new Error('Session not found');
    }

    const originalImages = await db.images.where('sessionId').equals(sessionId).toArray();
    const originalImageIds = originalImages.map(img => img.id!);

    const originalDetections = await db.detections.where('imageId').anyOf(originalImageIds).toArray();
    const originalSegmentations = await db.segmentations.where('imageId').anyOf(originalImageIds).toArray();
    const originalReports = await db.reports.where('sessionId').equals(sessionId).toArray();

    // 2. Create new session
    const now = new Date();
    const existingSessions = await db.sessions.where('patientId').equals(originalSession.patientId).toArray();
    const newSessionNumber = existingSessions.length + 1;

    const newSessionData: Omit<Session, 'id'> = {
      ...originalSession,
      name: `Copia de ${originalSession.name || `Sesión ${originalSession.sessionNumber}`}`,
      sessionNumber: newSessionNumber,
      locked: false,
      // Mantener la misma fecha que el original, no la fecha de duplicación
      date: originalSession.date,
      createdAt: now,
      updatedAt: now,
    };
    // remove id from data
    delete (newSessionData as any).id;

    newSessionId = await db.sessions.add(newSessionData as Session);

    // 3. Create new images and map old IDs to new IDs
    const imageIdMap = new Map<number, number>();
    if (newSessionId) {
      for (const image of originalImages) {
        const originalImageId = image.id!;
        const newImageData: Omit<Image, 'id'> = {
          ...image,
          sessionId: newSessionId,
        };
        delete (newImageData as any).id;

        const newImageId = await db.images.add(newImageData as Image);
        imageIdMap.set(originalImageId, newImageId);
      }
    }

    // 4. Create new detections and segmentations
    for (const detection of originalDetections) {
      const newImageId = imageIdMap.get(detection.imageId);
      if (newImageId) {
        const newDetectionData: Omit<Detection, 'id'> = {
          ...detection,
          imageId: newImageId,
        };
        delete (newDetectionData as any).id;
        await db.detections.add(newDetectionData as Detection);
      }
    }

    for (const segmentation of originalSegmentations) {
      const newImageId = imageIdMap.get(segmentation.imageId);
      if (newImageId) {
        const newSegmentationData: Omit<Segmentation, 'id'> = {
          ...segmentation,
          imageId: newImageId,
        };
        delete (newSegmentationData as any).id;
        await db.segmentations.add(newSegmentationData as Segmentation);
      }
    }

    // 5. Create new reports, converting 'final' reports to 'preview' if session was locked
    if (newSessionId) {
      for (const report of originalReports) {
        const newReportData: Omit<Report, 'id'> = {
          ...report,
          sessionId: newSessionId,
          // Si la sesión original estaba bloqueada, convertir los informes finales a preliminares
          type: originalSession.locked ? 'preview' : report.type,
        };
        delete (newReportData as any).id;
        await db.reports.add(newReportData as Report);
      }
    }
  });

  if (newSessionId === undefined) {
    throw new Error('Failed to create new session');
  }

  return newSessionId;
}

export async function deletePatient(patientId: number): Promise<void> {
  await db.transaction('rw', [db.patients, db.sessions, db.images], async () => {
    // 1. Get all sessions for the patient
    const sessionsToDelete = await db.sessions.where('patientId').equals(patientId).toArray();
    const sessionIds = sessionsToDelete.map(s => s.id!);

    if (sessionIds.length > 0) {
      // 2. Get all images for these sessions
      const imagesToDelete = await db.images.where('sessionId').anyOf(sessionIds).toArray();
      const imageIds = imagesToDelete.map(img => img.id!);

      if (imageIds.length > 0) {
        // 3. Delete all detections and segmentations for these images
        await db.detections.where('imageId').anyOf(imageIds).delete();
        await db.segmentations.where('imageId').anyOf(imageIds).delete();
      }

      // 4. Delete all images
      await db.images.where('sessionId').anyOf(sessionIds).delete();
    }

    // 6. Delete all sessions
    await db.sessions.where('patientId').equals(patientId).delete();

    // 7. Delete the patient
    await db.patients.delete(patientId);
  });
}

export async function updateImageEyeType(imageId: number, newEyeType: 'OI' | 'OD'): Promise<void> {
  await db.images.update(imageId, { eyeType: newEyeType });
}
