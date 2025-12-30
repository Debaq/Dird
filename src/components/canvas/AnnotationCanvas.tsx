import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';
import { Stage, Layer, Image as KonvaImage, Rect, Group, Text, Transformer, Circle, Line } from 'react-konva';
import { RotateCcw, RotateCw, Brain, Loader2, Maximize } from 'lucide-react';
import type { Image as ImageType, Detection } from '@/lib/db/schema';
import type { HistoryEntry } from '@/types/annotations';
import type { CanvasTool } from './ToolPanel';
import type { CanvasLayer } from './LayerControls';
import { db } from '@/lib/db/schema';
import { classManager } from '@/lib/classes/class-manager';
import ClassSelectionModal from './ClassSelectionModal';
import { getClassName } from '@/lib/ai/class-translations';
import { useConfigStore } from '@/stores/config-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { inferenceService } from '@/lib/ai/inference-service';
import { updateOpticDiscSegmentation, deleteOpticDiscSegmentation } from '@/lib/ai/optic-disc-updater';
import { QuadrantOverlay } from './QuadrantOverlay';
import { MacularZonesOverlay } from './MacularZonesOverlay';
import { useLandmarksAndQuadrants } from '@/hooks/useLandmarksAndQuadrants';
import { classifyAndSaveImage } from '@/lib/analysis/image-classification-service';
import { calibrateFromOpticDisc, createFallbackCalibration } from '@/lib/analysis/spatial-calibrator';
import { detectMacularEdema, findFovea, findHardExudates } from '@/lib/analysis/macular-edema-detector';

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
  const { t, i18n } = useTranslation();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const { config } = useConfigStore();
  const { selectedAnnotationId, setSelectedAnnotation, showClassList, preSelectedClass, setPreSelectedClass } = useCanvasStore();
  const rainbowMode = config.appearance.rainbowMode; // Subscribe to rainbow mode changes

  // Key único para forzar re-mount cuando cambian detecciones o rainbow mode
  const [canvasKey, setCanvasKey] = useState(0);

  // CRÍTICO: Solo mostrar detecciones cuando todo esté listo
  const [isCanvasReady, setIsCanvasReady] = useState(false);

  // Obtener configuración de capas
  const aiDetectionsLayer = layers.find(l => l.id === 'detections-ai');
  const manualAnnotationsLayer = layers.find(l => l.id === 'manual-annotations');
  const measurementsLayer = layers.find(l => l.id === 'measurements');
  const quadrantsLayer = layers.find(l => l.id === 'quadrants');
  const macularZonesLayer = layers.find(l => l.id === 'macular-zones');
  const circinateRingsLayer = layers.find(l => l.id === 'circinate-rings');
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
  const runPostProcessing = React.useCallback((imageId: number, detectionId: number, bbox: any, className: string) => {
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
    }, 2500); // 2.5 seconds debounce - only runs after user stops moving
  }, [onAnnotationAdded]);

  // Ref for debouncing the database update itself
  const dbUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        }, 500);
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
          }, 100);
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
        }, 100);
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

    const newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1;
    // Minimum zoom is 1.0 (the initial contain size), maximum is 5x
    const clampedScale = Math.max(1.0, Math.min(5, newScale));

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
    const marginFactor = isLandmark ? 2.0 : 2.5;
    const targetZoomX = stageSize.width / (effectiveBbox.width * scale * marginFactor);
    const targetZoomY = stageSize.height / (effectiveBbox.height * scale * marginFactor);
    const targetZoom = Math.min(targetZoomX, targetZoomY);

    // Clamp zoom between 1 and 5
    const newScale = Math.max(1.5, Math.min(5, targetZoom));

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
        if ((clickedOnEmpty || clickedOnImage) && stageScale > 1.1) {
          setStageScale(1);
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
        const zoomFactor = isZoomOut ? 1 / 1.5 : 1.5;
        const newScale = Math.max(1, Math.min(5, oldScale * zoomFactor));

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
      addOrUpdateLandmark(selectedLandmarkType, x, y, 30);
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
      const minSize = 5 / stageScale;

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

  // Helper to get effective measurement (with temp updates if dragging)
  const getEffectiveMeasurement = (measurement: any) => {
    const tempUpdate = tempMeasurementUpdates.get(measurement.id);
    if (tempUpdate) {
      return { ...measurement, ...tempUpdate };
    }
    return measurement;
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
        const delta = e.shiftKey ? 10 : 1;
        
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
        if (stageScale > 1.1 && !isCtrlPressed) {
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
        <div className="absolute top-2 left-2 z-10 flex space-x-2">
          <button
            onClick={history?.onUndo}
            disabled={!history || history.index < 0}
            className={`p-2 rounded-lg ${!history || history.index < 0 ? 'bg-gray-200 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-100 shadow'}`}
            title={`${t('canvas.undo')} (Ctrl+Z)`}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={history?.onRedo}
            disabled={!history || history.index >= history.entries.length - 1}
            className={`p-2 rounded-lg ${!history || history.index >= history.entries.length - 1 ? 'bg-gray-200 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-100 shadow'}`}
            title={`${t('canvas.redo')} (Ctrl+Y)`}
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleReDetect}
            disabled={isProcessing}
            className={`p-2 rounded-lg ${isProcessing ? 'bg-gray-200 text-gray-400' : 'bg-white text-primary-600 hover:bg-primary-50 shadow'}`}
            title="Re-detectar (IA)"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Brain className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleResetZoom}
            className="p-2 rounded-lg bg-white text-gray-700 hover:bg-gray-100 shadow"
            title={t('canvas.resetZoom')}
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>

        {/* Quick class selection list */}
        {showClassList && activeTool === 'bbox' && (
          <div className="absolute top-14 left-2 z-10 bg-white rounded-lg shadow-lg border border-coal-200 p-1.5 max-w-xs">
            <div className="text-[9px] font-semibold text-coal-600 mb-1 uppercase tracking-wider px-1">
              {t('canvas.quickClassSelection') || 'Quick Class Selection'}
            </div>
            <div className="space-y-0.5">
              {availableClasses.map((cls, index) => {
                // Get shortcut key: 1-9 for indices 0-8, q,w,e,r,t,y,u,i,o,p for indices 9-18
                const shortcutKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
                const shortcutKey = index < 19 ? shortcutKeys[index] : '';
                const isSelected = preSelectedClass === cls.name;
                return (
                  <button
                    key={cls.name}
                    onClick={() => setPreSelectedClass(isSelected ? null : cls.name)}
                    className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-primary-100 border border-primary-500 text-primary-700 shadow-sm'
                        : 'hover:bg-coal-50 border border-transparent text-coal-700'
                    }`}
                    title={shortcutKey ? `Press ${shortcutKey} to select` : cls.displayName}
                  >
                    {shortcutKey && (
                      <span className="font-mono font-bold text-[9px] text-coal-500 min-w-[16px]">
                        [{shortcutKey}]
                      </span>
                    )}
                    <div
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: cls.color }}
                    />
                    <span className="flex-1 truncate leading-tight">{cls.displayName}</span>
                  </button>
                );
              })}
            </div>
            {preSelectedClass && (
              <div className="mt-1 pt-1 border-t border-coal-200">
                <div className="text-[9px] text-primary-600 px-1">
                  {t('canvas.classPreSelected') || 'Next annotation will be:'}{' '}
                  <span className="font-semibold">
                    {availableClasses.find(c => c.name === preSelectedClass)?.displayName}
                  </span>
                </div>
              </div>
            )}
          </div>
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
        {/* Image Layer */}
        <Layer>
          {/* Imagen procesada (o original si no hay procesada) */}
          <KonvaImage
            image={konvaImage}
            x={imageOffset.x}
            y={imageOffset.y}
            width={konvaImage.width}
            height={konvaImage.height}
            scaleX={scale}
            scaleY={scale}
          />

          {/* Imagen original superpuesta (solo si hay imagen procesada y showOriginalOverlay) */}
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

        {/* AI Detections Layer (includes AI segmentations) */}
        <Layer
          name="ai-detections-layer"
          opacity={aiDetectionsLayer?.opacity ?? 1}
          visible={aiDetectionsLayer?.visible ?? true}
          listening={true}
        >
          {!isCanvasReady && (
            <Text
              x={imageOffset.x + 20}
              y={imageOffset.y + 20}
              text={t('canvas.loadingDetections')}
              fontSize={14}
              fill="#20B5AE"
              padding={8}
              listening={false}
            />
          )}
          {isCanvasReady && detections.length === 0 && (
            <Text
              x={imageOffset.x + 20}
              y={imageOffset.y + 20}
              text={t('canvas.noDetectionsOnImage')}
              fontSize={14}
              fill="#FF6B6B"
              padding={8}
              listening={false}
            />
          )}

          {/* AI Segmentations (optic disc masks) - rendered BEFORE detections */}
          {segmentations.map((seg) => {
            const segImage = segmentationImages.get(seg.id!);
            if (!segImage || !seg.visible) return null;

            return (
              <KonvaImage
                key={`ai-seg-${seg.id}`}
                image={segImage}
                x={imageOffset.x}
                y={imageOffset.y}
                width={konvaImage?.width || 0}
                height={konvaImage?.height || 0}
                scaleX={scale}
                scaleY={scale}
                listening={false}
                opacity={0.4}
              />
            );
          })}

          {/* AI Detections */}
          {isCanvasReady && detections.map((detection, idx) => {
            // Skip if class is not defined
            if (!detection.class || typeof detection.class !== 'string') {
              return null;
            }

            // Skip if bbox is invalid or has NaN values
            if (!detection.bbox ||
                typeof detection.bbox.x !== 'number' ||
                typeof detection.bbox.y !== 'number' ||
                typeof detection.bbox.width !== 'number' ||
                typeof detection.bbox.height !== 'number' ||
                !isFinite(detection.bbox.x) ||
                !isFinite(detection.bbox.y) ||
                !isFinite(detection.bbox.width) ||
                !isFinite(detection.bbox.height)) {
              console.warn('Skipping detection with invalid bbox:', detection);
              return null;
            }

            // Check if this is a landmark class (optic_disc or fovea)
            const className = detection.class.toLowerCase().trim();
            const isLandmarkClass = className === 'optic_disc' || className === 'optic disc' || className === 'fovea';

            // Calcular ancho del label basado en el texto
            const translatedClass = getClassName(detection.class, i18n.language);
            const labelText = `${translatedClass} ${Math.round((detection.confidence || 0) * 100)}%`;
            const labelFontSize = 10;
            const labelPadding = 6;
            const labelWidth = labelText.length * (labelFontSize * 0.6) + labelPadding * 2;
            const labelHeight = 16;
            const showLabels = aiDetectionsLayer?.showLabels ?? true;

            // Verificar si esta detección está siendo hover
            const isHovered = detection.id === hoveredDetectionId;

            // Obtener color efectivo (respetando rainbow mode y configuraciones)
            const detectionColor = classManager.getColorForClass(detection.class);
            const isSelected = selectedAnnotationId === String(detection.id);

            return (
              <Group key={`detection-${detection.id || idx}`}>
                <Rect
                  id={`det-${detection.id}`}
                  x={detection.bbox.x * scale + imageOffset.x}
                  y={detection.bbox.y * scale + imageOffset.y}
                  width={detection.bbox.width * scale}
                  height={detection.bbox.height * scale}
                  fill={`${detectionColor}1A`}
                  stroke={isHovered ? "#FFD700" : detectionColor}
                  strokeWidth={isHovered ? 3 : 1.5}
                  dash={isHovered ? [] : [8, 4]}
                  hitStrokeWidth={10}
                  perfectDrawEnabled={false}
                  listening={activeTool !== 'bbox'}
                  opacity={isLandmarkClass && !isSelected ? 0 : 1} // Invisible but interactive for landmarks
                  draggable={activeTool === 'select' && isSelected}
                  onMouseEnter={() => {
                    if (detection.id) setHoveredDetectionId(detection.id);
                  }}
                  onMouseLeave={() => {
                    setHoveredDetectionId(null);
                  }}
                  onDragStart={() => detection.id && handleDragStart(detection.id)}
                  onClick={async (e) => {
                    if (activeTool === 'eraser' && detection.id) {
                      e.cancelBubble = true;
                      await handleDeleteAnnotation(detection);
                    } else if (activeTool === 'select' && detection.id) {
                      setSelectedAnnotation(String(detection.id));
                      e.cancelBubble = true;
                    } else if (activeTool === 'zoom' && detection.id) {
                      zoomToBbox(detection.bbox, isLandmarkClass);
                      e.cancelBubble = true;
                    }
                  }}
                  onDragEnd={(e) => {
                    if (detection.id) {
                      handleAnnotationChange(detection.id, {
                        x: e.target.x(),
                        y: e.target.y(),
                        width: e.target.width() * e.target.scaleX(),
                        height: e.target.height() * e.target.scaleY()
                      }, true).then(() => recordMoveHistory(detection.id!));
                    }
                  }}
                  onTransformStart={() => detection.id && handleDragStart(detection.id)}
                  onTransformEnd={(e) => {
                    if (detection.id) {
                      const node = e.target;
                      const scaleX = node.scaleX();
                      const scaleY = node.scaleY();
                      node.scaleX(1);
                      node.scaleY(1);
                      handleAnnotationChange(detection.id, {
                        x: node.x(),
                        y: node.y(),
                        width: Math.max(5, node.width() * scaleX),
                        height: Math.max(5, node.height() * scaleY),
                        rotation: node.rotation()
                      }, true).then(() => recordMoveHistory(detection.id!));
                    }
                  }}
                />

                {isSelected && !isLandmarkClass && (
                  <Circle
                    x={(detection.bbox.x * scale + imageOffset.x) + (detection.bbox.width * scale) / 2}
                    y={(detection.bbox.y * scale + imageOffset.y) + (detection.bbox.height * scale) / 2}
                    radius={5}
                    fill="white"
                    stroke="black"
                    strokeWidth={1}
                    draggable
                    onDragStart={() => detection.id && handleDragStart(detection.id)}
                    onDragMove={(e) => {
                      const circle = e.target;
                      const rect = stageRef.current?.findOne('#det-' + detection.id);
                      if (rect) {
                        const w = rect.width() * rect.scaleX();
                        const h = rect.height() * rect.scaleY();
                        rect.x(circle.x() - w / 2);
                        rect.y(circle.y() - h / 2);
                      }
                    }}
                    onDragEnd={() => {
                      const rect = stageRef.current?.findOne('#det-' + detection.id);
                      if (rect && detection.id) {
                        handleAnnotationChange(detection.id, {
                          x: rect.x(),
                          y: rect.y(),
                          width: rect.width() * rect.scaleX(),
                          height: rect.height() * rect.scaleY()
                        }, true).then(() => recordMoveHistory(detection.id!));
                      }
                    }}
                  />
                )}

                {showLabels && !isLandmarkClass && (
                  <Group listening={false}>
                    <Rect
                      x={detection.bbox.x * scale + imageOffset.x}
                      y={(detection.bbox.y - labelHeight - 2) * scale + imageOffset.y}
                      width={labelWidth}
                      height={labelHeight}
                      fill={isHovered ? "#FFD700" : detectionColor}
                      cornerRadius={3}
                    />
                    <Text
                      x={detection.bbox.x * scale + imageOffset.x + labelPadding}
                      y={(detection.bbox.y - labelHeight) * scale + imageOffset.y}
                      text={labelText}
                      fontSize={labelFontSize}
                      fill={isHovered ? "black" : "white"}
                      fontStyle="bold"
                    />
                  </Group>
                )}

                {/* Render landmark circle if this is a landmark class */}
                {isLandmarkClass && (() => {
                  const landmark = landmarks.find(l => {
                    const match = l.id.match(/ai-.*-(\d+)/);
                    return match && parseInt(match[1]) === detection.id;
                  });

                  if (!landmark) return null;

                  const centerX = (detection.bbox.x + detection.bbox.width / 2) * scale + imageOffset.x;
                  const centerY = (detection.bbox.y + detection.bbox.height / 2) * scale + imageOffset.y;
                  const radius = landmark.radius * scale;
                  const isOpticDisc = landmark.type === 'optic_disc';
                  const strokeColor = isOpticDisc ? '#E63946' : '#2A9D8F';

                  return (
                    <Group>
                      {/* Outer ring */}
                      <Circle
                        x={centerX}
                        y={centerY}
                        radius={radius + 3}
                        stroke={strokeColor}
                        strokeWidth={2}
                        opacity={0.8}
                        listening={false}
                      />
                      {/* Main circle */}
                      <Circle
                        x={centerX}
                        y={centerY}
                        radius={radius}
                        fill='transparent'
                        opacity={0.8}
                        stroke={strokeColor}
                        strokeWidth={2}
                        listening={false}
                      />
                      {/* Center dot */}
                      <Circle
                        x={centerX}
                        y={centerY}
                        radius={3}
                        fill={strokeColor}
                        opacity={1}
                        listening={false}
                      />
                    </Group>
                  );
                })()}
              </Group>
            );
          })}
        </Layer>

        {/* Manual Annotations Layer (includes manual segmentations) */}
        <Layer
          name="manual-annotations-layer"
          opacity={manualAnnotationsLayer?.opacity ?? 1}
          visible={manualAnnotationsLayer?.visible ?? true}
          listening={true}
        >
          {/* Manual Segmentations (optic disc masks) - rendered BEFORE annotations */}
          {manualSegmentations.map((seg) => {
            const segImage = segmentationImages.get(seg.id!);
            if (!segImage || !seg.visible) return null;

            return (
              <KonvaImage
                key={`manual-seg-${seg.id}`}
                image={segImage}
                x={imageOffset.x}
                y={imageOffset.y}
                width={konvaImage?.width || 0}
                height={konvaImage?.height || 0}
                scaleX={scale}
                scaleY={scale}
                listening={false}
                opacity={0.4}
              />
            );
          })}

          {/* Saved annotations from database */}
          {isCanvasReady && manualAnnotations?.map((annotation, idx) => {
            // Check if this is a landmark class (optic_disc or fovea)
            const className = annotation.class?.toLowerCase().trim() || '';
            const isLandmarkClass = className === 'optic_disc' || className === 'optic disc' || className === 'fovea';

            // Para detecciones manuales de la base de datos, usamos bbox
            const color = annotation.class
              ? classManager.getColorForClass(annotation.class)
              : '#FF6B6B'; // fallback color

            // Obtener nombre traducido
            const translatedClass = annotation.class ? getClassName(annotation.class, i18n.language) : '';

            // Calcular ancho del label basado en el texto
            const labelFontSize = 10;
            const labelPadding = 6;
            const labelWidth = translatedClass ? translatedClass.length * (labelFontSize * 0.6) + labelPadding * 2 : 0;
            const labelHeight = 16;
            const showLabels = manualAnnotationsLayer?.showLabels ?? true;

            // Verificar si esta anotación está siendo hover
            const isHovered = annotation.id === hoveredDetectionId;
            const hoverColor = isHovered ? "#FFD700" : color;
            const isSelected = selectedAnnotationId === String(annotation.id);

            // Verificar si es una detección de la base de datos (tiene bbox)
            if (annotation.bbox) {
              // Skip if bbox has invalid or NaN values
              if (typeof annotation.bbox.x !== 'number' ||
                  typeof annotation.bbox.y !== 'number' ||
                  typeof annotation.bbox.width !== 'number' ||
                  typeof annotation.bbox.height !== 'number' ||
                  !isFinite(annotation.bbox.x) ||
                  !isFinite(annotation.bbox.y) ||
                  !isFinite(annotation.bbox.width) ||
                  !isFinite(annotation.bbox.height)) {
                console.warn('Skipping manual annotation with invalid bbox:', annotation);
                return null;
              }

              return (
                <Group key={`manual-${annotation.id || idx}`}>
                  {/* Caja de anotación */}
                  <Rect
                    id={`det-${annotation.id}`}
                    x={annotation.bbox.x * scale + imageOffset.x}
                    y={annotation.bbox.y * scale + imageOffset.y}
                    width={annotation.bbox.width * scale}
                    height={annotation.bbox.height * scale}
                    fill={`${color}20`}
                    stroke={hoverColor}
                    strokeWidth={isHovered ? 3 : 1}
                    strokeDash={isHovered ? [] : [4, 2]}
                    hitStrokeWidth={10}
                    perfectDrawEnabled={false}
                    listening={activeTool !== 'bbox'}
                    opacity={isLandmarkClass && !isSelected ? 0 : 1} // Invisible but interactive for landmarks
                    draggable={activeTool === 'select' && isSelected}
                    onMouseEnter={() => {
                      if (annotation.id) setHoveredDetectionId(annotation.id);
                    }}
                    onMouseLeave={() => {
                      setHoveredDetectionId(null);
                    }}
                    onDragStart={() => annotation.id && handleDragStart(annotation.id)}
                                      onClick={async (e) => {
                                        if (activeTool === 'eraser' && annotation.id) {
                                          e.cancelBubble = true;
                                          await handleDeleteAnnotation(annotation);
                                        } else if (activeTool === 'select' && annotation.id) {
                                          setSelectedAnnotation(String(annotation.id));
                                          e.cancelBubble = true;
                                        } else if (activeTool === 'zoom' && annotation.id) {
                                          zoomToBbox(annotation.bbox, isLandmarkClass);
                                          e.cancelBubble = true;
                                        }
                                      }}                    
                    onDragEnd={(e) => {
                      if (annotation.id) {
                        handleAnnotationChange(annotation.id, {
                          x: e.target.x(),
                          y: e.target.y(),
                          width: e.target.width() * e.target.scaleX(),
                          height: e.target.height() * e.target.scaleY()
                        }, true).then(() => recordMoveHistory(annotation.id!));
                      }
                    }}
                    onTransformStart={() => annotation.id && handleDragStart(annotation.id)}
                    onTransformEnd={(e) => {
                      if (annotation.id) {
                        const node = e.target;
                        const scaleX = node.scaleX();
                        const scaleY = node.scaleY();
                        node.scaleX(1);
                        node.scaleY(1);
                        handleAnnotationChange(annotation.id, {
                          x: node.x(),
                          y: node.y(),
                          width: Math.max(5, node.width() * scaleX),
                          height: Math.max(5, node.height() * scaleY),
                          rotation: node.rotation()
                        }, true).then(() => recordMoveHistory(annotation.id!));
                      }
                    }}
                  />

                  {isSelected && !isLandmarkClass && (
                    <Circle
                      x={(annotation.bbox.x * scale + imageOffset.x) + (annotation.bbox.width * scale) / 2}
                      y={(annotation.bbox.y * scale + imageOffset.y) + (annotation.bbox.height * scale) / 2}
                      radius={5}
                      fill="white"
                      stroke="black"
                      strokeWidth={1}
                      draggable
                      onDragStart={() => annotation.id && handleDragStart(annotation.id)}
                      onDragMove={(e) => {
                        const circle = e.target;
                        const rect = stageRef.current?.findOne('#det-' + annotation.id);
                        if (rect) {
                          const w = rect.width() * rect.scaleX();
                          const h = rect.height() * rect.scaleY();
                          rect.x(circle.x() - w / 2);
                          rect.y(circle.y() - h / 2);
                        }
                      }}
                      onDragEnd={() => {
                        const rect = stageRef.current?.findOne('#det-' + annotation.id);
                        if (rect && annotation.id) {
                          handleAnnotationChange(annotation.id, {
                            x: rect.x(),
                            y: rect.y(),
                            width: rect.width() * rect.scaleX(),
                            height: rect.height() * rect.scaleY()
                          }, true).then(() => recordMoveHistory(annotation.id!));
                        }
                      }}
                    />
                  )}

                  {/* Label con nombre de clase */}
                  {annotation.class && showLabels && !isLandmarkClass && (
                    <Group listening={false}>
                      <Rect
                        x={annotation.bbox.x * scale + imageOffset.x}
                        y={(annotation.bbox.y - labelHeight - 2) * scale + imageOffset.y}
                        width={labelWidth}
                        height={labelHeight}
                        fill={hoverColor}
                        cornerRadius={3}
                      />
                      <Text
                        x={annotation.bbox.x * scale + imageOffset.x + labelPadding}
                        y={(annotation.bbox.y - labelHeight) * scale + imageOffset.y}
                        text={translatedClass}
                        fontSize={labelFontSize}
                        fill={isHovered ? "black" : "white"}
                        fontStyle="bold"
                      />
                    </Group>
                  )}

                  {/* Render landmark circle if this is a landmark class */}
                  {isLandmarkClass && (() => {
                    const landmark = landmarks.find(l => {
                      const match = l.id.match(/manual-.*-(\d+)/);
                      return match && parseInt(match[1]) === annotation.id;
                    });

                    if (!landmark) return null;

                    const centerX = (annotation.bbox.x + annotation.bbox.width / 2) * scale + imageOffset.x;
                    const centerY = (annotation.bbox.y + annotation.bbox.height / 2) * scale + imageOffset.y;
                    const radius = landmark.radius * scale;
                    const isOpticDisc = landmark.type === 'optic_disc';
                    const color = isOpticDisc ? '#FF6B6B' : '#4ECDC4';
                    const strokeColor = isOpticDisc ? '#E63946' : '#2A9D8F';

                    return (
                      <Group>
                        {/* Outer ring */}
                        <Circle
                          x={centerX}
                          y={centerY}
                          radius={radius + 3}
                          stroke={strokeColor}
                          strokeWidth={2}
                          opacity={0.8}
                          listening={false}
                        />
                        {/* Main circle */}
                        <Circle
                          x={centerX}
                          y={centerY}
                          radius={radius}
                          fill={isOpticDisc ? 'transparent' : color}
                          opacity={0.5}
                          stroke={strokeColor}
                          strokeWidth={2}
                          listening={false}
                        />
                        {/* Center dot */}
                        <Circle
                          x={centerX}
                          y={centerY}
                          radius={3}
                          fill={strokeColor}
                          opacity={1}
                          listening={false}
                        />
                      </Group>
                    );
                  })()}
                </Group>
              );
            }
            return null;
          })}

          {/* New annotation being drawn */}
          {newAnnotation && newAnnotation.type === 'bbox' &&
           typeof newAnnotation.x === 'number' &&
           typeof newAnnotation.y === 'number' &&
           typeof newAnnotation.width === 'number' &&
           typeof newAnnotation.height === 'number' &&
           isFinite(newAnnotation.x) &&
           isFinite(newAnnotation.y) &&
           isFinite(newAnnotation.width) &&
           isFinite(newAnnotation.height) && (
            <Rect
              x={newAnnotation.x * scale + imageOffset.x}
              y={newAnnotation.y * scale + imageOffset.y}
              width={newAnnotation.width * scale}
              height={newAnnotation.height * scale}
              stroke="#FF6B6B"
              strokeWidth={2}
              dash={[10, 5]}
            />
          )}

          {/* Annotation pending class selection */}
          {pendingAnnotation &&
           typeof pendingAnnotation.x === 'number' &&
           typeof pendingAnnotation.y === 'number' &&
           typeof pendingAnnotation.width === 'number' &&
           typeof pendingAnnotation.height === 'number' &&
           isFinite(pendingAnnotation.x) &&
           isFinite(pendingAnnotation.y) &&
           isFinite(pendingAnnotation.width) &&
           isFinite(pendingAnnotation.height) && (
            <Rect
              x={pendingAnnotation.x * scale + imageOffset.x}
              y={pendingAnnotation.y * scale + imageOffset.y}
              width={pendingAnnotation.width * scale}
              height={pendingAnnotation.height * scale}
              stroke="#20B5AE"
              strokeWidth={2}
              dash={[5, 2]}
            />
          )}
        </Layer>

        {/* Ruler Measurements Layer */}
        {(measurementsLayer?.visible ?? true) && (measurements.length > 0 || (activeTool === 'ruler' && rulerOrigin)) && (
          <Layer
            opacity={measurementsLayer?.opacity ?? 1}
          >
            {/* Saved measurements */}
            {measurements.map((measurement) => {
              // Use effective measurement (with temp updates if dragging)
              const effectiveMeasurement = getEffectiveMeasurement(measurement);
              const { distancePixels, distanceDD } = calculateMeasurementMetrics(
                effectiveMeasurement.originX,
                effectiveMeasurement.originY,
                effectiveMeasurement.destinationX,
                effectiveMeasurement.destinationY
              );
              const measurementText = distanceDD
                ? `${distanceDD.toFixed(2)} DD`
                : `${distancePixels.toFixed(1)} px`;
              const midX = (effectiveMeasurement.originX + effectiveMeasurement.destinationX) / 2 * scale + imageOffset.x;
              const midY = (effectiveMeasurement.originY + effectiveMeasurement.destinationY) / 2 * scale + imageOffset.y;
              const isSelected = selectedMeasurementId === measurement.id;
              const color = isSelected ? "#f59e0b" : "#10b981";

              return (
                <Group key={`measurement-${measurement.id}`}>
                  {/* Origin marker */}
                  <Circle
                    x={effectiveMeasurement.originX * scale + imageOffset.x}
                    y={effectiveMeasurement.originY * scale + imageOffset.y}
                    radius={6 / stageScale}
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth={2 / stageScale}
                    draggable={activeTool === 'select'}
                    onDragMove={(e) => {
                      const x = (e.target.x() - imageOffset.x) / scale;
                      const y = (e.target.y() - imageOffset.y) / scale;
                      handleMeasurementDragMove(measurement.id!, 'origin', { x, y });
                    }}
                    onDragEnd={(e) => {
                      const x = (e.target.x() - imageOffset.x) / scale;
                      const y = (e.target.y() - imageOffset.y) / scale;
                      handleMeasurementDrag(measurement.id!, 'origin', { x, y });
                    }}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      if (activeTool === 'eraser') {
                        handleDeleteMeasurement(measurement.id!);
                      } else if (activeTool === 'select') {
                        onSelectMeasurement?.(measurement.id!);
                      }
                    }}
                    hitStrokeWidth={10}
                  />

                  {/* Line */}
                  <Line
                    points={[
                      effectiveMeasurement.originX * scale + imageOffset.x,
                      effectiveMeasurement.originY * scale + imageOffset.y,
                      effectiveMeasurement.destinationX * scale + imageOffset.x,
                      effectiveMeasurement.destinationY * scale + imageOffset.y,
                    ]}
                    stroke={color}
                    strokeWidth={3 / stageScale}
                    dash={[10 / stageScale, 5 / stageScale]}
                    draggable={activeTool === 'select'}
                    onDragMove={(e) => {
                      const dragDelta = {
                        x: e.target.x() / scale,
                        y: e.target.y() / scale
                      };
                      handleMeasurementDragMove(measurement.id!, 'line', { x: 0, y: 0 }, dragDelta);
                    }}
                    onDragEnd={(e) => {
                      // Get drag delta in image coordinates
                      const dragDelta = {
                        x: e.target.x() / scale,
                        y: e.target.y() / scale
                      };
                      handleMeasurementDrag(measurement.id!, 'line', { x: 0, y: 0 }, dragDelta);
                      e.target.position({ x: 0, y: 0 });
                    }}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      if (activeTool === 'eraser') {
                        handleDeleteMeasurement(measurement.id!);
                      } else if (activeTool === 'select') {
                        onSelectMeasurement?.(measurement.id!);
                      }
                    }}
                    hitStrokeWidth={15}
                  />

                  {/* Destination marker */}
                  <Circle
                    x={effectiveMeasurement.destinationX * scale + imageOffset.x}
                    y={effectiveMeasurement.destinationY * scale + imageOffset.y}
                    radius={6 / stageScale}
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth={2 / stageScale}
                    draggable={activeTool === 'select'}
                    onDragMove={(e) => {
                      const x = (e.target.x() - imageOffset.x) / scale;
                      const y = (e.target.y() - imageOffset.y) / scale;
                      handleMeasurementDragMove(measurement.id!, 'destination', { x, y });
                    }}
                    onDragEnd={(e) => {
                      const x = (e.target.x() - imageOffset.x) / scale;
                      const y = (e.target.y() - imageOffset.y) / scale;
                      handleMeasurementDrag(measurement.id!, 'destination', { x, y });
                    }}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      if (activeTool === 'eraser') {
                        handleDeleteMeasurement(measurement.id!);
                      } else if (activeTool === 'select') {
                        onSelectMeasurement?.(measurement.id!);
                      }
                    }}
                    hitStrokeWidth={10}
                  />

                  {/* Measurement text background */}
                  <Text
                    x={midX}
                    y={midY - 10 / stageScale}
                    text={measurementText}
                    fontSize={14 / stageScale}
                    fontStyle="bold"
                    fill="#ffffff"
                    stroke="#000000"
                    strokeWidth={3 / stageScale}
                    offsetX={measurementText.length * 4 / stageScale}
                    listening={false}
                  />
                  {/* Measurement text foreground */}
                  <Text
                    x={midX}
                    y={midY - 10 / stageScale}
                    text={measurementText}
                    fontSize={14 / stageScale}
                    fontStyle="bold"
                    fill={color}
                    offsetX={measurementText.length * 4 / stageScale}
                    listening={false}
                  />
                </Group>
              );
            })}

            {/* Current measurement in progress */}
            {activeTool === 'ruler' && rulerOrigin && (
              <>
                {/* Origin point marker */}
                <Circle
                  x={rulerOrigin.x * scale + imageOffset.x}
                  y={rulerOrigin.y * scale + imageOffset.y}
                  radius={4 / stageScale}
                  fill="#3b82f6"
                  stroke="#ffffff"
                  strokeWidth={2 / stageScale}
                />

                {/* Measurement line (only if destination is set) */}
                {rulerDestination && (
              <>
                <Line
                  points={[
                    rulerOrigin.x * scale + imageOffset.x,
                    rulerOrigin.y * scale + imageOffset.y,
                    rulerDestination.x * scale + imageOffset.x,
                    rulerDestination.y * scale + imageOffset.y,
                  ]}
                  stroke="#3b82f6"
                  strokeWidth={2 / stageScale}
                  dash={[10 / stageScale, 5 / stageScale]}
                />

                {/* Destination point marker */}
                <Circle
                  x={rulerDestination.x * scale + imageOffset.x}
                  y={rulerDestination.y * scale + imageOffset.y}
                  radius={4 / stageScale}
                  fill="#3b82f6"
                  stroke="#ffffff"
                  strokeWidth={2 / stageScale}
                />

                {/* Measurement text */}
                {(() => {
                  // Calculate distance in pixels
                  const dx = rulerDestination.x - rulerOrigin.x;
                  const dy = rulerDestination.y - rulerOrigin.y;
                  const distanceInPixels = Math.sqrt(dx * dx + dy * dy);

                  // Find optic disc detection to get DD reference
                  const opticDisc = detections.find(
                    d => d.class === 'optic_disc' || d.class === 'optic disc'
                  );

                  let measurementText = `${distanceInPixels.toFixed(1)} px`;

                  if (opticDisc) {
                    // Calculate optic disc diameter (average of width and height for more accuracy)
                    const discDiameter = (opticDisc.bbox.width + opticDisc.bbox.height) / 2;
                    const distanceInDD = distanceInPixels / discDiameter;
                    measurementText = `${distanceInDD.toFixed(2)} DD`;
                  }

                  // Position text at midpoint of line
                  const midX = (rulerOrigin.x + rulerDestination.x) / 2 * scale + imageOffset.x;
                  const midY = (rulerOrigin.y + rulerDestination.y) / 2 * scale + imageOffset.y;

                  return (
                    <>
                      {/* Background for text */}
                      <Text
                        x={midX}
                        y={midY - 10 / stageScale}
                        text={measurementText}
                        fontSize={14 / stageScale}
                        fontStyle="bold"
                        fill="#ffffff"
                        stroke="#000000"
                        strokeWidth={3 / stageScale}
                        offsetX={measurementText.length * 4 / stageScale}
                      />
                      {/* Foreground text */}
                      <Text
                        x={midX}
                        y={midY - 10 / stageScale}
                        text={measurementText}
                        fontSize={14 / stageScale}
                        fontStyle="bold"
                        fill="#3b82f6"
                        offsetX={measurementText.length * 4 / stageScale}
                      />
                    </>
                  );
                })()}
              </>
                )}
              </>
            )}
          </Layer>
        )}

        {/* Quadrant Grid Overlay */}
        <Layer>
          <Group
            x={imageOffset.x}
            y={imageOffset.y}
            scaleX={scale}
            scaleY={scale}
          >
            {/* Quadrant overlay */}
            <QuadrantOverlay
              visible={quadrantsLayer?.visible ?? true}
              opacity={quadrantsLayer?.opacity ?? 0.5}
              landmarks={landmarks}
              imageWidth={konvaImage?.width || 0}
              imageHeight={konvaImage?.height || 0}
            />

            {/* Macular zones overlay */}
            {macularEdemaData && (
              <MacularZonesOverlay
                visible={macularZonesLayer?.visible ?? false}
                opacity={macularZonesLayer?.opacity ?? 0.7}
                fovea={macularEdemaData.fovea}
                macularEdemaResult={{
                  detected: macularEdemaData.result.detected,
                  method: macularEdemaData.result.method,
                  exudatesInZone: macularEdemaData.result.exudatesInZone,
                  circinatePattern: macularEdemaData.result.circinatePattern,
                  description: macularEdemaData.result.clinicalDescription || '',
                  calibration: macularEdemaData.result.calibration,
                  circinateAnalysis: macularEdemaData.result.circinateAnalysis,
                }}
                zoneRadiusUm={macularEdemaData.zoneRadiusUm}
                showDiscDiameterZone={false}
                showLegend={false}
                showCircinateRings={circinateRingsLayer?.visible ?? false}
              />
            )}
          </Group>
        </Layer>

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