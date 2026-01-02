/**
 * Canvas Constants
 * Centralized configuration for canvas behavior and performance tuning
 */

// ============================================================================
// DEBOUNCING & DELAYS
// ============================================================================

/** Delay before database update during keyboard movements (ms) */
export const DEBOUNCE_DB_UPDATE_MS = 500;

/** Delay before running heavy post-processing (optic disc refinement, DR re-classification) (ms) */
export const DEBOUNCE_POST_PROCESSING_MS = 2500;

/** Delay to ensure Konva finishes rendering before showing detections (ms) */
export const CANVAS_READY_DELAY_MS = 100;

// ============================================================================
// BBOX & ANNOTATION CONSTRAINTS
// ============================================================================

/** Minimum bbox size in pixels (prevents accidental tiny annotations) */
export const MIN_BBOX_SIZE_PX = 5;

/** Minimum size threshold for zoom level (smaller when zoomed in) */
export const MIN_BBOX_SIZE_ZOOM_DIVISOR = 1;

/** Hit stroke width for better bbox selection */
export const BBOX_HIT_STROKE_WIDTH = 10;

/** Default landmark radius when creating new landmarks (pixels) */
export const DEFAULT_LANDMARK_RADIUS = 30;

// ============================================================================
// ZOOM & PAN
// ============================================================================

/** Minimum zoom level (1.0 = fit to container) */
export const MIN_ZOOM_SCALE = 1.0;

/** Maximum zoom level */
export const MAX_ZOOM_SCALE = 5.0;

/** Zoom factor for mouse wheel */
export const ZOOM_WHEEL_FACTOR = 0.9;

/** Zoom factor for click-to-zoom tool */
export const ZOOM_CLICK_FACTOR = 1.5;

/** Threshold to consider zoom active (slightly above 1.0 for float precision) */
export const ZOOM_ACTIVE_THRESHOLD = 1.1;

/** Margin factor when zooming to bbox (larger = more context around bbox) */
export const ZOOM_TO_BBOX_MARGIN_FACTOR = 2.5;

/** Margin factor when zooming to landmark (larger for more context) */
export const ZOOM_TO_LANDMARK_MARGIN_FACTOR = 2.0;

/** Minimum zoom when zooming to specific bbox */
export const ZOOM_TO_BBOX_MIN_SCALE = 1.5;

// ============================================================================
// KEYBOARD MOVEMENT
// ============================================================================

/** Pixels to move bbox with arrow keys (normal) */
export const KEYBOARD_MOVE_DELTA_NORMAL = 1;

/** Pixels to move bbox with arrow keys (shift pressed for faster movement) */
export const KEYBOARD_MOVE_DELTA_FAST = 10;

// ============================================================================
// VISUAL STYLING
// ============================================================================

/** Stroke width for hovered detections */
export const HOVERED_STROKE_WIDTH = 3;

/** Stroke width for normal detections */
export const NORMAL_STROKE_WIDTH = 1.5;

/** Stroke width for manual annotations */
export const MANUAL_STROKE_WIDTH = 1;

/** Hover color for detections */
export const HOVER_COLOR = "#FFD700";

/** Label font size */
export const LABEL_FONT_SIZE = 10;

/** Label padding */
export const LABEL_PADDING = 6;

/** Label height */
export const LABEL_HEIGHT = 16;

/** Opacity for segmentation masks */
export const SEGMENTATION_OPACITY = 0.4;

// ============================================================================
// LAYER Z-INDEX (for Konva Layer ordering)
// ============================================================================

export const LAYER_Z_INDEX = {
  IMAGE: 0,
  SEGMENTATIONS: 1,
  DETECTIONS: 2,
  MEASUREMENTS: 3,
  OVERLAYS: 4, // quadrants, macular zones, etc.
  TRANSFORMER: 5,
} as const;

// ============================================================================
// MEASUREMENT
// ============================================================================

/** Circle radius for measurement origin/destination markers (base size) */
export const MEASUREMENT_MARKER_RADIUS = 6;

/** Stroke width for measurement markers */
export const MEASUREMENT_MARKER_STROKE_WIDTH = 2;

/** Hit stroke width for measurement line (easier clicking) */
export const MEASUREMENT_LINE_HIT_WIDTH = 15;

/** Measurement line stroke width */
export const MEASUREMENT_LINE_STROKE_WIDTH = 3;

/** Measurement text font size */
export const MEASUREMENT_TEXT_FONT_SIZE = 14;

/** Measurement text stroke width (outline) */
export const MEASUREMENT_TEXT_STROKE_WIDTH = 3;

// ============================================================================
// COLORS
// ============================================================================

export const COLORS = {
  MEASUREMENT_SELECTED: "#f59e0b",
  MEASUREMENT_NORMAL: "#10b981",
  MEASUREMENT_IN_PROGRESS: "#3b82f6",
  LANDMARK_OPTIC_DISC: "#FF6B6B",
  LANDMARK_OPTIC_DISC_STROKE: "#E63946",
  LANDMARK_FOVEA: "#4ECDC4",
  LANDMARK_FOVEA_STROKE: "#2A9D8F",
  MANUAL_ANNOTATION_DEFAULT: "#FF6B6B",
  NEW_ANNOTATION: "#FF6B6B",
  PENDING_ANNOTATION: "#20B5AE",
} as const;
