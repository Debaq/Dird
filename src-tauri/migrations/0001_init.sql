-- DIRD+ v2.0 SQLCipher schema
-- Equivalente a Dexie v16 (src/lib/db/schema.ts).
-- Tipos: TEXT para fechas ISO-8601 y enums, BLOB para imágenes/PDFs, INTEGER para flags 0/1.
-- JSON-blobs se almacenan como TEXT.

PRAGMA foreign_keys = ON;

CREATE TABLE patients (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id      TEXT    NOT NULL UNIQUE,
  name            TEXT    NOT NULL,
  date_of_birth   TEXT    NOT NULL,
  status          TEXT    NOT NULL CHECK (status IN ('active','archived')),
  diabetes        INTEGER NOT NULL DEFAULT 0,
  diabetes_type   TEXT    CHECK (diabetes_type IN ('type1','type2','gestational','other') OR diabetes_type IS NULL),
  diabetes_duration INTEGER,
  hta             INTEGER NOT NULL DEFAULT 0,
  dlp             INTEGER NOT NULL DEFAULT 0,
  medications     TEXT    NOT NULL DEFAULT '[]',
  other_conditions TEXT,
  metadata        TEXT,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);
CREATE INDEX idx_patients_patient_id ON patients(patient_id);
CREATE INDEX idx_patients_status     ON patients(status);
CREATE INDEX idx_patients_created_at ON patients(created_at);

CREATE TABLE sessions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name            TEXT,
  session_number  INTEGER NOT NULL,
  date            TEXT    NOT NULL,
  notes           TEXT,
  model_versions  TEXT    NOT NULL DEFAULT '{}',
  locked          INTEGER NOT NULL DEFAULT 0,
  locked_at       TEXT,
  type            TEXT    CHECK (type IN ('normal','combined') OR type IS NULL),
  combined_session_ids TEXT,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);
CREATE INDEX idx_sessions_patient_id     ON sessions(patient_id);
CREATE INDEX idx_sessions_session_number ON sessions(session_number);
CREATE INDEX idx_sessions_date           ON sessions(date);
CREATE INDEX idx_sessions_locked         ON sessions(locked);
CREATE INDEX idx_sessions_type           ON sessions(type);

CREATE TABLE images (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  filename        TEXT    NOT NULL,
  eye_type        TEXT    NOT NULL CHECK (eye_type IN ('OI','OD')),
  ord             INTEGER,
  original_blob   BLOB    NOT NULL,
  processed_blob  BLOB,
  width           INTEGER NOT NULL,
  height          INTEGER NOT NULL,
  uploaded_at     TEXT    NOT NULL
);
CREATE INDEX idx_images_session_id  ON images(session_id);
CREATE INDEX idx_images_eye_type    ON images(eye_type);
CREATE INDEX idx_images_uploaded_at ON images(uploaded_at);

CREATE TABLE detections (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id        INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  type            TEXT    NOT NULL CHECK (type IN ('ai','manual')),
  model_version   TEXT,
  bbox_x          REAL    NOT NULL,
  bbox_y          REAL    NOT NULL,
  bbox_width      REAL    NOT NULL,
  bbox_height     REAL    NOT NULL,
  class           TEXT    NOT NULL,
  confidence      REAL,
  custom_label    TEXT,
  visible         INTEGER NOT NULL DEFAULT 1,
  metadata        TEXT,
  created_at      TEXT    NOT NULL
);
CREATE INDEX idx_detections_image_id ON detections(image_id);
CREATE INDEX idx_detections_type     ON detections(type);
CREATE INDEX idx_detections_class    ON detections(class);
CREATE INDEX idx_detections_visible  ON detections(visible);

CREATE TABLE segmentations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id        INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  type            TEXT    NOT NULL CHECK (type IN ('ai','manual')),
  model_version   TEXT,
  mask_data       TEXT    NOT NULL,
  class           TEXT    NOT NULL,
  confidence      REAL,
  custom_label    TEXT,
  opacity         REAL    NOT NULL DEFAULT 0.5,
  visible         INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT    NOT NULL
);
CREATE INDEX idx_segmentations_image_id ON segmentations(image_id);
CREATE INDEX idx_segmentations_type     ON segmentations(type);
CREATE INDEX idx_segmentations_class    ON segmentations(class);
CREATE INDEX idx_segmentations_visible  ON segmentations(visible);

CREATE TABLE reports (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id       INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type             TEXT    NOT NULL CHECK (type IN ('preview','final')),
  report_category  TEXT    NOT NULL CHECK (report_category IN ('single','combined')),
  pdf_blob         BLOB    NOT NULL,
  evaluator_notes  TEXT    NOT NULL DEFAULT '',
  original_notes   TEXT,
  areas_of_interest TEXT   NOT NULL DEFAULT '[]',
  preview_viewed   INTEGER NOT NULL DEFAULT 0,
  preview_downloaded INTEGER NOT NULL DEFAULT 0,
  conclusion_edited INTEGER NOT NULL DEFAULT 0,
  generated_at     TEXT    NOT NULL,
  UNIQUE(session_id, type)
);
CREATE INDEX idx_reports_session_id     ON reports(session_id);
CREATE INDEX idx_reports_type           ON reports(type);
CREATE INDEX idx_reports_category       ON reports(report_category);
CREATE INDEX idx_reports_generated_at   ON reports(generated_at);

CREATE TABLE measurements (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id        INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  origin_x        REAL    NOT NULL,
  origin_y        REAL    NOT NULL,
  destination_x   REAL    NOT NULL,
  destination_y   REAL    NOT NULL,
  distance_pixels REAL    NOT NULL,
  distance_dd     REAL,
  visible         INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT    NOT NULL
);
CREATE INDEX idx_measurements_image_id   ON measurements(image_id);
CREATE INDEX idx_measurements_visible    ON measurements(visible);
CREATE INDEX idx_measurements_created_at ON measurements(created_at);

CREATE TABLE image_classifications (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id          INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  eye_type          TEXT    NOT NULL CHECK (eye_type IN ('OD','OI','unknown')),
  eye_type_detection_method TEXT NOT NULL CHECK (eye_type_detection_method IN ('manual','auto','unknown')),
  severity          TEXT    NOT NULL,
  confidence        TEXT    NOT NULL CHECK (confidence IN ('low','moderate','high')),
  lesions           TEXT    NOT NULL,
  quadrant_analysis_data TEXT NOT NULL DEFAULT '{}',
  quadrant_lesions_data  TEXT NOT NULL DEFAULT '{}',
  criteria          TEXT    NOT NULL DEFAULT '[]',
  used_quadrant_analysis INTEGER NOT NULL DEFAULT 0,
  warnings          TEXT    NOT NULL DEFAULT '[]',
  guideline         TEXT,
  guideline_name    TEXT,
  guideline_version TEXT,
  treatments        TEXT,
  followup_days     INTEGER,
  urgency           TEXT    CHECK (urgency IN ('routine','accelerated','urgent') OR urgency IS NULL),
  rationale         TEXT,
  manually_modified INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL
);
CREATE INDEX idx_image_classifications_image_id  ON image_classifications(image_id);
CREATE INDEX idx_image_classifications_eye_type  ON image_classifications(eye_type);
CREATE INDEX idx_image_classifications_severity  ON image_classifications(severity);
CREATE INDEX idx_image_classifications_guideline ON image_classifications(guideline);
CREATE INDEX idx_image_classifications_urgency   ON image_classifications(urgency);
CREATE INDEX idx_image_classifications_manually_modified ON image_classifications(manually_modified);

CREATE TABLE pending_contributions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  type            TEXT    NOT NULL CHECK (type IN ('image','guideline','conclusion')),
  reference_id    INTEGER NOT NULL,
  status          TEXT    NOT NULL CHECK (status IN ('pending','submitted')),
  metadata        TEXT,
  created_at      TEXT    NOT NULL,
  UNIQUE(type, reference_id)
);
CREATE INDEX idx_pending_contributions_status     ON pending_contributions(status);
CREATE INDEX idx_pending_contributions_created_at ON pending_contributions(created_at);

-- Tabla de metadatos del schema (versionado, flags de migración).
CREATE TABLE meta (
  key             TEXT    PRIMARY KEY,
  value           TEXT    NOT NULL
);
INSERT INTO meta (key, value) VALUES ('schema_version', '1');
INSERT INTO meta (key, value) VALUES ('created_at', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
