import { db, Session, Image, Detection, Segmentation } from './schema';

/**
 * Crea una nueva sesión combinada a partir de múltiples sesiones existentes
 *
 * @param patientId - ID del paciente
 * @param sessionIds - IDs de las sesiones a combinar (deben ser al menos 2)
 * @param name - Nombre opcional para la sesión combinada
 * @returns ID de la nueva sesión combinada creada
 */
export async function createCombinedSession(
  patientId: number,
  sessionIds: number[],
  name?: string
): Promise<number> {
  if (sessionIds.length < 2) {
    throw new Error('Se requieren al menos 2 sesiones para crear una sesión combinada');
  }

  // Obtener todas las sesiones a combinar
  const sessions = await Promise.all(
    sessionIds.map(id => db.sessions.get(id))
  );

  // Verificar que todas las sesiones existen y pertenecen al mismo paciente
  const validSessions = sessions.filter((s): s is Session => s !== undefined);
  if (validSessions.length !== sessionIds.length) {
    throw new Error('Una o más sesiones no existen');
  }

  if (validSessions.some(s => s.patientId !== patientId)) {
    throw new Error('Todas las sesiones deben pertenecer al mismo paciente');
  }

  // Ordenar sesiones por fecha
  validSessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Obtener el número de sesión más alto del paciente
  const patientSessions = await db.sessions
    .where('patientId')
    .equals(patientId)
    .toArray();

  const maxSessionNumber = Math.max(...patientSessions.map(s => s.sessionNumber), 0);

  // Crear la nueva sesión combinada
  const now = new Date();
  const sessionName = name || `Sesión Combinada - ${validSessions.map(s => s.sessionNumber).join(', ')}`;

  const combinedSessionData: Omit<Session, 'id'> = {
    patientId,
    name: sessionName,
    sessionNumber: maxSessionNumber + 1,
    date: now,
    notes: `Sesión combinada creada a partir de las sesiones: ${validSessions.map(s => `#${s.sessionNumber} (${new Date(s.date).toLocaleDateString()})`).join(', ')}`,
    modelVersions: {
      detection: validSessions[0].modelVersions.detection,
      segmentation: validSessions[0].modelVersions.segmentation,
    },
    locked: false,
    type: 'combined',
    combinedSessionIds: sessionIds,
    createdAt: now,
    updatedAt: now,
  };

  const combinedSessionId = await db.sessions.add(combinedSessionData as Session);

  // Copiar todas las imágenes de las sesiones originales a la nueva sesión combinada
  for (const session of validSessions) {
    const images = await db.images
      .where('sessionId')
      .equals(session.id!)
      .toArray();

    for (const image of images) {
      // Crear una copia de la imagen en la nueva sesión
      const newImageData: Omit<Image, 'id'> = {
        sessionId: combinedSessionId,
        filename: `S${session.sessionNumber}_${image.filename}`, // Prefijo para identificar la sesión original
        eyeType: image.eyeType,
        originalBlob: image.originalBlob,
        processedBlob: image.processedBlob,
        width: image.width,
        height: image.height,
        uploadedAt: now,
      };

      const newImageId = await db.images.add(newImageData as Image);

      // Copiar las detecciones de la imagen original
      const detections = await db.detections
        .where('imageId')
        .equals(image.id!)
        .toArray();

      for (const detection of detections) {
        const newDetectionData: Omit<Detection, 'id'> = {
          imageId: newImageId,
          type: detection.type,
          modelVersion: detection.modelVersion,
          bbox: { ...detection.bbox },
          class: detection.class,
          confidence: detection.confidence,
          customLabel: detection.customLabel,
          visible: detection.visible,
          createdAt: now,
        };

        await db.detections.add(newDetectionData as Detection);
      }

      // Copiar las segmentaciones de la imagen original
      const segmentations = await db.segmentations
        .where('imageId')
        .equals(image.id!)
        .toArray();

      for (const segmentation of segmentations) {
        const newSegmentationData: Omit<Segmentation, 'id'> = {
          imageId: newImageId,
          type: segmentation.type,
          modelVersion: segmentation.modelVersion,
          maskData: segmentation.maskData,
          class: segmentation.class,
          confidence: segmentation.confidence,
          customLabel: segmentation.customLabel,
          opacity: segmentation.opacity,
          visible: segmentation.visible,
          createdAt: now,
        };

        await db.segmentations.add(newSegmentationData as Segmentation);
      }
    }
  }

  return combinedSessionId;
}

/**
 * Verifica si una sesión es una sesión combinada
 */
export function isCombinedSession(session: Session): boolean {
  return session.type === 'combined';
}

/**
 * Obtiene las sesiones originales que componen una sesión combinada
 */
export async function getOriginalSessions(combinedSession: Session): Promise<Session[]> {
  if (!isCombinedSession(combinedSession) || !combinedSession.combinedSessionIds) {
    return [];
  }

  const sessions = await Promise.all(
    combinedSession.combinedSessionIds.map(id => db.sessions.get(id))
  );

  return sessions.filter((s): s is Session => s !== undefined);
}
