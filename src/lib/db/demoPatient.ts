import { db } from './schema';
import type { Patient, Session } from './schema';
import imageCompression from 'browser-image-compression';
import { inferenceService } from '@/lib/ai/inference-service';
import { createCombinedSession } from './combinedSessions';
import i18n from '@/i18n/config';

// Identificador único del paciente demo
export const DEMO_PATIENT_ID = 'DEMO-001';

// Interfaz para el progreso de carga
export interface LoadingProgress {
  step: 'init' | 'patient' | 'model' | 'images' | 'report' | 'done';
  current: number;
  total: number;
  message: string;
}

// Tipo de callback de progreso
export type ProgressCallback = (progress: LoadingProgress) => void;

// IDs de las sesiones demo (se asignarán al crear)
export let DEMO_SESSION_FINAL_ID: number | null = null;
export let DEMO_SESSION_PREVIEW_ID: number | null = null;
export let DEMO_SESSION_COMPARISON_ID: number | null = null;

/**
 * Verifica si un paciente es el paciente demo
 */
export function isDemoPatient(patientId: string): boolean {
  return patientId === DEMO_PATIENT_ID;
}

/**
 * Verifica si una sesión es la sesión preview del demo
 */
export async function isDemoPreviewSession(sessionId: number): Promise<boolean> {
  if (DEMO_SESSION_PREVIEW_ID === null) {
    // Intentar obtener el ID de la sesión preview del demo
    const demoPatient = await db.patients.where('patientId').equals(DEMO_PATIENT_ID).first();
    if (demoPatient) {
      const sessions = await db.sessions.where('patientId').equals(demoPatient.id!).toArray();
      const previewSession = sessions.find(s => !s.locked);
      if (previewSession) {
        DEMO_SESSION_PREVIEW_ID = previewSession.id!;
      }
    }
  }
  return sessionId === DEMO_SESSION_PREVIEW_ID;
}

/**
 * Obtiene el paciente demo si existe
 */
export async function getDemoPatient(): Promise<Patient | undefined> {
  return await db.patients.where('patientId').equals(DEMO_PATIENT_ID).first();
}

/**
 * Verifica si el paciente demo ya existe
 */
export async function demoPatientExists(): Promise<boolean> {
  const patient = await getDemoPatient();
  return patient !== undefined;
}

/**
 * Obtiene todos los pacientes demo (útil para detectar duplicados)
 */
export async function getAllDemoPatients(): Promise<Patient[]> {
  return await db.patients.where('patientId').equals(DEMO_PATIENT_ID).toArray();
}

/**
 * Limpia pacientes demo duplicados, dejando solo uno
 */
export async function cleanDuplicateDemoPatients(): Promise<number> {
  const demoPatients = await getAllDemoPatients();

  if (demoPatients.length <= 1) {
    return 0;
  }

  // Ordenar por fecha de creación (el más antiguo primero)
  const sorted = demoPatients.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Mantener el primero (más antiguo), eliminar el resto
  const toDelete = sorted.slice(1);

  // Eliminar duplicados
  for (const patient of toDelete) {
    // Obtener sesiones del duplicado
    const sessions = await db.sessions.where('patientId').equals(patient.id!).toArray();
    const sessionIds = sessions.map(s => s.id!);

    if (sessionIds.length > 0) {
      // Obtener imágenes
      const images = await db.images.where('sessionId').anyOf(sessionIds).toArray();
      const imageIds = images.map(img => img.id!);

      if (imageIds.length > 0) {
        // Eliminar detecciones y segmentaciones
        await db.detections.where('imageId').anyOf(imageIds).delete();
        await db.segmentations.where('imageId').anyOf(imageIds).delete();
      }

      // Eliminar imágenes
      await db.images.where('sessionId').anyOf(sessionIds).delete();

      // Eliminar reportes
      await db.reports.where('sessionId').anyOf(sessionIds).delete();
    }

    // Eliminar sesiones
    await db.sessions.where('patientId').equals(patient.id!).delete();

    // Eliminar paciente
    await db.patients.delete(patient.id!);
  }

  return toDelete.length;
}

/**
 * Inicializa el paciente demo con sus sesiones e imágenes
 * Carga automáticamente todas las imágenes y detecciones desde /public/demo-images/
 */
export async function initializeDemoPatient(onProgress?: ProgressCallback): Promise<void> {
  // Verificar si ya se está inicializando para evitar duplicados
  const initFlag = localStorage.getItem('demo_patient_initializing');
  const initTimestamp = localStorage.getItem('demo_patient_init_timestamp');
  const now = Date.now();

  // Si hay un flag de inicialización y es reciente (menos de 2 minutos), salir
  if (initFlag === 'true' && initTimestamp) {
    const elapsed = now - parseInt(initTimestamp);
    if (elapsed < 120000) { // 2 minutos
      return;
    } else {
      // Si han pasado más de 2 minutos, asumir que falló y limpiar
      localStorage.removeItem('demo_patient_initializing');
      localStorage.removeItem('demo_patient_init_timestamp');
    }
  }

  // Primero limpiar duplicados si existen
  onProgress?.({
    step: 'init',
    current: 0,
    total: 1,
    message: i18n.t('demo.loading.steps.init'),
  });

  await cleanDuplicateDemoPatients();

  // Verificar si ya existe (después de limpiar duplicados)
  const exists = await demoPatientExists();
  if (exists) {
    onProgress?.({
      step: 'done',
      current: 1,
      total: 1,
      message: i18n.t('demo.loading.steps.done'),
    });
    return;
  }

  try {
    // Marcar como inicializando con timestamp
    localStorage.setItem('demo_patient_initializing', 'true');
    localStorage.setItem('demo_patient_init_timestamp', now.toString());

    onProgress?.({
      step: 'patient',
      current: 0,
      total: 1,
      message: i18n.t('demo.loading.steps.patient'),
    });

    await db.transaction('rw', [db.patients, db.sessions], async () => {
      const now = new Date();

    // Crear el paciente demo
    const demoPatientData: Omit<Patient, 'id'> = {
      patientId: DEMO_PATIENT_ID,
      name: 'Paciente Demo',
      dateOfBirth: new Date('1980-01-01'),
      status: 'active',
      diabetes: true,
      diabetesType: 'type2',
      diabetesDuration: 10,
      hta: true,
      dlp: true,
      medications: ['Metformina 850mg', 'Enalapril 10mg', 'Atorvastatina 20mg'],
      otherConditions: 'Paciente de demostración para propósitos educativos y de prueba del sistema DIRD.',
      metadata: {
        isDemo: true,
        createdBy: 'system',
        description: 'Paciente de demostración con dos sesiones normales y una sesión combinada para mostrar las funcionalidades del sistema, especialmente la comparación de sesiones.'
      },
      createdAt: now,
      updatedAt: now,
    };

    const patientId = await db.patients.add(demoPatientData as Patient);

    // Crear sesión 1: Inicialmente abierta (se bloqueará después de cargar el reporte)
    const session1Data: Omit<Session, 'id'> = {
      patientId,
      name: 'Sesión de Control - Finalizada',
      sessionNumber: 1,
      date: new Date(now.getFullYear(), now.getMonth() - 2, 15), // Hace 2 meses
      notes: 'Sesión de control inicial. Se observan múltiples lesiones que requieren seguimiento. Esta sesión está finalizada y sirve como referencia para comparaciones.',
      modelVersions: {
        detection: 'DIRDv1r1',
        segmentation: 'v1.0.0'
      },
      locked: false, // Inicialmente abierta para generar reporte
      createdAt: new Date(now.getFullYear(), now.getMonth() - 2, 15),
      updatedAt: now,
    };

    const session1Id = await db.sessions.add(session1Data as Session);
    DEMO_SESSION_FINAL_ID = session1Id;

    // Crear sesión 2: Preview (no bloqueada)
    const session2Data: Omit<Session, 'id'> = {
      patientId,
      name: 'Sesión de Seguimiento - Preview',
      sessionNumber: 2,
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7), // Hace 1 semana
      notes: 'Sesión de seguimiento. Esta sesión permanece en modo preview para demostrar las funcionalidades del sistema. Permite probar detecciones manuales, segmentaciones y generación de reportes preliminares.',
      modelVersions: {
        detection: 'DIRDv1r1',
        segmentation: 'v1.0.0'
      },
      locked: false,
      createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7),
      updatedAt: now,
    };

    const session2Id = await db.sessions.add(session2Data as Session);
    DEMO_SESSION_PREVIEW_ID = session2Id;

    });

    // Cargar el modelo AI de detección
    if (!inferenceService.isDetectionModelLoaded()) {
      try {
        onProgress?.({
          step: 'model',
          current: 0,
          total: 1,
          message: i18n.t('demo.loading.steps.model'),
        });

        await inferenceService.loadDetectionModel();

        onProgress?.({
          step: 'model',
          current: 1,
          total: 1,
          message: i18n.t('demo.loading.steps.modelLoaded'),
        });

      } catch (error) {
        // Continuar sin el modelo, no es crítico para la demo
      }
    }

    // Cargar imágenes demo automáticamente
    await loadAllDemoImages(onProgress);

    // Crear sesión combinada a partir de las sesiones 1 y 2
    try {
      if (DEMO_SESSION_FINAL_ID && DEMO_SESSION_PREVIEW_ID) {
        const demoPatient = await getDemoPatient();
        if (demoPatient) {
          const combinedSessionId = await createCombinedSession(
            demoPatient.id!,
            [DEMO_SESSION_FINAL_ID, DEMO_SESSION_PREVIEW_ID],
            'Sesión Combinada Demo - Evolución Temporal'
          );
          DEMO_SESSION_COMPARISON_ID = combinedSessionId;
        }
      }
    } catch (error) {
      // Error handling without logging
    }

    // Intentar cargar los reportes demo si existen
    try {
      onProgress?.({
        step: 'report',
        current: 0,
        total: 2,
        message: i18n.t('demo.loading.steps.report'),
      });
      await loadDemoReportAndLockSession();

      onProgress?.({
        step: 'report',
        current: 1,
        total: 2,
        message: i18n.t('demo.loading.steps.report'),
      });
      await loadDemoPreviewReport();
    } catch (error) {
      // Error handling without logging
    }

    // Finalizar
    onProgress?.({
      step: 'done',
      current: 1,
      total: 1,
      message: i18n.t('demo.loading.steps.done'),
    });

    // Pequeño delay para que el usuario vea el mensaje "Completado"
    await new Promise(resolve => setTimeout(resolve, 500));

  } catch (error) {
    throw error;
  } finally {
    // Limpiar flags de inicialización
    localStorage.removeItem('demo_patient_initializing');
    localStorage.removeItem('demo_patient_init_timestamp');
  }
}

/**
 * Interfaz para las detecciones exportadas (sin id ni imageId)
 */
interface ExportedDetection {
  type: 'ai' | 'manual';
  modelVersion?: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  class: string;
  confidence?: number;
  customLabel?: string;
  visible: boolean;
}

/**
 * Carga una imagen demo desde public/demo-images/ con sus detecciones
 */
export async function loadDemoImage(
  sessionNumber: 1 | 2,
  filename: string,
  eyeType: 'OI' | 'OD'
): Promise<void> {
  const demoPatient = await getDemoPatient();
  if (!demoPatient) {
    throw new Error('El paciente demo no existe. Ejecuta initializeDemoPatient() primero.');
  }

  const sessions = await db.sessions
    .where('patientId')
    .equals(demoPatient.id!)
    .toArray();

  const session = sessions.find(s => s.sessionNumber === sessionNumber);
  if (!session) {
    throw new Error(`Sesión ${sessionNumber} no encontrada en el paciente demo`);
  }

  try {
    // Verificar si la imagen ya existe en esta sesión
    const existingImage = await db.images
      .where('sessionId')
      .equals(session.id!)
      .and(img => img.filename === filename)
      .first();

    if (existingImage) {
      return;
    }

    // Determinar la ruta base según el entorno
    const basePath = import.meta.env.PROD ? '/dird' : '';
    const sessionFolder = sessionNumber === 1 ? 'session-1-final' : 'session-2-preview';

    // Cargar la imagen
    const imageUrl = `${basePath}/demo-images/${sessionFolder}/${filename}`;
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`No se pudo cargar la imagen: ${imageUrl}`);
    }
    const imageBlob = await imageResponse.blob();

    // Comprimir la imagen
    const imageFile = new File([imageBlob], filename, { type: 'image/png' });
    const compressedFile = await imageCompression(imageFile, {
      maxSizeMB: 1,
      maxWidthOrHeight: 2048,
    });

    // Obtener dimensiones
    const img = new Image();
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(compressedFile);
    });
    URL.revokeObjectURL(img.src);

    // Guardar imagen en la base de datos
    const imageId = await db.images.add({
      sessionId: session.id!,
      filename,
      eyeType,
      originalBlob: compressedFile,
      width: dimensions.width,
      height: dimensions.height,
      uploadedAt: new Date(),
      contributionStatus: 'none',
    });

    // Cargar detecciones desde JSON si existe
    const detectionsFilename = filename.replace('.png', '.json');
    const detectionsUrl = `${basePath}/demo-images/${sessionFolder}/${detectionsFilename}`;

    try {
      const detectionsResponse = await fetch(detectionsUrl);
      if (detectionsResponse.ok) {
        const exportedDetections: ExportedDetection[] = await detectionsResponse.json();

        // Crear detecciones en la base de datos
        for (const detection of exportedDetections) {
          await db.detections.add({
            imageId,
            type: detection.type,
            modelVersion: detection.modelVersion || 'DIRDv1r1',
            bbox: detection.bbox,
            class: detection.class,
            confidence: detection.confidence,
            customLabel: detection.customLabel,
            visible: detection.visible,
            createdAt: new Date(),
          });
        }
      } else {
        // Image loaded without detections
      }
    } catch (detectionError) {
      // Error handling without logging
    }

  } catch (error) {
    // Error handling without logging
    // No hacer throw para permitir que continúe con las demás imágenes
  }
}

/**
 * Carga todas las imágenes demo para ambas sesiones
 */
export async function loadAllDemoImages(onProgress?: ProgressCallback): Promise<void> {

  const imagesToLoad = [
    // Sesión 1 - Finalizada
    { session: 1 as 1 | 2, filename: 'OI-1.png', eyeType: 'OI' as 'OI' | 'OD' },
    { session: 1 as 1 | 2, filename: 'OI-2.png', eyeType: 'OI' as 'OI' | 'OD' },
    { session: 1 as 1 | 2, filename: 'OD-1.png', eyeType: 'OD' as 'OI' | 'OD' },
    { session: 1 as 1 | 2, filename: 'OD-2.png', eyeType: 'OD' as 'OI' | 'OD' },

    // Sesión 2 - Preview
    { session: 2 as 1 | 2, filename: 'OI-1.png', eyeType: 'OI' as 'OI' | 'OD' },
    { session: 2 as 1 | 2, filename: 'OI-2.png', eyeType: 'OI' as 'OI' | 'OD' },
    { session: 2 as 1 | 2, filename: 'OD-1.png', eyeType: 'OD' as 'OI' | 'OD' },
    { session: 2 as 1 | 2, filename: 'OD-2.png', eyeType: 'OD' as 'OI' | 'OD' },
  ];

  let successCount = 0;
  let errorCount = 0;

  // Cargar imágenes en paralelo (4 a la vez para no sobrecargar)
  const batchSize = 4;
  for (let i = 0; i < imagesToLoad.length; i += batchSize) {
    const batch = imagesToLoad.slice(i, i + batchSize);

    const promises = batch.map(async ({ session, filename, eyeType }, batchIndex) => {
      const currentIndex = i + batchIndex;
      try {
        onProgress?.({
          step: 'images',
          current: currentIndex,
          total: imagesToLoad.length,
          message: `${i18n.t('demo.loading.steps.images')} (${currentIndex + 1}/${imagesToLoad.length})`,
        });
        await loadDemoImage(session, filename, eyeType);
        successCount++;

        // Reportar progreso después de cargar cada imagen
        onProgress?.({
          step: 'images',
          current: currentIndex + 1,
          total: imagesToLoad.length,
          message: `${i18n.t('demo.loading.steps.images')} (${currentIndex + 1}/${imagesToLoad.length})`,
        });
      } catch (error) {
        console.error(`❌ Error al cargar ${filename}:`, error);
        errorCount++;
      }
    });

    await Promise.all(promises);
  }

}

/**
 * Carga el reporte preview demo de la sesión 2 (NO bloquea la sesión)
 */
export async function loadDemoPreviewReport(): Promise<void> {
  const demoPatient = await getDemoPatient();
  if (!demoPatient) {
    throw new Error('El paciente demo no existe');
  }

  const sessions = await db.sessions
    .where('patientId')
    .equals(demoPatient.id!)
    .toArray();

  const session2 = sessions.find(s => s.sessionNumber === 2);
  if (!session2) {
    throw new Error('Sesión 2 no encontrada');
  }

  // Verificar si ya tiene reporte
  const existingReport = await db.reports.where('sessionId').equals(session2.id!).first();
  if (existingReport) {
    return;
  }

  try {
    // Cargar el PDF desde public
    const basePath = import.meta.env.PROD ? '/dird' : '';
    const pdfUrl = `${basePath}/demo-reports/session-2-preview.pdf`;

    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`No se pudo cargar el PDF: ${pdfUrl}`);
    }

    const pdfBlob = await response.blob();

    // Crear el reporte preview en la base de datos (NO bloquear la sesión)
    await db.reports.add({
      sessionId: session2.id!,
      type: 'preview',
      reportCategory: 'single',
      pdfBlob,
      evaluatorNotes: `EVALUACIÓN OFTALMOLÓGICA - SESIÓN DE SEGUIMIENTO

Paciente de 45 años con diabetes mellitus tipo 2 e hipertensión arterial en seguimiento por retinopatía diabética.

EVOLUCIÓN:
Comparado con la sesión anterior (hace 2 meses), se observa estabilidad en los hallazgos principales. Control metabólico adecuado según refiere el paciente.

HALLAZGOS PRINCIPALES:
- Retinopatía diabética no proliferativa leve bilateral - sin cambios significativos
- Exudados duros en ambos ojos - distribución similar a control previo
- Microhemorragias dispersas - estables
- No se observan nuevas lesiones
- Disco óptico y mácula sin alteraciones estructurales

OJO DERECHO:
- Lesiones estables respecto a control previo
- Buena delimitación de lesiones existentes

OJO IZQUIERDO:
- Patrón similar al ojo derecho
- Sin signos de progresión

IMPRESIÓN DIAGNÓSTICA:
- Retinopatía diabética no proliferativa leve bilateral - ESTABLE
- Adecuado control metabólico actual

RECOMENDACIONES:
- Continuar con control estricto de glucemia (HbA1c < 7%)
- Mantener control de presión arterial
- Adherencia a tratamiento con Metformina, Enalapril y Atorvastatina
- Próximo control oftalmológico en 4-6 meses
- Acudir de urgencia si presenta: visión borrosa súbita, moscas volantes, destellos luminosos

NOTA: Este es un reporte PRELIMINAR generado para demostración. Permite visualizar los hallazgos antes de finalizar la sesión.`,
      areasOfInterest: [],
      generatedAt: new Date(session2.date.getFullYear(), session2.date.getMonth(), session2.date.getDate() + 1),
    });

  } catch (error) {
    throw error;
  }
}

/**
 * Carga el reporte PDF demo y bloquea la sesión 1
 */
export async function loadDemoReportAndLockSession(): Promise<void> {
  const demoPatient = await getDemoPatient();
  if (!demoPatient) {
    throw new Error('El paciente demo no existe');
  }

  const sessions = await db.sessions
    .where('patientId')
    .equals(demoPatient.id!)
    .toArray();

  const session1 = sessions.find(s => s.sessionNumber === 1);
  if (!session1) {
    throw new Error('Sesión 1 no encontrada');
  }

  // Verificar si ya tiene reporte
  const existingReport = await db.reports.where('sessionId').equals(session1.id!).first();
  if (existingReport) {
    // Asegurar que esté bloqueada
    if (!session1.locked) {
      await db.sessions.update(session1.id!, {
        locked: true,
        lockedAt: new Date(),
      });
    }
    return;
  }

  try {
    // Cargar el PDF desde public
    const basePath = import.meta.env.PROD ? '/dird' : '';
    const pdfUrl = `${basePath}/demo-reports/session-1-final.pdf`;

    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`No se pudo cargar el PDF: ${pdfUrl}`);
    }

    const pdfBlob = await response.blob();

    // Crear el reporte en la base de datos
    await db.reports.add({
      sessionId: session1.id!,
      type: 'final',
      reportCategory: 'single',
      pdfBlob,
      evaluatorNotes: 'Reporte de demostración generado automáticamente.',
      areasOfInterest: [],
      generatedAt: new Date(session1.date.getFullYear(), session1.date.getMonth(), session1.date.getDate() + 1),
    });

    // Bloquear la sesión
    await db.sessions.update(session1.id!, {
      locked: true,
      lockedAt: new Date(session1.date.getFullYear(), session1.date.getMonth(), session1.date.getDate() + 1),
    });

  } catch (error) {
    throw error;
  }
}

/**
 * Elimina el paciente demo (solo para desarrollo/testing)
 */
export async function removeDemoPatient(): Promise<void> {
  const patient = await getDemoPatient();
  if (!patient) {
    return;
  }

  await db.transaction('rw', [db.patients, db.sessions, db.images, db.detections, db.segmentations, db.reports], async () => {
    const sessions = await db.sessions.where('patientId').equals(patient.id!).toArray();
    const sessionIds = sessions.map(s => s.id!);

    if (sessionIds.length > 0) {
      const images = await db.images.where('sessionId').anyOf(sessionIds).toArray();
      const imageIds = images.map(img => img.id!);

      if (imageIds.length > 0) {
        await db.detections.where('imageId').anyOf(imageIds).delete();
        await db.segmentations.where('imageId').anyOf(imageIds).delete();
      }

      await db.images.where('sessionId').anyOf(sessionIds).delete();
      await db.reports.where('sessionId').anyOf(sessionIds).delete();
    }

    await db.sessions.where('patientId').equals(patient.id!).delete();
    await db.patients.delete(patient.id!);

    DEMO_SESSION_FINAL_ID = null;
    DEMO_SESSION_PREVIEW_ID = null;
    DEMO_SESSION_COMPARISON_ID = null;

  });
}
