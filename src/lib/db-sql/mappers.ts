import type {
  Patient,
  Session,
  Image,
  Detection,
  Segmentation,
  Report,
  Measurement,
  ImageClassification,
  PendingContribution,
} from '@/lib/db/schema';
import { P } from './client';
import type { TableMapper } from './shim';
import { intToBool, parseIsoDate } from './mapper';

function asDate(v: unknown): Date {
  return parseIsoDate(v) ?? new Date(0);
}
function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function asNumber(v: unknown): number {
  return typeof v === 'number' ? v : 0;
}
function maybeJSON<T>(v: unknown, fallback: T): T {
  if (typeof v !== 'string') return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}
function asBlob(v: unknown): Blob {
  if (v instanceof Blob) return v;
  if (v instanceof Uint8Array) return new Blob([v as BlobPart]);
  return new Blob();
}

async function blobToBytes(b: Blob): Promise<Uint8Array> {
  return new Uint8Array(await b.arrayBuffer());
}

// ----------------------- patients -----------------------

export const patientsMapper: TableMapper<Patient> = {
  insertColumns() {
    return [
      'patient_id', 'name', 'date_of_birth', 'status',
      'diabetes', 'diabetes_type', 'diabetes_duration',
      'hta', 'dlp', 'medications', 'other_conditions', 'metadata',
      'created_at', 'updated_at',
    ];
  },
  rowToObject(r): Patient {
    return {
      id: r.id as number,
      patientId: asString(r.patient_id),
      name: asString(r.name),
      dateOfBirth: asDate(r.date_of_birth),
      status: (r.status as Patient['status']) ?? 'active',
      diabetes: intToBool(r.diabetes),
      diabetesType: (r.diabetes_type as Patient['diabetesType']) ?? undefined,
      diabetesDuration: (r.diabetes_duration as number | null) ?? undefined,
      hta: intToBool(r.hta),
      dlp: intToBool(r.dlp),
      medications: maybeJSON<string[]>(r.medications, []),
      otherConditions: (r.other_conditions as string | null) ?? undefined,
      metadata: r.metadata ? maybeJSON<Record<string, any>>(r.metadata, {}) : undefined,
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  },
  objectToRow(o) {
    const row: Record<string, any> = {};
    if (o.patientId !== undefined) row.patient_id = P.text(o.patientId);
    if (o.name !== undefined) row.name = P.text(o.name);
    if (o.dateOfBirth !== undefined) row.date_of_birth = P.date(o.dateOfBirth);
    if (o.status !== undefined) row.status = P.text(o.status);
    if (o.diabetes !== undefined) row.diabetes = P.bool(o.diabetes);
    if ('diabetesType' in o) row.diabetes_type = o.diabetesType ? P.text(o.diabetesType) : P.null();
    if ('diabetesDuration' in o) row.diabetes_duration = o.diabetesDuration != null ? P.int(o.diabetesDuration) : P.null();
    if (o.hta !== undefined) row.hta = P.bool(o.hta);
    if (o.dlp !== undefined) row.dlp = P.bool(o.dlp);
    if (o.medications !== undefined) row.medications = P.json(o.medications);
    if ('otherConditions' in o) row.other_conditions = o.otherConditions ? P.text(o.otherConditions) : P.null();
    if ('metadata' in o) row.metadata = o.metadata ? P.json(o.metadata) : P.null();
    if (o.createdAt !== undefined) row.created_at = P.date(o.createdAt);
    row.updated_at = P.date(o.updatedAt ?? new Date());
    if (o.createdAt === undefined && !('created_at' in row)) row.created_at = P.date(new Date());
    return row;
  },
};

// ----------------------- sessions -----------------------

export const sessionsMapper: TableMapper<Session> = {
  insertColumns() {
    return [
      'patient_id', 'name', 'session_number', 'date', 'notes',
      'model_versions', 'locked', 'locked_at', 'type', 'combined_session_ids',
      'created_at', 'updated_at',
    ];
  },
  rowToObject(r): Session {
    return {
      id: r.id as number,
      patientId: asNumber(r.patient_id),
      name: (r.name as string | null) ?? undefined,
      sessionNumber: asNumber(r.session_number),
      date: asDate(r.date),
      notes: (r.notes as string | null) ?? undefined,
      modelVersions: maybeJSON<Session['modelVersions']>(r.model_versions, {}),
      locked: intToBool(r.locked),
      lockedAt: r.locked_at ? asDate(r.locked_at) : undefined,
      type: (r.type as Session['type']) ?? undefined,
      combinedSessionIds: r.combined_session_ids
        ? maybeJSON<number[]>(r.combined_session_ids, [])
        : undefined,
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  },
  objectToRow(o) {
    const row: Record<string, any> = {};
    if (o.patientId !== undefined) row.patient_id = P.int(o.patientId);
    if ('name' in o) row.name = o.name ? P.text(o.name) : P.null();
    if (o.sessionNumber !== undefined) row.session_number = P.int(o.sessionNumber);
    if (o.date !== undefined) row.date = P.date(o.date);
    if ('notes' in o) row.notes = o.notes ? P.text(o.notes) : P.null();
    if (o.modelVersions !== undefined) row.model_versions = P.json(o.modelVersions);
    if (o.locked !== undefined) row.locked = P.bool(o.locked);
    if ('lockedAt' in o) row.locked_at = o.lockedAt ? P.date(o.lockedAt) : P.null();
    if ('type' in o) row.type = o.type ? P.text(o.type) : P.null();
    if ('combinedSessionIds' in o)
      row.combined_session_ids = o.combinedSessionIds ? P.json(o.combinedSessionIds) : P.null();
    if (o.createdAt !== undefined) row.created_at = P.date(o.createdAt);
    row.updated_at = P.date(o.updatedAt ?? new Date());
    if (o.createdAt === undefined && !('created_at' in row)) row.created_at = P.date(new Date());
    return row;
  },
};

// ----------------------- images -----------------------

export const imagesMapper: TableMapper<Image> = {
  insertColumns() {
    return [
      'session_id', 'filename', 'eye_type', 'ord',
      'original_blob', 'processed_blob', 'width', 'height', 'uploaded_at',
    ];
  },
  rowToObject(r): Image {
    return {
      id: r.id as number,
      sessionId: asNumber(r.session_id),
      filename: asString(r.filename),
      eyeType: (r.eye_type as Image['eyeType']) ?? 'OD',
      order: (r.ord as number | null) ?? undefined,
      originalBlob: asBlob(r.original_blob),
      processedBlob: r.processed_blob ? asBlob(r.processed_blob) : undefined,
      width: asNumber(r.width),
      height: asNumber(r.height),
      uploadedAt: asDate(r.uploaded_at),
    };
  },
  objectToRow(o) {
    const row: Record<string, any> = {};
    if (o.sessionId !== undefined) row.session_id = P.int(o.sessionId);
    if (o.filename !== undefined) row.filename = P.text(o.filename);
    if (o.eyeType !== undefined) row.eye_type = P.text(o.eyeType);
    if ('order' in o) row.ord = o.order != null ? P.int(o.order) : P.null();
    // Los Blobs se convierten en bytes mediante un truco: el mapper es síncrono,
    // así que aquí guardamos un placeholder reconocible. El llamador que persiste
    // imágenes debe usar `addImageWithBlob()` del helper.
    if (o.originalBlob !== undefined) {
      throw new Error('Usa images.addImage()/updateImageBlob() para persistir Blobs');
    }
    if (o.width !== undefined) row.width = P.int(o.width);
    if (o.height !== undefined) row.height = P.int(o.height);
    if (o.uploadedAt !== undefined) row.uploaded_at = P.date(o.uploadedAt);
    return row;
  },
};

/** Helper específico para insertar imágenes con BLOB. */
export async function imageToRowWithBlobs(o: Partial<Image>): Promise<Record<string, any>> {
  const row = imagesMapper.objectToRow({ ...o, originalBlob: undefined as any });
  if (o.originalBlob) {
    row.original_blob = P.blob(await blobToBytes(o.originalBlob));
  }
  if (o.processedBlob) {
    row.processed_blob = P.blob(await blobToBytes(o.processedBlob));
  } else {
    row.processed_blob = P.null();
  }
  return row;
}

// ----------------------- detections -----------------------

export const detectionsMapper: TableMapper<Detection> = {
  insertColumns() {
    return [
      'image_id', 'type', 'model_version',
      'bbox_x', 'bbox_y', 'bbox_width', 'bbox_height',
      'class', 'confidence', 'custom_label', 'visible', 'metadata', 'created_at',
    ];
  },
  rowToObject(r): Detection {
    return {
      id: r.id as number,
      imageId: asNumber(r.image_id),
      type: (r.type as Detection['type']) ?? 'manual',
      modelVersion: (r.model_version as string | null) ?? undefined,
      bbox: {
        x: asNumber(r.bbox_x),
        y: asNumber(r.bbox_y),
        width: asNumber(r.bbox_width),
        height: asNumber(r.bbox_height),
      },
      class: asString(r.class),
      confidence: (r.confidence as number | null) ?? undefined,
      customLabel: (r.custom_label as string | null) ?? undefined,
      visible: intToBool(r.visible),
      metadata: r.metadata ? maybeJSON<Record<string, any>>(r.metadata, {}) : undefined,
      createdAt: asDate(r.created_at),
    };
  },
  objectToRow(o) {
    const row: Record<string, any> = {};
    if (o.imageId !== undefined) row.image_id = P.int(o.imageId);
    if (o.type !== undefined) row.type = P.text(o.type);
    if ('modelVersion' in o) row.model_version = o.modelVersion ? P.text(o.modelVersion) : P.null();
    if (o.bbox !== undefined) {
      row.bbox_x = P.real(o.bbox.x);
      row.bbox_y = P.real(o.bbox.y);
      row.bbox_width = P.real(o.bbox.width);
      row.bbox_height = P.real(o.bbox.height);
    }
    if (o.class !== undefined) row.class = P.text(o.class);
    if ('confidence' in o) row.confidence = o.confidence != null ? P.real(o.confidence) : P.null();
    if ('customLabel' in o) row.custom_label = o.customLabel ? P.text(o.customLabel) : P.null();
    if (o.visible !== undefined) row.visible = P.bool(o.visible);
    if ('metadata' in o) row.metadata = o.metadata ? P.json(o.metadata) : P.null();
    if (o.createdAt !== undefined) row.created_at = P.date(o.createdAt);
    if (!('created_at' in row)) row.created_at = P.date(new Date());
    return row;
  },
};

// ----------------------- segmentations -----------------------

export const segmentationsMapper: TableMapper<Segmentation> = {
  insertColumns() {
    return [
      'image_id', 'type', 'model_version',
      'mask_data', 'class', 'confidence', 'custom_label',
      'opacity', 'visible', 'created_at',
    ];
  },
  rowToObject(r): Segmentation {
    return {
      id: r.id as number,
      imageId: asNumber(r.image_id),
      type: (r.type as Segmentation['type']) ?? 'manual',
      modelVersion: (r.model_version as string | null) ?? undefined,
      maskData: asString(r.mask_data),
      class: asString(r.class),
      confidence: (r.confidence as number | null) ?? undefined,
      customLabel: (r.custom_label as string | null) ?? undefined,
      opacity: asNumber(r.opacity),
      visible: intToBool(r.visible),
      createdAt: asDate(r.created_at),
    };
  },
  objectToRow(o) {
    const row: Record<string, any> = {};
    if (o.imageId !== undefined) row.image_id = P.int(o.imageId);
    if (o.type !== undefined) row.type = P.text(o.type);
    if ('modelVersion' in o) row.model_version = o.modelVersion ? P.text(o.modelVersion) : P.null();
    if (o.maskData !== undefined) row.mask_data = P.text(o.maskData);
    if (o.class !== undefined) row.class = P.text(o.class);
    if ('confidence' in o) row.confidence = o.confidence != null ? P.real(o.confidence) : P.null();
    if ('customLabel' in o) row.custom_label = o.customLabel ? P.text(o.customLabel) : P.null();
    if (o.opacity !== undefined) row.opacity = P.real(o.opacity);
    if (o.visible !== undefined) row.visible = P.bool(o.visible);
    if (o.createdAt !== undefined) row.created_at = P.date(o.createdAt);
    if (!('created_at' in row)) row.created_at = P.date(new Date());
    return row;
  },
};

// ----------------------- reports -----------------------

export const reportsMapper: TableMapper<Report> = {
  insertColumns() {
    return [
      'session_id', 'type', 'report_category', 'pdf_blob',
      'evaluator_notes', 'original_notes', 'areas_of_interest',
      'preview_viewed', 'preview_downloaded', 'conclusion_edited',
      'generated_at',
    ];
  },
  rowToObject(r): Report {
    return {
      id: r.id as number,
      sessionId: asNumber(r.session_id),
      type: (r.type as Report['type']) ?? 'preview',
      reportCategory: (r.report_category as Report['reportCategory']) ?? 'single',
      pdfBlob: asBlob(r.pdf_blob),
      evaluatorNotes: asString(r.evaluator_notes),
      originalNotes: (r.original_notes as string | null) ?? undefined,
      areasOfInterest: maybeJSON<Report['areasOfInterest']>(r.areas_of_interest, []),
      previewViewed: intToBool(r.preview_viewed),
      previewDownloaded: intToBool(r.preview_downloaded),
      conclusionEdited: intToBool(r.conclusion_edited),
      generatedAt: asDate(r.generated_at),
    };
  },
  objectToRow(o) {
    const row: Record<string, any> = {};
    if (o.sessionId !== undefined) row.session_id = P.int(o.sessionId);
    if (o.type !== undefined) row.type = P.text(o.type);
    if (o.reportCategory !== undefined) row.report_category = P.text(o.reportCategory);
    if (o.pdfBlob !== undefined) {
      throw new Error('Usa reports.addReport()/updateReportBlob() para persistir PDFs');
    }
    if (o.evaluatorNotes !== undefined) row.evaluator_notes = P.text(o.evaluatorNotes);
    if ('originalNotes' in o) row.original_notes = o.originalNotes ? P.text(o.originalNotes) : P.null();
    if (o.areasOfInterest !== undefined) row.areas_of_interest = P.json(o.areasOfInterest);
    if (o.previewViewed !== undefined) row.preview_viewed = P.bool(o.previewViewed);
    if (o.previewDownloaded !== undefined) row.preview_downloaded = P.bool(o.previewDownloaded);
    if (o.conclusionEdited !== undefined) row.conclusion_edited = P.bool(o.conclusionEdited);
    if (o.generatedAt !== undefined) row.generated_at = P.date(o.generatedAt);
    if (!('generated_at' in row)) row.generated_at = P.date(new Date());
    return row;
  },
};

export async function reportToRowWithBlob(o: Partial<Report>): Promise<Record<string, any>> {
  const row = reportsMapper.objectToRow({ ...o, pdfBlob: undefined as any });
  if (o.pdfBlob) {
    row.pdf_blob = P.blob(await blobToBytes(o.pdfBlob));
  }
  return row;
}

// ----------------------- measurements -----------------------

export const measurementsMapper: TableMapper<Measurement> = {
  insertColumns() {
    return [
      'image_id', 'origin_x', 'origin_y', 'destination_x', 'destination_y',
      'distance_pixels', 'distance_dd', 'visible', 'created_at',
    ];
  },
  rowToObject(r): Measurement {
    return {
      id: r.id as number,
      imageId: asNumber(r.image_id),
      originX: asNumber(r.origin_x),
      originY: asNumber(r.origin_y),
      destinationX: asNumber(r.destination_x),
      destinationY: asNumber(r.destination_y),
      distancePixels: asNumber(r.distance_pixels),
      distanceDD: (r.distance_dd as number | null) ?? undefined,
      visible: intToBool(r.visible),
      createdAt: asDate(r.created_at),
    };
  },
  objectToRow(o) {
    const row: Record<string, any> = {};
    if (o.imageId !== undefined) row.image_id = P.int(o.imageId);
    if (o.originX !== undefined) row.origin_x = P.real(o.originX);
    if (o.originY !== undefined) row.origin_y = P.real(o.originY);
    if (o.destinationX !== undefined) row.destination_x = P.real(o.destinationX);
    if (o.destinationY !== undefined) row.destination_y = P.real(o.destinationY);
    if (o.distancePixels !== undefined) row.distance_pixels = P.real(o.distancePixels);
    if ('distanceDD' in o) row.distance_dd = o.distanceDD != null ? P.real(o.distanceDD) : P.null();
    if (o.visible !== undefined) row.visible = P.bool(o.visible);
    if (o.createdAt !== undefined) row.created_at = P.date(o.createdAt);
    if (!('created_at' in row)) row.created_at = P.date(new Date());
    return row;
  },
};

// ----------------------- imageClassifications -----------------------

export const imageClassificationsMapper: TableMapper<ImageClassification> = {
  insertColumns() {
    return [
      'image_id', 'eye_type', 'eye_type_detection_method',
      'severity', 'confidence', 'lesions',
      'quadrant_analysis_data', 'quadrant_lesions_data',
      'criteria', 'used_quadrant_analysis', 'warnings',
      'guideline', 'guideline_name', 'guideline_version',
      'treatments', 'followup_days', 'urgency', 'rationale',
      'manually_modified', 'created_at', 'updated_at',
    ];
  },
  rowToObject(r): ImageClassification {
    return {
      id: r.id as number,
      imageId: asNumber(r.image_id),
      eyeType: (r.eye_type as ImageClassification['eyeType']) ?? 'unknown',
      eyeTypeDetectionMethod: (r.eye_type_detection_method as ImageClassification['eyeTypeDetectionMethod']) ?? 'unknown',
      severity: asString(r.severity),
      confidence: (r.confidence as ImageClassification['confidence']) ?? 'low',
      lesions: maybeJSON<ImageClassification['lesions']>(r.lesions, {
        microaneurysms: 0, hemorrhages: 0, hardExudates: 0, softExudates: 0, neovascularization: 0,
      }),
      quadrantAnalysisData: asString(r.quadrant_analysis_data),
      quadrantLesionsData: asString(r.quadrant_lesions_data),
      criteria: maybeJSON<string[]>(r.criteria, []),
      usedQuadrantAnalysis: intToBool(r.used_quadrant_analysis),
      warnings: maybeJSON<string[]>(r.warnings, []),
      guideline: (r.guideline as string | null) ?? undefined,
      guidelineName: (r.guideline_name as string | null) ?? undefined,
      guidelineVersion: (r.guideline_version as string | null) ?? undefined,
      treatments: r.treatments ? maybeJSON<string[]>(r.treatments, []) : undefined,
      followupDays: (r.followup_days as number | null) ?? undefined,
      urgency: (r.urgency as ImageClassification['urgency']) ?? undefined,
      rationale: (r.rationale as string | null) ?? undefined,
      manuallyModified: intToBool(r.manually_modified),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  },
  objectToRow(o) {
    const row: Record<string, any> = {};
    if (o.imageId !== undefined) row.image_id = P.int(o.imageId);
    if (o.eyeType !== undefined) row.eye_type = P.text(o.eyeType);
    if (o.eyeTypeDetectionMethod !== undefined) row.eye_type_detection_method = P.text(o.eyeTypeDetectionMethod);
    if (o.severity !== undefined) row.severity = P.text(o.severity);
    if (o.confidence !== undefined) row.confidence = P.text(o.confidence);
    if (o.lesions !== undefined) row.lesions = P.json(o.lesions);
    if (o.quadrantAnalysisData !== undefined) row.quadrant_analysis_data = P.text(o.quadrantAnalysisData);
    if (o.quadrantLesionsData !== undefined) row.quadrant_lesions_data = P.text(o.quadrantLesionsData);
    if (o.criteria !== undefined) row.criteria = P.json(o.criteria);
    if (o.usedQuadrantAnalysis !== undefined) row.used_quadrant_analysis = P.bool(o.usedQuadrantAnalysis);
    if (o.warnings !== undefined) row.warnings = P.json(o.warnings);
    if ('guideline' in o) row.guideline = o.guideline ? P.text(o.guideline) : P.null();
    if ('guidelineName' in o) row.guideline_name = o.guidelineName ? P.text(o.guidelineName) : P.null();
    if ('guidelineVersion' in o) row.guideline_version = o.guidelineVersion ? P.text(o.guidelineVersion) : P.null();
    if ('treatments' in o) row.treatments = o.treatments ? P.json(o.treatments) : P.null();
    if ('followupDays' in o) row.followup_days = o.followupDays != null ? P.int(o.followupDays) : P.null();
    if ('urgency' in o) row.urgency = o.urgency ? P.text(o.urgency) : P.null();
    if ('rationale' in o) row.rationale = o.rationale ? P.text(o.rationale) : P.null();
    if (o.manuallyModified !== undefined) row.manually_modified = P.bool(o.manuallyModified);
    if (o.createdAt !== undefined) row.created_at = P.date(o.createdAt);
    row.updated_at = P.date(o.updatedAt ?? new Date());
    if (!('created_at' in row)) row.created_at = P.date(new Date());
    return row;
  },
};

// ----------------------- pendingContributions -----------------------

export const pendingContributionsMapper: TableMapper<PendingContribution> = {
  insertColumns() {
    return ['type', 'reference_id', 'status', 'metadata', 'created_at'];
  },
  rowToObject(r): PendingContribution {
    return {
      id: r.id as number,
      type: (r.type as PendingContribution['type']) ?? 'image',
      referenceId: asNumber(r.reference_id),
      status: (r.status as PendingContribution['status']) ?? 'pending',
      metadata: r.metadata ? maybeJSON<Record<string, any>>(r.metadata, {}) : undefined,
      createdAt: asDate(r.created_at),
    };
  },
  objectToRow(o) {
    const row: Record<string, any> = {};
    if (o.type !== undefined) row.type = P.text(o.type);
    if (o.referenceId !== undefined) row.reference_id = P.int(o.referenceId);
    if (o.status !== undefined) row.status = P.text(o.status);
    if ('metadata' in o) row.metadata = o.metadata ? P.json(o.metadata) : P.null();
    if (o.createdAt !== undefined) row.created_at = P.date(o.createdAt);
    if (!('created_at' in row)) row.created_at = P.date(new Date());
    return row;
  },
};
