import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';
import { Stage, Layer, Image as KonvaImage, Transformer } from 'react-konva';
import type { Image as ImageType, Detection } from '@/lib/db/schema';
import type { HistoryEntry } from '@/types/annotations';
import type { CanvasTool } from './ToolPanel';
import type { CanvasLayer } from './LayerControls';
import { db } from '@/lib/db/schema';
import { classManager } from '@/lib/classes/class-manager';
import ClassSelectionModal from './ClassSelectionModal';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasQuickClassSelector } from './CanvasQuickClassSelector';
import { AnnotationsCanvasLayer } from './layers/AnnotationsCanvasLayer';
import { OverlaysCanvasLayer } from './layers/OverlaysCanvasLayer';
import { useConfigStore } from '@/stores/config-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { inferenceService } from '@/lib/ai/inference-service';
import { updateOpticDiscSegmentation, deleteOpticDiscSegmentation } from '@/lib/ai/optic-disc-updater';
import { useLandmarksAndQuadrants } from '@/hooks/useLandmarksAndQuadrants';
import { classifyAndSaveImage } from '@/lib/analysis/image-classification-service';
import { calibrateFromOpticDisc, createFallbackCalibration } from '@/lib/analysis/spatial-calibrator';
import { detectMacularEdema, findFovea, findHardExudates } from '@/lib/analysis/macular-edema-detector';
import * as CANVAS from './canvas-constants';

interface AnnotationCanvasProps {
  image: ImageType;
  detections?: any[];
  manualAnnotations?: any[];
  segmentations?: any[];
  manualSegmentations?: any[];
  measurements?: any[];
  activeTool?: CanvasTool;
  layers?: CanvasLayer[];
  onLayerUpdate?: (layerId: string, updates: Partial<CanvasLayer>) => void;
  onAnnotationAdded?: () => void;
  selectedLandmarkType?: 'optic_disc' | 'fovea';
  selectedMeasurementId?: number | null;
  onSelectMeasurement?: (id: number | null) => void;
  processedImageCanvas?: HTMLCanvasElement | null;
  showOriginalOverlay?: boolean;
  comparisonOpacity?: number;
  history?: {
    entries: HistoryEntry[];
    index: number;
    onAdd: (entry: HistoryEntry) => void;
    onUndo: () => void;
    onRedo: () => void;
  };
}

const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({
  image,
  detections = [],
  manualAnnotations = [],
  segmentations = [],
  manualSegmentations = [],
  measurements = [],
  activeTool = 'select',
  layers = [],
  onLayerUpdate,
  onAnnotationAdded,
  selectedLandmarkType = 'optic_disc',
  selectedMeasurementId,
  onSelectMeasurement,
  processedImageCanvas,
  showOriginalOverlay = false,
  comparisonOpacity = 0.5,
  history,
}) => {
  const { t } = useTranslation();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const { config } = useConfigStore();
  const { selectedAnnotationId, setSelectedAnnotation, showClassList, preSelectedClass, setPreSelectedClass } = useCanvasStore();
  const rainbowMode = config.appearance.rainbowMode; // Subscribe to rainbow mode changes

  // Key único para forzar re-mount cuando cambian detecciones o rainbow mode
  const [canvasKey, setCanvasKey] = useState(0);

  // CRÍTICO: Solo mostrar detecciones cuando todo esté listo
  const [isCanvasReady, setIsCanvasReady] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const [konvaImage, setKonvaImage] = useState<HTMLImageElement | null>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [segmentationImages, setSegmentationImages] = useState<Map<number, HTMLImageElement>>(new Map());
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [newAnnotation, setNewAnnotation] = useState<any>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [pendingAnnotation, setPendingAnnotation] = useState<any>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<Array<{ name: string; displayName: string; color: string }>>([]);

  // State for ruler tool
  const [rulerOrigin, setRulerOrigin] = useState<{ x: number; y: number } | null>(null);
  const [rulerDestination, setRulerDestination] = useState<{ x: number; y: number } | null>(null);

  // Temporary state for live measurement updates during drag
  const [tempMeasurementUpdates, setTempMeasurementUpdates] = useState<Map<number, { originX: number; originY: number; destinationX: number; destinationY: number }>>(new Map());

  // State for drag/move operations history optimization
  const dragStartAnnotation = useRef<any>(null);
  const isKeyboardMoving = useRef(false);
  const lastKeyboardPos = useRef<{ x: number, y: number, width: number, height: number } | null>(null);

  // Landmarks and quadrant analysis
  const {
    landmarks,
    addOrUpdateLandmark,
  } = useLandmarksAndQuadrants({
    imageId: image.id!,
    imageWidth: konvaImage?.width || 0,
    imageHeight: konvaImage?.height || 0,
    detections,
  });

  // Create a revision key that changes when relevant detection properties change
  // This ensures macular edema recalculates when fovea moves or hard exudates change
  // Uses the same detection logic as macular-edema-detector for consistency
  const macularEdemaRevisionKey = useMemo(() => {
    // Combine ALL detections (AI + manual) for consistency
    const allDetections = [...(detections || []), ...(manualAnnotations || [])];

    if (allDetections.length === 0) {
      return 'empty';
    }

    // Use the same functions from macular-edema-detector to ensure consistency
    const fovea = findFovea(allDetections);
    const hardExudates = findHardExudates(allDetections);

    const opticDisc = allDetections.find(d =>
      d.class && typeof d.class === 'string' &&
      ['optic_disc', 'optic disc'].includes(d.class.toLowerCase().trim())
    );

    // Create a key that includes positions of relevant detections
    const parts: string[] = [];

    if (fovea) {
      parts.push(`fovea:${fovea.bbox.x.toFixed(2)},${fovea.bbox.y.toFixed(2)},${fovea.bbox.width.toFixed(2)},${fovea.bbox.height.toFixed(2)}`);
    }

    if (opticDisc) {
      parts.push(`disc:${opticDisc.bbox.x.toFixed(2)},${opticDisc.bbox.y.toFixed(2)},${opticDisc.bbox.width.toFixed(2)},${opticDisc.bbox.height.toFixed(2)}`);
    }

    parts.push(`exudates:${hardExudates.length}`);
    hardExudates.forEach((ex, idx) => {
      parts.push(`ex${idx}:${ex.bbox.x.toFixed(2)},${ex.bbox.y.toFixed(2)}`);
    });

    return parts.join('|');
  }, [detections, manualAnnotations]);

  // Calculate macular edema data in real-time
  const macularEdemaData = useMemo(() => {
    // Combine AI detections and manual annotations into a single array
    const allDetections = [...(detections || []), ...(manualAnnotations || [])];

    // Only calculate if we have detections and konva image
    if (allDetections.length === 0 || !konvaImage) {
      return null;
    }

    try {
      // Find fovea from ALL detections (AI + manual)
      const fovea = findFovea(allDetections);
      if (!fovea) {
        return null; // No fovea, can't detect edema
      }

      // Find optic disc for calibration (from all detections)
      const opticDisc = allDetections.find(d =>
        d.class && typeof d.class === 'string' &&
        ['optic_disc', 'optic disc'].includes(d.class.toLowerCase().trim())
      );

      // Calibrate spatial measurements
      const calibration = opticDisc
        ? calibrateFromOpticDisc(opticDisc)
        : createFallbackCalibration();

      // Get guideline asynchronously (we'll use default criteria for now)
      // In a real scenario, we'd need to pass guideline from parent or use a different approach
      const defaultCriteria = {
        enabled: true,
        method: 'EMCS',
        hard_exudates_distance_um: 500,
        min_exudates_for_flag: 1,
        circinate_pattern_detection: true,
        min_angular_dispersion: 0.5,
        visual_zones: {
          show_foveal_zone: true,
          foveal_zone_radius_um: 500,
        },
      };

      // Detect macular edema using ALL detections (AI + manual)
      const result = detectMacularEdema(allDetections, fovea, calibration, defaultCriteria);

      return {
        fovea,
        result,
        zoneRadiusUm: defaultCriteria.hard_exudates_distance_um,
      };
    } catch (error) {
      console.error('Error calculating macular edema data:', error);
      return null;
    }
  }, [detections, manualAnnotations, konvaImage, macularEdemaRevisionKey]);

  // Update transformer when selection changes
  useEffect(() => {
    if (selectedAnnotationId && trRef.current && stageRef.current) {
      const stage = stageRef.current;
      const selectedNode = stage.findOne('#det-' + selectedAnnotationId);
      if (selectedNode) {
        trRef.current.nodes([selectedNode]);
        trRef.current.getLayer().batchDraw();
      } else {
        trRef.current.nodes([]);
      }
    } else if (trRef.current) {
      trRef.current.nodes([]);
    }
  }, [selectedAnnotationId, detections, manualAnnotations, isCanvasReady]);

  // Reset ruler when tool changes
  useEffect(() => {
    if (activeTool !== 'ruler') {
      setRulerOrigin(null);
      setRulerDestination(null);
    }
  }, [activeTool]);

  // Load available classes when class list is shown
  useEffect(() => {
    if (showClassList && activeTool === 'bbox') {
      const loadClasses = async () => {
        try {
          await classManager.ensureMetadataLoaded();
          const classes = await classManager.getAllClasses();
          setAvailableClasses(classes.map(c => ({
            name: c.name,
            displayName: c.displayName,
            color: c.color
          })));
        } catch (error) {
          console.error('Error loading classes:', error);
        }
      };
      loadClasses();
    }
  }, [showClassList, activeTool]);

  // Capture initial state before drag/transform
  const handleDragStart = (id: number) => {
    const detection = detections.find(d => d.id === id) || manualAnnotations.find(d => d.id === id);
    if (detection) {
      dragStartAnnotation.current = JSON.parse(JSON.stringify(detection));
    }
  };

  // Helper to record history after drag/transform
  const recordMoveHistory = React.useCallback(async (id: number) => {
    if (!dragStartAnnotation.current || !history) return;

    const currentDetection = await db.detections.get(id);
    if (currentDetection) {
      const startBbox = dragStartAnnotation.current.bbox;
      const endBbox = currentDetection.bbox;
      
      if (
        Math.abs(startBbox.x - endBbox.x) > 0.1 ||
        Math.abs(startBbox.y - endBbox.y) > 0.1 ||
        Math.abs(startBbox.width - endBbox.width) > 0.1 ||
        Math.abs(startBbox.height - endBbox.height) > 0.1
      ) {
         history.onAdd({
          type: 'update',
          before: dragStartAnnotation.current,
          after: currentDetection
        });
      }
    }
    dragStartAnnotation.current = null;
  }, [history]);

  // Ref for debounced post-processing
  const postProcessTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Performs heavy tasks like optic disc refinement and DR re-classification
   * with a debounce to avoid freezing the UI during movement.
   */
  const runPostProcessing = useCallback((imageId: number, detectionId: number, bbox: any, className: string) => {
    if (postProcessTimeoutRef.current) {
      clearTimeout(postProcessTimeoutRef.current);
    }

    postProcessTimeoutRef.current = setTimeout(async () => {
      // 1. Regenerate optic disc segmentation if bbox was modified
      if ((className === 'optic_disc' || className === 'optic disc') && imageElementRef.current) {
        await updateOpticDiscSegmentation(imageElementRef.current, detectionId, bbox);
      }

      // 2. Re-classify DR after manual bbox modification
      try {
        await classifyAndSaveImage(imageId);
      } catch (error) {
        console.error('Error re-classifying after debounced update:', error);
      }

      onAnnotationAdded?.();
      postProcessTimeoutRef.current = null;
    }, CANVAS.DEBOUNCE_POST_PROCESSING_MS);
  }, [onAnnotationAdded]);

  // Ref for debouncing the database update itself
  const dbUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (postProcessTimeoutRef.current) {
        clearTimeout(postProcessTimeoutRef.current);
      }
      if (dbUpdateTimeoutRef.current) {
        clearTimeout(dbUpdateTimeoutRef.current);
      }
    };
  }, []);

  // Handle updates (drag/resize)
  const handleAnnotationChange = React.useCallback(async (id: number, newAttrs: any, isFinal = false) => {
    try {
      const detection = await db.detections.get(id);
      if (!detection) return;

      // Ensure positive width/height
      if (newAttrs.width < 0) {
        newAttrs.x += newAttrs.width;
        newAttrs.width = Math.abs(newAttrs.width);
      }
      if (newAttrs.height < 0) {
        newAttrs.y += newAttrs.height;
        newAttrs.height = Math.abs(newAttrs.height);
      }

      // Convert to image coordinates
      // Proteger contra división por cero o valores inválidos
      if (!scale || !isFinite(scale) || scale <= 0) {
        console.warn('Invalid scale in handleAnnotationChange:', scale);
        return;
      }

      const bbox = {
        x: (newAttrs.x - imageOffset.x) / scale,
        y: (newAttrs.y - imageOffset.y) / scale,
        width: newAttrs.width / scale,
        height: newAttrs.height / scale,
      };

      // Clear existing timeout for keyboard movements
      if (dbUpdateTimeoutRef.current) {
        clearTimeout(dbUpdateTimeoutRef.current);
      }

      if (isFinal) {
        // onDragEnd o onTransformEnd - actualizar BD inmediatamente para evitar "saltos"
        // Update basic detection data in DB (Visual update)
        if (detection.type === 'ai') {
          await db.detections.update(id, {
            bbox,
            type: 'manual'
          });
        } else {
          await db.detections.update(id, {
            bbox
          });
        }

        // Trigger heavy post-processing with debounce (2.5s)
        if (image.id) {
          runPostProcessing(image.id, id, bbox, detection.class);
        }
      } else {
        // Movimiento con teclado - debounce la actualización de BD
        dbUpdateTimeoutRef.current = setTimeout(async () => {
          if (detection.type === 'ai') {
            await db.detections.update(id, {
              bbox,
              type: 'manual'
            });
          } else {
            await db.detections.update(id, {
              bbox
            });
          }

          if (image.id) {
            runPostProcessing(image.id, id, bbox, detection.class);
          }
        }, CANVAS.DEBOUNCE_DB_UPDATE_MS);
      }

    } catch (error) {
      console.error('Error updating annotation:', error);
    }
  }, [image.id, imageOffset, scale, runPostProcessing]);

  const checkDeselect = (e: any) => {
    // deselect when clicked on empty area
    const clickedOnEmpty = e.target === e.target.getStage();
    const clickedOnImage = e.target.getClassName() === 'Image';
    
    if (clickedOnEmpty || clickedOnImage) {
      setSelectedAnnotation(null);
      onSelectMeasurement?.(null);
    }
  };

  // Load image (use processed canvas if available)
  useEffect(() => {
    setIsCanvasReady(false); // Reset cuando cambia la imagen

    // Siempre cargar la imagen original
    const origImg = new window.Image();
    const url = URL.createObjectURL(image.originalBlob);

    origImg.onload = () => {
      setOriginalImage(origImg);
      URL.revokeObjectURL(url);

      if (processedImageCanvas) {
        // Si hay imagen procesada, cargarla también
        const processedImg = new window.Image();
        processedImg.onload = () => {
          setKonvaImage(processedImg);
          imageElementRef.current = processedImg;
          calculateScale(processedImg.width, processedImg.height);

          // Dar un pequeño delay para que Konva termine de renderizar
          setTimeout(() => {
            setIsCanvasReady(true);
          }, CANVAS.CANVAS_READY_DELAY_MS);
        };
        processedImg.src = processedImageCanvas.toDataURL();
      } else {
        // Solo imagen original
        setKonvaImage(origImg);
        imageElementRef.current = origImg;
        calculateScale(origImg.width, origImg.height);

        // Dar un pequeño delay para que Konva termine de renderizar
        setTimeout(() => {
          setIsCanvasReady(true);
        }, CANVAS.CANVAS_READY_DELAY_MS);
      }
    };

    origImg.src = url;
  }, [image, processedImageCanvas]);

  // Load segmentation masks (both AI and manual)
  useEffect(() => {
    const newImages = new Map<number, HTMLImageElement>();
    const allSegs = [...segmentations, ...manualSegmentations];

    allSegs.forEach((seg) => {
      if (seg.maskData && seg.visible) {
        const img = new window.Image();
        img.onload = () => {
          newImages.set(seg.id!, img);
          setSegmentationImages(new Map(newImages));
        };
        img.src = seg.maskData; // maskData is already base64
      }
    });

    // Cleanup
    return () => {
      newImages.forEach(img => {
        img.src = '';
      });
    };
  }, [segmentations, manualSegmentations]);

  // Calculate scale to COVER canvas - image fills 100% of container (cover behavior)
  const calculateScale = (imgWidth: number, imgHeight: number) => {
    if (!containerRef.current) return;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight || 600;

    // Validate dimensions to prevent NaN values
    if (!imgWidth || !imgHeight || !isFinite(imgWidth) || !isFinite(imgHeight) ||
        !containerWidth || !containerHeight || !isFinite(containerWidth) || !isFinite(containerHeight)) {
      console.warn('Invalid dimensions for scale calculation:', { imgWidth, imgHeight, containerWidth, containerHeight });
      return;
    }

    // Calculate scale to cover container maintaining aspect ratio
    const scaleX = containerWidth / imgWidth;
    const scaleY = containerHeight / imgHeight;

    // Use the SMALLER scale to ensure image fits 100% within container (contain behavior)
    const newScale = Math.min(scaleX, scaleY);

    // Validate newScale
    if (!isFinite(newScale) || newScale <= 0) {
      console.warn('Invalid scale calculated:', newScale);
      return;
    }

    // Calculate offset to center the image
    const scaledWidth = imgWidth * newScale;
    const scaledHeight = imgHeight * newScale;
    const offsetX = (containerWidth - scaledWidth) / 2;
    const offsetY = (containerHeight - scaledHeight) / 2;

    // Validate offsets
    if (!isFinite(offsetX) || !isFinite(offsetY)) {
      console.warn('Invalid offsets calculated:', { offsetX, offsetY });
      return;
    }

    setScale(newScale);
    setImageOffset({ x: offsetX, y: offsetY });
    setStageSize({
      width: containerWidth,
      height: containerHeight,
    });
    // Reset stage scale to 1 when recalculating (this is the minimum zoom)
    setStageScale(1);
    setStagePos({ x: 0, y: 0 });
  };

  // Handle container resize with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (konvaImage) {
        calculateScale(konvaImage.width, konvaImage.height);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [konvaImage]);

  // Handle zoom with mouse wheel
  const handleWheel = (e: any) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale * CANVAS.ZOOM_WHEEL_FACTOR : oldScale / CANVAS.ZOOM_WHEEL_FACTOR;
    // Minimum zoom is 1.0 (the initial contain size), maximum is 5x
    const clampedScale = Math.max(CANVAS.MIN_ZOOM_SCALE, Math.min(CANVAS.MAX_ZOOM_SCALE, newScale));

    setStageScale(clampedScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  };

  // Handle pan
  const handleDragEnd = (e: any) => {
    // Only update stage position if the stage itself was dragged
    if (e.target === e.target.getStage()) {
      setStagePos({
        x: e.target.x(),
        y: e.target.y(),
      });
    }
  };

  // Zoom to bbox when clicking on a detection
  const zoomToBbox = React.useCallback((bbox: { x: number; y: number; width: number; height: number }, isLandmark: boolean = false) => {
    const stage = stageRef.current;
    if (!stage || !konvaImage) return;

    // For landmarks (circles), use the center and create a square bbox based on radius
    let effectiveBbox = bbox;
    if (isLandmark) {
      const centerX = bbox.x + bbox.width / 2;
      const centerY = bbox.y + bbox.height / 2;
      const radius = Math.max(bbox.width, bbox.height) / 2;
      // Create a square bbox around the circle with some extra margin
      const size = radius * 2 * 1.5;
      effectiveBbox = {
        x: centerX - size / 2,
        y: centerY - size / 2,
        width: size,
        height: size
      };
    }

    // Calculate center of bbox in image coordinates
    const centerX = (effectiveBbox.x + effectiveBbox.width / 2) * scale + imageOffset.x;
    const centerY = (effectiveBbox.y + effectiveBbox.height / 2) * scale + imageOffset.y;

    // Calculate zoom level to fit bbox with some margin
    const marginFactor = isLandmark ? CANVAS.ZOOM_TO_LANDMARK_MARGIN_FACTOR : CANVAS.ZOOM_TO_BBOX_MARGIN_FACTOR;
    const targetZoomX = stageSize.width / (effectiveBbox.width * scale * marginFactor);
    const targetZoomY = stageSize.height / (effectiveBbox.height * scale * marginFactor);
    const targetZoom = Math.min(targetZoomX, targetZoomY);

    // Clamp zoom between 1 and 5
    const newScale = Math.max(CANVAS.ZOOM_TO_BBOX_MIN_SCALE, Math.min(CANVAS.MAX_ZOOM_SCALE, targetZoom));

    // Calculate new position to center the bbox
    const newX = stageSize.width / 2 - centerX * newScale;
    const newY = stageSize.height / 2 - centerY * newScale;

    setStageScale(newScale);
    setStagePos({ x: newX, y: newY });
  }, [scale, imageOffset, stageSize, konvaImage]);

  // Handle annotation drawing
  const handleMouseDown = (e: any) => {
    checkDeselect(e);

    // Middle mouse button (button 1) always enables panning
    if (e.evt.button === 1) {
      setIsPanning(true);
      e.evt.preventDefault();
      return;
    }

    if (activeTool === 'pan') {
      setIsPanning(true);
      return;
    }

    if (activeTool === 'zoom') {
      const stage = stageRef.current;
      if (stage) {
        // Check if clicking on empty area or image (not a bbox)
        const clickedOnEmpty = e.target === e.target.getStage();
        const clickedOnImage = e.target.getClassName() === 'Image';

        // If already zoomed and clicking on empty area, reset zoom
        if ((clickedOnEmpty || clickedOnImage) && stageScale > CANVAS.ZOOM_ACTIVE_THRESHOLD) {
          setStageScale(CANVAS.MIN_ZOOM_SCALE);
          setStagePos({ x: 0, y: 0 });
          return;
        }

        // Otherwise, normal zoom behavior
        const oldScale = stageScale;
        const pointer = stage.getPointerPosition();

        if (!pointer) return;

        const mousePointTo = {
          x: (pointer.x - stage.x()) / oldScale,
          y: (pointer.y - stage.y()) / oldScale,
        };

        // Zoom In (default) vs Zoom Out (Ctrl key)
        const isZoomOut = e.evt.ctrlKey;
        const zoomFactor = isZoomOut ? 1 / CANVAS.ZOOM_CLICK_FACTOR : CANVAS.ZOOM_CLICK_FACTOR;
        const newScale = Math.max(CANVAS.MIN_ZOOM_SCALE, Math.min(CANVAS.MAX_ZOOM_SCALE, oldScale * zoomFactor));

        setStageScale(newScale);
        setStagePos({
          x: pointer.x - mousePointTo.x * newScale,
          y: pointer.y - mousePointTo.y * newScale,
        });
      }
      return;
    }

    // Handle landmark tool
    if (activeTool === 'landmark') {
      const targetName = e.target.getClassName();
      if (targetName !== 'Image' && targetName !== 'Stage') {
        return;
      }

      const stage = stageRef.current;
      if (!stage) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      // Calculate image coordinates
      const relativeX = pos.x - stagePos.x;
      const relativeY = pos.y - stagePos.y;
      const canvasX = relativeX / stageScale;
      const canvasY = relativeY / stageScale;
      const x = (canvasX - imageOffset.x) / scale;
      const y = (canvasY - imageOffset.y) / scale;

      // Add or update landmark
      addOrUpdateLandmark(selectedLandmarkType, x, y, CANVAS.DEFAULT_LANDMARK_RADIUS);
      return;
    }

    if (activeTool === 'bbox') {
      // Don't start drawing if clicking on a shape (detection/annotation)
      // Only allow drawing on the background image or Stage itself
      const targetName = e.target.getClassName();
      if (targetName !== 'Image' && targetName !== 'Stage') {
        return;
      }

      const stage = stageRef.current;
      if (!stage) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      // Improved coordinate calculation
      // First, remove stage position offset
      const relativeX = pos.x - stagePos.x;
      const relativeY = pos.y - stagePos.y;

      // Then divide by stage scale to get canvas coordinates
      const canvasX = relativeX / stageScale;
      const canvasY = relativeY / stageScale;

      // Finally, subtract image offset and divide by image scale to get image coordinates
      const x = (canvasX - imageOffset.x) / scale;
      const y = (canvasY - imageOffset.y) / scale;

      setIsDrawing(true);
      setNewAnnotation({
        type: activeTool,
        x,
        y,
        width: 0,
        height: 0,
      });
    }

    if (activeTool === 'ruler') {
      const stage = stageRef.current;
      if (!stage) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      // Calculate image coordinates (same as bbox)
      const relativeX = pos.x - stagePos.x;
      const relativeY = pos.y - stagePos.y;
      const canvasX = relativeX / stageScale;
      const canvasY = relativeY / stageScale;
      const x = (canvasX - imageOffset.x) / scale;
      const y = (canvasY - imageOffset.y) / scale;

      if (!rulerOrigin) {
        // First click - set origin
        setRulerOrigin({ x, y });
      } else {
        // Second click - set destination and save measurement
        const dx = x - rulerOrigin.x;
        const dy = y - rulerOrigin.y;
        const distancePixels = Math.sqrt(dx * dx + dy * dy);

        // Calculate DD if optic disc exists
        const opticDisc = detections.find(
          d => d.class === 'optic_disc' || d.class === 'optic disc'
        );

        let distanceDD: number | undefined;
        if (opticDisc) {
          const discDiameter = (opticDisc.bbox.width + opticDisc.bbox.height) / 2;
          // Proteger contra división por cero
          if (discDiameter > 0 && isFinite(discDiameter)) {
            distanceDD = distancePixels / discDiameter;
          }
        }

        // Save to database
        db.measurements.add({
          imageId: image.id!,
          originX: rulerOrigin.x,
          originY: rulerOrigin.y,
          destinationX: x,
          destinationY: y,
          distancePixels,
          distanceDD,
          visible: true,
          createdAt: new Date()
        }).then(() => {
          // Trigger parent update to reload measurements
          onAnnotationAdded?.();
        });

        // Reset for next measurement
        setRulerOrigin(null);
        setRulerDestination(null);
      }
    }
  };


  const handleMouseMove = (_e: any) => {
    if (!isDrawing || !newAnnotation) return;

    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Improved coordinate calculation (same as handleMouseDown)
    const relativeX = pos.x - stagePos.x;
    const relativeY = pos.y - stagePos.y;
    const canvasX = relativeX / stageScale;
    const canvasY = relativeY / stageScale;
    const x = (canvasX - imageOffset.x) / scale;
    const y = (canvasY - imageOffset.y) / scale;

    setNewAnnotation({
      ...newAnnotation,
      width: x - newAnnotation.x,
      height: y - newAnnotation.y,
    });
  };

  const handleMouseUp = () => {
    if (isDrawing && newAnnotation && konvaImage) {
      // Normalizar coordenadas para que width y height sean siempre positivos
      const normalizedBbox = {
        x: newAnnotation.width < 0 ? newAnnotation.x + newAnnotation.width : newAnnotation.x,
        y: newAnnotation.height < 0 ? newAnnotation.y + newAnnotation.height : newAnnotation.y,
        width: Math.abs(newAnnotation.width),
        height: Math.abs(newAnnotation.height),
      };

      // Validate bounds - ensure annotation is within image
      const clampedBbox = {
        x: Math.max(0, Math.min(normalizedBbox.x, konvaImage.width)),
        y: Math.max(0, Math.min(normalizedBbox.y, konvaImage.height)),
        width: Math.min(normalizedBbox.width, konvaImage.width - normalizedBbox.x),
        height: Math.min(normalizedBbox.height, konvaImage.height - normalizedBbox.y),
      };

      // Minimum size threshold adjusted for zoom level (smaller threshold when zoomed in)
      const minSize = CANVAS.MIN_BBOX_SIZE_PX / stageScale;

      // Only save if the annotation has some size
      if (clampedBbox.width > minSize && clampedBbox.height > minSize) {
        // Guardar como pendiente
        const pendingBbox = {
          ...newAnnotation,
          ...clampedBbox,
          id: Date.now()
        };

        // Si la lista de clases está activa Y hay una clase pre-seleccionada, guardar inmediatamente
        if (showClassList && preSelectedClass) {
          // Guardar directamente sin usar el estado pendiente ni abrir modal
          saveAnnotationWithClass(pendingBbox, preSelectedClass);
        } else {
          // En cualquier otro caso, guardar como pendiente y abrir el modal
          setPendingAnnotation(pendingBbox);
          setIsClassModalOpen(true);
        }
      }
      setNewAnnotation(null);
    }
    setIsDrawing(false);
    setIsPanning(false);
  };

  // Delete measurement
  const handleDeleteMeasurement = async (measurementId: number) => {
    await db.measurements.update(measurementId, { visible: false });
    onAnnotationAdded?.();
    onSelectMeasurement?.(null);
  };

  // Delete a specific annotation
  const handleDeleteAnnotation = React.useCallback(async (detection: any) => {
    if (!detection || !detection.id) return;

    if (history) {
      history.onAdd({ type: 'delete', detection: detection });
    }
    
    // Delete associated optic disc segmentation first
    await deleteOpticDiscSegmentation(detection.id);
    await db.detections.delete(detection.id);

    // Re-classify DR after deleting detection
    if (image.id) {
      try {
        await classifyAndSaveImage(image.id);
      } catch (error) {
        console.error('Error re-classifying after deleting detection:', error);
      }
    }

    if (selectedAnnotationId === String(detection.id)) {
      setSelectedAnnotation(null);
    }
    
    onAnnotationAdded?.();
  }, [history, image.id, onAnnotationAdded, selectedAnnotationId, setSelectedAnnotation]);

  // Delete selected annotation or measurement
  const handleDeleteSelected = React.useCallback(async () => {
    if (selectedAnnotationId) {
      const detection = 
        detections.find(d => String(d.id) === selectedAnnotationId) ||
        manualAnnotations.find(d => String(d.id) === selectedAnnotationId);

      if (detection) {
        await handleDeleteAnnotation(detection);
      }
    } else if (selectedMeasurementId) {
      await handleDeleteMeasurement(selectedMeasurementId);
    }
  }, [selectedAnnotationId, selectedMeasurementId, detections, manualAnnotations, handleDeleteAnnotation, handleDeleteMeasurement]);


  // Update measurement position during drag (temporary, visual only)
  const handleMeasurementDragMove = (
    measurementId: number,
    part: 'origin' | 'destination' | 'line',
    newPos: { x: number; y: number },
    dragDelta?: { x: number; y: number }
  ) => {
    const measurement = measurements.find(m => m.id === measurementId);
    if (!measurement) return;

    let originX = measurement.originX;
    let originY = measurement.originY;
    let destinationX = measurement.destinationX;
    let destinationY = measurement.destinationY;

    if (part === 'origin') {
      originX = newPos.x;
      originY = newPos.y;
    } else if (part === 'destination') {
      destinationX = newPos.x;
      destinationY = newPos.y;
    } else if (part === 'line' && dragDelta) {
      originX = measurement.originX + dragDelta.x;
      originY = measurement.originY + dragDelta.y;
      destinationX = measurement.destinationX + dragDelta.x;
      destinationY = measurement.destinationY + dragDelta.y;
    }

    setTempMeasurementUpdates(prev => {
      const newMap = new Map(prev);
      newMap.set(measurementId, { originX, originY, destinationX, destinationY });
      return newMap;
    });
  };

  // Helper to calculate measurement distance and DD
  const calculateMeasurementMetrics = (originX: number, originY: number, destX: number, destY: number) => {
    const dx = destX - originX;
    const dy = destY - originY;
    const distancePixels = Math.sqrt(dx * dx + dy * dy);

    let distanceDD: number | undefined;
    const opticDisc = detections.find(
      d => d.class === 'optic_disc' || d.class === 'optic disc'
    );
    if (opticDisc) {
      const discDiameter = (opticDisc.bbox.width + opticDisc.bbox.height) / 2;
      // Proteger contra división por cero
      if (discDiameter > 0 && isFinite(discDiameter)) {
        distanceDD = distancePixels / discDiameter;
      }
    }

    return { distancePixels, distanceDD };
  };

  // Update measurement position permanently (on drag end)
  const handleMeasurementDrag = async (
    measurementId: number,
    part: 'origin' | 'destination' | 'line',
    newPos: { x: number; y: number },
    dragDelta?: { x: number; y: number }
  ) => {
    const measurement = measurements.find(m => m.id === measurementId);
    if (!measurement) return;

    let updates: any = {};

    if (part === 'origin') {
      updates.originX = newPos.x;
      updates.originY = newPos.y;
    } else if (part === 'destination') {
      updates.destinationX = newPos.x;
      updates.destinationY = newPos.y;
    } else if (part === 'line' && dragDelta) {
      // Move entire line using drag delta
      updates.originX = measurement.originX + dragDelta.x;
      updates.originY = measurement.originY + dragDelta.y;
      updates.destinationX = measurement.destinationX + dragDelta.x;
      updates.destinationY = measurement.destinationY + dragDelta.y;
    }

    // Recalculate distance
    const originX = updates.originX ?? measurement.originX;
    const originY = updates.originY ?? measurement.originY;
    const destX = updates.destinationX ?? measurement.destinationX;
    const destY = updates.destinationY ?? measurement.destinationY;

    const { distancePixels, distanceDD } = calculateMeasurementMetrics(originX, originY, destX, destY);
    updates.distancePixels = distancePixels;
    if (distanceDD !== undefined) {
      updates.distanceDD = distanceDD;
    }

    // Clear temp updates
    setTempMeasurementUpdates(prev => {
      const newMap = new Map(prev);
      newMap.delete(measurementId);
      return newMap;
    });

    await db.measurements.update(measurementId, updates);
    onAnnotationAdded?.();
  };

  // Estado para rastrear la detección sobre la que está el mouse
  const [hoveredDetectionId, setHoveredDetectionId] = useState<number | null>(null);

  // Forzar re-mount completo cuando cambian las detecciones o rainbow mode (solo si canvas está listo)
  useEffect(() => {
    if (isCanvasReady) {
      setCanvasKey(prev => prev + 1);
    }
  }, [detections.length, isCanvasReady, rainbowMode]);

  // Forzar re-draw cuando cambia el hover
  useEffect(() => {
    if (stageRef.current) {
      stageRef.current.batchDraw();
    }
  }, [hoveredDetectionId]);

  // Función auxiliar para guardar anotación con bbox y clase
  const saveAnnotationWithClass = async (bbox: any, className: string) => {
    if (!image.id) return;

    // Validar que el bbox tenga valores válidos antes de guardar
    if (
      typeof bbox.x !== 'number' ||
      typeof bbox.y !== 'number' ||
      typeof bbox.width !== 'number' ||
      typeof bbox.height !== 'number' ||
      !isFinite(bbox.x) ||
      !isFinite(bbox.y) ||
      !isFinite(bbox.width) ||
      !isFinite(bbox.height) ||
      bbox.width <= 0 ||
      bbox.height <= 0
    ) {
      console.error('Intento de guardar anotación con bbox inválido:', bbox);
      toast.error(t('canvas.errors.invalidBboxError'));
      return;
    }

    try {
      const newDetectionData: Detection = {
        imageId: image.id,
        type: 'manual',
        bbox: {
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height
        },
        class: className,
        visible: true,
        createdAt: new Date()
      };

      // Guardar en base de datos como detección manual
      const newId = await db.detections.add(newDetectionData);

      const savedDetection = { ...newDetectionData, id: newId };

      if (history) {
        history.onAdd({ type: 'add', detection: savedDetection });
      }

      // Agregar al estado local para visualización inmediata
      setAnnotations([
        ...annotations,
        { ...bbox, class: className, id: newId }
      ]);

      // Limpiar estados
      setPendingAnnotation(null);
      setIsClassModalOpen(false);

      // Re-classify DR after adding manual detection
      if (image.id) {
        try {
          await classifyAndSaveImage(image.id);
        } catch (error) {
          console.error('Error re-classifying after adding manual detection:', error);
        }
      }

      // Callback opcional para refrescar detecciones desde BD
      onAnnotationAdded?.();
    } catch (error) {
      console.error('Error al guardar anotación:', error);
      toast.error(t('canvas.errors.saveAnnotationError'));
    }
  };

  const handleClassSelected = async (className: string) => {
    if (!pendingAnnotation || !image.id) return;
    await saveAnnotationWithClass(pendingAnnotation, className);
  };

  const handleResetZoom = () => {
    setStageScale(1);
    setStagePos({ x: 0, y: 0 });
  };

  const handleReDetect = async () => {
    if (!image.id || isProcessing) return;

    const confirmed = await confirm({
      title: t('canvas.redetection.title'),
      description: t('canvas.redetection.description'),
      confirmText: t('ui.continue'),
      cancelText: t('ui.cancel'),
      variant: 'warning',
    });

    if (!confirmed) {
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Eliminar detecciones AI actuales para esta imagen
      await db.detections
        .where('imageId')
        .equals(image.id)
        .and(d => d.type === 'ai')
        .delete();

      // 2. Asegurar que el modelo esté cargado
      if (!inferenceService.isDetectionModelLoaded()) {
        await inferenceService.loadDetectionModel();
      }

      // 3. Ejecutar inferencia
      if (konvaImage) {
        await inferenceService.detectObjects(konvaImage, image.id);
      }

      // 4. Notificar actualización
      onAnnotationAdded?.();
    } catch (error) {
      console.error('Error en re-detección:', error);
      toast.error(t('canvas.errors.redetectionError'));
    } finally {
      setIsProcessing(false);
    }
  };

  // State to track if Ctrl is pressed for cursor changes
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  // Manejar teclas de acceso rápido (Ctrl+Z para deshacer, Ctrl+Y o Ctrl+Shift+Z para rehacer, Flechas para mover)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') setIsCtrlPressed(true);

      // Escape to deselect and (via ImageAnalyzer) return to select tool
      if (e.key === 'Escape') {
        setSelectedAnnotation(null);
        onSelectMeasurement?.(null);
      }

      // Delete selected annotation/measurement
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only delete if no input is focused
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          handleDeleteSelected();
        }
      }

      // Toggle labels with 'l'
      if (e.key.toLowerCase() === 'l' && !e.ctrlKey && !e.metaKey) {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          const targetLabelLayers = ['detections-ai', 'manual-annotations'];
          const areAnyLabelsVisible = layers
            .filter(l => targetLabelLayers.includes(l.id))
            .some(l => l.showLabels !== false);

          const newState = !areAnyLabelsVisible;
          targetLabelLayers.forEach(id => {
            onLayerUpdate?.(id, { showLabels: newState });
          });
        }
      }

      // Toggle marks/detections visibility with 'm'
      if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey) {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          const targetMarkLayers = ['detections-ai', 'manual-annotations'];
          const areAnyMarksVisible = layers
            .filter(l => targetMarkLayers.includes(l.id))
            .some(l => l.visible !== false);

          const newState = !areAnyMarksVisible;
          targetMarkLayers.forEach(id => {
            onLayerUpdate?.(id, { visible: newState });
          });
        }
      }

      // Quick class selection with number keys 1-9 and letters q,w,e,r,t,y,u,i,o,p
      if (showClassList && activeTool === 'bbox' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          let classIndex = -1;

          // Handle number keys 1-9 (indices 0-8)
          const num = parseInt(e.key);
          if (!isNaN(num) && num >= 1 && num <= 9) {
            classIndex = num - 1;
          }
          // Handle letter keys q,w,e,r,t,y,u,i,o,p (indices 9-18)
          else {
            const letterKeys = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
            const letterIndex = letterKeys.indexOf(e.key.toLowerCase());
            if (letterIndex !== -1) {
              classIndex = 9 + letterIndex;
            }
          }

          if (classIndex !== -1 && classIndex < availableClasses.length) {
            e.preventDefault();
            const selectedClass = availableClasses[classIndex];
            // Toggle: if already selected, deselect; otherwise select
            setPreSelectedClass(preSelectedClass === selectedClass.name ? null : selectedClass.name);
          }
        }
      }

      // Undo/Redo
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) {
            history?.onRedo();
          } else {
            history?.onUndo();
          }
        } else if ((e.key === 'y' || e.key === 'Y') && !e.shiftKey) {
          e.preventDefault();
          history?.onRedo();
        }
      }

      // Move selected annotation with arrow keys
      if (selectedAnnotationId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        
        const detection = 
          detections.find(d => String(d.id) === selectedAnnotationId) ||
          manualAnnotations.find(d => String(d.id) === selectedAnnotationId);

        if (!detection) return;

        // Capture start state on first move
        if (!isKeyboardMoving.current) {
            isKeyboardMoving.current = true;
            dragStartAnnotation.current = JSON.parse(JSON.stringify(detection));
        }

        // Move by 1 pixel relative to image resolution (finer control)
        // Adjust delta based on shift key for faster movement (e.g., 10 pixels)
        const delta = e.shiftKey ? CANVAS.KEYBOARD_MOVE_DELTA_FAST : CANVAS.KEYBOARD_MOVE_DELTA_NORMAL;
        
        let newX = detection.bbox.x;
        let newY = detection.bbox.y;

        switch (e.key) {
          case 'ArrowUp': newY -= delta; break;
          case 'ArrowDown': newY += delta; break;
          case 'ArrowLeft': newX -= delta; break;
          case 'ArrowRight': newX += delta; break;
        }

        // Convert back to canvas coordinates for handleAnnotationChange
        // handleAnnotationChange expects properties as if they came from Konva node (screen/stage coords)
        const canvasX = newX * scale + imageOffset.x;
        const canvasY = newY * scale + imageOffset.y;
        const canvasWidth = detection.bbox.width * scale;
        const canvasHeight = detection.bbox.height * scale;

        lastKeyboardPos.current = { x: canvasX, y: canvasY, width: canvasWidth, height: canvasHeight };

        handleAnnotationChange(detection.id, {
          x: canvasX,
          y: canvasY,
          width: canvasWidth,
          height: canvasHeight
        });
      }
    };

    // Key up listener to commit history for keyboard moves
    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'Control') setIsCtrlPressed(false);
        
        if (isKeyboardMoving.current && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
             if (selectedAnnotationId && lastKeyboardPos.current) {
                 handleAnnotationChange(parseInt(selectedAnnotationId), lastKeyboardPos.current, true).then(() => {
                    recordMoveHistory(parseInt(selectedAnnotationId));
                 });
             }
             isKeyboardMoving.current = false;
             lastKeyboardPos.current = null;
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    history,
    selectedAnnotationId,
    selectedMeasurementId,
    detections,
    manualAnnotations,
    layers,
    onLayerUpdate,
    scale,
    imageOffset,
    handleDeleteSelected,
    handleAnnotationChange,
    recordMoveHistory,
    setSelectedAnnotation,
    onSelectMeasurement,
    showClassList,
    activeTool,
    availableClasses,
    preSelectedClass,
    setPreSelectedClass
  ]);

  // Handle modal close/cancel
  const handleModalClose = () => {
    // Usuario canceló - descartar anotación pendiente
    setPendingAnnotation(null);
    setIsClassModalOpen(false);
  };

  // Determine cursor style based on active tool
  const getCursor = () => {
    switch (activeTool) {
      case 'pan':
        return isPanning ? 'grabbing' : 'grab';
      case 'zoom':
        // Si estás sobre una detección, mostrar cursor de target
        if (hoveredDetectionId !== null) {
          return 'crosshair';
        }
        // Si ya estás con zoom y no estás sobre una detección, mostrar que puedes resetear
        if (stageScale > CANVAS.ZOOM_ACTIVE_THRESHOLD && !isCtrlPressed) {
          return 'zoom-out';
        }
        return isCtrlPressed ? 'zoom-out' : 'zoom-in';
      case 'bbox':
      case 'ruler':
        return 'crosshair';
      case 'eraser':
        // Custom red X cursor for better clarity
        return 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNlZjQ0NDQiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48bGluZSB4MT0iMTgiIHkxPSI2IiB4Mj0iNiIgeTI9IjE4Ij48L2xpbmU+PGxpbmUgeDE9IjYiIHkxPSI2IiB4Mj0iMTgiIHkyPSIxOCI+PC9saW5lPjwvc3ZnPg") 12 12, crosshair';
      case 'select':
        return 'pointer';
      default:
        return 'default';
    }
  };

  if (!konvaImage) {
    return (
      <div className="w-full h-96 bg-coal-50 rounded-lg flex items-center justify-center">
        <p className="text-smoke-500">Cargando imagen...</p>
      </div>
    );
  }


  return (
    <>
      <div className="relative w-full">
        <CanvasToolbar
          history={history}
          onReDetect={handleReDetect}
          isProcessing={isProcessing}
          onResetZoom={handleResetZoom}
        />

        {showClassList && activeTool === 'bbox' && (
          <CanvasQuickClassSelector
            availableClasses={availableClasses}
            preSelectedClass={preSelectedClass}
            onSelectClass={(name) => setPreSelectedClass(name)}
          />
        )}
      </div>
      <div
        ref={containerRef}
        className="w-full h-full bg-coal-900 overflow-hidden flex items-center justify-center"
        style={{ cursor: getCursor() }}
      >
        <Stage
          key={`canvas-${canvasKey}`}
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          scaleX={stageScale}
          scaleY={stageScale}
          x={stagePos.x}
          y={stagePos.y}
          onWheel={handleWheel}
          onDragEnd={handleDragEnd}
          draggable={true}
          onDragStart={(e) => {
            // Only allow dragging the Stage itself, not children (like Rects)
            // If dragging a child element, let it handle its own drag
            if (e.target !== e.target.getStage()) {
              // A child is being dragged (like a detection box)
              // Don't interfere - let the child handle it
              return;
            }

            // Only allow dragging the Stage if it's the pan tool OR middle mouse button
            const isMiddleButton = e.evt && (e.evt.button === 1);
            if (activeTool !== 'pan' && !isMiddleButton && !isPanning) {
              e.target.stopDrag();
            }
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {layers.map((layer) => {
            if (layer.id === 'original') {
              return (
                <Layer key={layer.id} visible={layer.visible} opacity={layer.opacity}>
                  <KonvaImage
                    image={konvaImage}
                    x={imageOffset.x}
                    y={imageOffset.y}
                    width={konvaImage.width}
                    height={konvaImage.height}
                    scaleX={scale}
                    scaleY={scale}
                  />
                  {processedImageCanvas && showOriginalOverlay && originalImage && (
                    <KonvaImage
                      image={originalImage}
                      x={imageOffset.x}
                      y={imageOffset.y}
                      width={originalImage.width}
                      height={originalImage.height}
                      scaleX={scale}
                      scaleY={scale}
                      opacity={comparisonOpacity}
                    />
                  )}
                </Layer>
              );
            }

            if (layer.id === 'detections-ai' || layer.id === 'manual-annotations') {
              const isAI = layer.id === 'detections-ai';
              return (
                <AnnotationsCanvasLayer
                  key={layer.id}
                  aiDetectionsVisible={isAI && layer.visible}
                  aiDetectionsOpacity={layer.opacity}
                  detections={detections}
                  segmentations={segmentations}
                  manualAnnotationsVisible={!isAI && layer.visible}
                  manualAnnotationsOpacity={layer.opacity}
                  manualAnnotations={manualAnnotations}
                  manualSegmentations={manualSegmentations}
                  segmentationImages={segmentationImages}
                  konvaImageWidth={konvaImage?.width || 0}
                  konvaImageHeight={konvaImage?.height || 0}
                  scale={scale}
                  imageOffset={imageOffset}
                  activeTool={activeTool}
                  selectedAnnotationId={selectedAnnotationId}
                  hoveredDetectionId={hoveredDetectionId}
                  showAILabels={isAI ? (layer.showLabels ?? true) : false}
                  showManualLabels={!isAI ? (layer.showLabels ?? true) : false}
                  landmarks={landmarks}
                  isCanvasReady={isCanvasReady}
                  newAnnotation={newAnnotation}
                  pendingAnnotation={pendingAnnotation}
                  onHover={setHoveredDetectionId}
                  onSelect={(id) => setSelectedAnnotation(id)}
                  onDragStart={handleDragStart}
                  onUpdate={async (id, attrs, isFinal) => {
                    await handleAnnotationChange(id, attrs, isFinal);
                    if (isFinal) recordMoveHistory(id);
                  }}
                  onDelete={handleDeleteAnnotation}
                  onZoomToBbox={zoomToBbox}
                />
              );
            }

            if (['measurements', 'quadrants', 'macular-zones', 'circinate-rings'].includes(layer.id)) {
              return (
                <OverlaysCanvasLayer
                  key={layer.id}
                  measurementsVisible={layer.id === 'measurements' && layer.visible}
                  measurementsOpacity={layer.opacity}
                  measurements={measurements}
                  detections={detections}
                  activeTool={activeTool}
                  rulerOrigin={rulerOrigin}
                  rulerDestination={rulerDestination}
                  selectedMeasurementId={selectedMeasurementId ?? null}
                  tempMeasurementUpdates={tempMeasurementUpdates}
                  onSelectMeasurement={onSelectMeasurement ?? (() => {})}
                  onDeleteMeasurement={handleDeleteMeasurement}
                  onMeasurementDragMove={handleMeasurementDragMove}
                  onMeasurementDragEnd={handleMeasurementDrag}
                  quadrantsVisible={layer.id === 'quadrants' && layer.visible}
                  quadrantsOpacity={layer.opacity}
                  macularZonesVisible={layer.id === 'macular-zones' && layer.visible}
                  macularZonesOpacity={layer.opacity}
                  circinateRingsVisible={layer.id === 'circinate-rings' && layer.visible}
                  landmarks={landmarks}
                  konvaImageWidth={konvaImage?.width || 0}
                  konvaImageHeight={konvaImage?.height || 0}
                  macularEdemaData={macularEdemaData}
                  scale={scale}
                  imageOffset={imageOffset}
                  stageScale={stageScale}
                />
              );
            }

            return null;
          })}

        {/* Transformer Layer */}
        <Layer>
          <Transformer
            ref={trRef}
            rotateEnabled={false}
            keepRatio={false}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
          />
        </Layer>
      </Stage>
    </div>

    <ClassSelectionModal
      open={isClassModalOpen}
      onOpenChange={setIsClassModalOpen}
      onClassSelected={handleClassSelected}
      onCancel={handleModalClose}
      imageId={image.id!}
    />
    {ConfirmDialogComponent}
  </>
  );
};

export default AnnotationCanvas;