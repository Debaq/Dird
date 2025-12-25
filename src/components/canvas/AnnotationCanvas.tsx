import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Stage, Layer, Image as KonvaImage, Rect, Group, Text, Transformer, Circle } from 'react-konva';
import { RotateCcw, RotateCw, Brain, Loader2 } from 'lucide-react';
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

interface AnnotationCanvasProps {
  image: ImageType;
  detections?: any[];
  manualAnnotations?: any[];
  activeTool?: CanvasTool;
  layers?: CanvasLayer[];
  onAnnotationAdded?: () => void;
}

const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({
  image,
  detections = [],
  manualAnnotations = [],
  activeTool = 'select',
  layers = [],
  onAnnotationAdded,
}) => {
  const { i18n } = useTranslation();
  const { config } = useConfigStore();
  const { selectedAnnotationId, setSelectedAnnotation } = useCanvasStore();
  const rainbowMode = config.appearance.rainbowMode; // Subscribe to rainbow mode changes

  // Key único para forzar re-mount cuando cambian detecciones o rainbow mode
  const [canvasKey, setCanvasKey] = useState(0);

  // CRÍTICO: Solo mostrar detecciones cuando todo esté listo
  const [isCanvasReady, setIsCanvasReady] = useState(false);

  // Obtener configuración de capas
  const aiDetectionsLayer = layers.find(l => l.id === 'detections-ai');
  const manualAnnotationsLayer = layers.find(l => l.id === 'manual-annotations');
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const [konvaImage, setKonvaImage] = useState<HTMLImageElement | null>(null);
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

  // Handle updates (drag/resize)
  const handleAnnotationChange = async (id: number, newAttrs: any) => {
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
      // The shape in Konva is at (bbox.x * scale + imageOffset.x)
      // We need to reverse this to get bbox.x
      const bbox = {
        x: (newAttrs.x - imageOffset.x) / scale,
        y: (newAttrs.y - imageOffset.y) / scale,
        width: newAttrs.width / scale,
        height: newAttrs.height / scale,
      };

      const newState = {
        ...detection,
        bbox,
        type: detection.type === 'ai' ? 'manual' : detection.type
      };

      addToHistory({
        type: 'update',
        before: detection,
        after: newState
      });

      if (detection.type === 'ai') {
        // Change to manual
        await db.detections.update(id, {
          bbox,
          type: 'manual'
        });
      } else {
        await db.detections.update(id, {
          bbox
        });
      }
      onAnnotationAdded?.();
    } catch (error) {
      console.error('Error updating annotation:', error);
    }
  };

  const checkDeselect = (e: any) => {
    // deselect when clicked on empty area
    const clickedOnEmpty = e.target === e.target.getStage();
    const clickedOnImage = e.target.getClassName() === 'Image';
    
    if (clickedOnEmpty || clickedOnImage) {
      setSelectedAnnotation(null);
    }
  };

  // Load image
  useEffect(() => {
    setIsCanvasReady(false); // Reset cuando cambia la imagen

    const img = new window.Image();
    const url = URL.createObjectURL(image.originalBlob);

    img.onload = () => {
      setKonvaImage(img);
      calculateScale(img.width, img.height);
      URL.revokeObjectURL(url);

      // Dar un pequeño delay para que Konva termine de renderizar
      setTimeout(() => {
        setIsCanvasReady(true);
      }, 100);
    };

    img.src = url;
  }, [image]);

  // Calculate scale to COVER canvas - image fills 100% of container (cover behavior)
  const calculateScale = (imgWidth: number, imgHeight: number) => {
    if (!containerRef.current) return;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight || 600;

    // Calculate scale to cover container maintaining aspect ratio
    const scaleX = containerWidth / imgWidth;
    const scaleY = containerHeight / imgHeight;

    // Use the SMALLER scale to ensure image fits 100% within container (contain behavior)
    const newScale = Math.min(scaleX, scaleY);

    // Calculate offset to center the image
    const scaledWidth = imgWidth * newScale;
    const scaledHeight = imgHeight * newScale;
    const offsetX = (containerWidth - scaledWidth) / 2;
    const offsetY = (containerHeight - scaledHeight) / 2;

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

  // Handle annotation drawing
  const handleMouseDown = (e: any) => {
    checkDeselect(e);

    // Middle mouse button (button 1) always enables panning
    if (e.evt.button === 1) {
      setIsPanning(true);
      e.evt.preventDefault();
      return;
    }

    if (activeTool === 'pan' || activeTool === 'zoom') {
      setIsPanning(true);
      return;
    }

    if (activeTool === 'bbox' || activeTool === 'circle') {
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
        // En lugar de guardar directamente, guardar como pendiente y abrir modal
        setPendingAnnotation({
          ...newAnnotation,
          ...clampedBbox,
          id: Date.now()
        });
        setIsClassModalOpen(true);
      }
      setNewAnnotation(null);
    }
    setIsDrawing(false);
    setIsPanning(false);
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

  // Estado para el historial de deshacer/rehacer
  type HistoryEntry = 
    | { type: 'add'; detection: any }
    | { type: 'delete'; detection: any }
    | { type: 'update'; before: any; after: any };

  const [detectionHistory, setDetectionHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const addToHistory = (entry: HistoryEntry) => {
    const newHistory = detectionHistory.slice(0, historyIndex + 1);
    newHistory.push(entry);
    setDetectionHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleClassSelected = async (className: string) => {
    if (!pendingAnnotation || !image.id) return;

    try {
      const newDetectionData: Detection = {
        imageId: image.id,
        type: 'manual',
        bbox: {
          x: pendingAnnotation.x,
          y: pendingAnnotation.y,
          width: pendingAnnotation.width,
          height: pendingAnnotation.height
        },
        class: className,
        visible: true,
        createdAt: new Date()
      };

      // Guardar en base de datos como detección manual
      const newId = await db.detections.add(newDetectionData);
      
      const savedDetection = { ...newDetectionData, id: newId };
      
      addToHistory({ type: 'add', detection: savedDetection });

      // Agregar al estado local para visualización inmediata
      setAnnotations([
        ...annotations,
        { ...pendingAnnotation, class: className, id: newId }
      ]);

      // Limpiar estados
      setPendingAnnotation(null);
      setIsClassModalOpen(false);

      // Callback opcional para refrescar detecciones desde BD
      onAnnotationAdded?.();
    } catch (error) {
      console.error('Error al guardar anotación:', error);
      alert('Error al guardar la anotación. Por favor intenta de nuevo.');
    }
  };

  // Función para deshacer la última operación
  const handleUndo = async () => {
    if (historyIndex < 0) return;

    const entry = detectionHistory[historyIndex];

    try {
      if (entry.type === 'add') {
        // Deshacer agregar: eliminar
        if (entry.detection.id) {
          await db.detections.delete(entry.detection.id);
        }
      } else if (entry.type === 'delete') {
        // Deshacer eliminar: volver a agregar (preservando ID)
        await db.detections.add(entry.detection);
      } else if (entry.type === 'update') {
        // Deshacer actualizar: volver al estado anterior
        await db.detections.put(entry.before);
      }
      
      onAnnotationAdded?.();
      setHistoryIndex(prev => prev - 1);
    } catch (error) {
      console.error('Error in undo:', error);
    }
  };

  // Función para rehacer la última operación deshecha
  const handleRedo = async () => {
    if (historyIndex >= detectionHistory.length - 1) return;

    const entry = detectionHistory[historyIndex + 1];

    try {
      if (entry.type === 'add') {
        // Rehacer agregar: volver a agregar
        await db.detections.add(entry.detection);
      } else if (entry.type === 'delete') {
        // Rehacer eliminar: volver a eliminar
        if (entry.detection.id) {
          await db.detections.delete(entry.detection.id);
        }
      } else if (entry.type === 'update') {
        // Rehacer actualizar: volver al estado nuevo
        await db.detections.put(entry.after);
      }

      onAnnotationAdded?.();
      setHistoryIndex(prev => prev + 1);
    } catch (error) {
      console.error('Error in redo:', error);
    }
  };

  const handleReDetect = async () => {
    if (!image.id || isProcessing) return;

    if (!confirm('Esto eliminará todas las detecciones de IA actuales para esta imagen y volverá a ejecutar el análisis. ¿Continuar?')) {
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
      alert('Error al ejecutar la re-detección.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Manejar teclas de acceso rápido (Ctrl+Z para deshacer, Ctrl+Y o Ctrl+Shift+Z para rehacer, Flechas para mover)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo/Redo
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        } else if ((e.key === 'y' || e.key === 'Y') && !e.shiftKey) {
          handleRedo();
        }
      }

      // Move selected annotation with arrow keys
      if (selectedAnnotationId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        
        const detection = 
          detections.find(d => String(d.id) === selectedAnnotationId) ||
          manualAnnotations.find(d => String(d.id) === selectedAnnotationId);

        if (!detection) return;

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

        handleAnnotationChange(detection.id, {
          x: canvasX,
          y: canvasY,
          width: canvasWidth,
          height: canvasHeight
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, detectionHistory, selectedAnnotationId, detections, manualAnnotations, scale, imageOffset]);

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
        return 'zoom-in';
      case 'bbox':
      case 'circle':
        return 'crosshair';
      case 'eraser':
        return 'not-allowed';
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
            onClick={handleUndo}
            disabled={historyIndex < 0}
            className={`p-2 rounded-lg ${historyIndex < 0 ? 'bg-gray-200 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-100 shadow'}`}
            title="Deshacer (Ctrl+Z)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= detectionHistory.length - 1}
            className={`p-2 rounded-lg ${historyIndex >= detectionHistory.length - 1 ? 'bg-gray-200 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-100 shadow'}`}
            title="Rehacer (Ctrl+Y)"
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
        </div>
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
          draggable={activeTool === 'pan' || isPanning}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
        {/* Original Image Layer */}
        <Layer>
          <KonvaImage
            image={konvaImage}
            x={imageOffset.x}
            y={imageOffset.y}
            width={konvaImage.width}
            height={konvaImage.height}
            scaleX={scale}
            scaleY={scale}
          />
        </Layer>

        {/* AI Detections Layer */}
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
              text="Cargando detecciones..."
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
              text="No hay detecciones en esta imagen"
              fontSize={14}
              fill="#FF6B6B"
              padding={8}
              listening={false}
            />
          )}
          {isCanvasReady && detections.map((detection, idx) => {
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
                  fill={`${detectionColor}1A`} // 10% opacity
                  stroke={isHovered ? "#FFD700" : detectionColor}
                  strokeWidth={isHovered ? 3 : 1.5}
                  dash={isHovered ? [] : [8, 4]}
                  hitStrokeWidth={10}
                  perfectDrawEnabled={false}
                  draggable={activeTool === 'select' && isSelected}
                  onMouseEnter={() => {
                    if (detection.id) setHoveredDetectionId(detection.id);
                  }}
                  onMouseLeave={() => {
                    setHoveredDetectionId(null);
                  }}
                  onClick={async (e) => {
                    if (activeTool === 'eraser' && detection.id) {
                      e.cancelBubble = true;
                      addToHistory({ type: 'delete', detection: detection });
                      await db.detections.delete(detection.id);
                      onAnnotationAdded?.();
                    } else if (activeTool === 'select' && detection.id) {
                      setSelectedAnnotation(String(detection.id));
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
                      });
                    }
                  }}
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
                      });
                    }
                  }}
                />
                
                {isSelected && (
                  <Circle
                    x={(detection.bbox.x * scale + imageOffset.x) + (detection.bbox.width * scale) / 2}
                    y={(detection.bbox.y * scale + imageOffset.y) + (detection.bbox.height * scale) / 2}
                    radius={5}
                    fill="white"
                    stroke="black"
                    strokeWidth={1}
                    draggable
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
                        });
                      }
                    }}
                  />
                )}

                {showLabels && (
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
              </Group>
            );
          })}
        </Layer>

        {/* Manual Annotations Layer */}
        <Layer
          name="manual-annotations-layer"
          opacity={manualAnnotationsLayer?.opacity ?? 1}
          visible={manualAnnotationsLayer?.visible ?? true}
          listening={true}
        >
          {/* Saved annotations from database */}
          {isCanvasReady && manualAnnotations?.map((annotation, idx) => {
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
                    draggable={activeTool === 'select' && isSelected}
                    onMouseEnter={() => {
                      if (annotation.id) setHoveredDetectionId(annotation.id);
                    }}
                    onMouseLeave={() => {
                      setHoveredDetectionId(null);
                    }}
                                      onClick={async (e) => {
                                        if (activeTool === 'eraser' && annotation.id) {
                                          e.cancelBubble = true;
                                          addToHistory({ type: 'delete', detection: annotation });
                                          await db.detections.delete(annotation.id);
                                          onAnnotationAdded?.();
                                        } else if (activeTool === 'select' && annotation.id) {
                                          setSelectedAnnotation(String(annotation.id));
                                          e.cancelBubble = true;
                                        }
                                      }}                    onDragEnd={(e) => {
                      if (annotation.id) {
                        handleAnnotationChange(annotation.id, {
                          x: e.target.x(),
                          y: e.target.y(),
                          width: e.target.width() * e.target.scaleX(),
                          height: e.target.height() * e.target.scaleY()
                        });
                      }
                    }}
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
                        });
                      }
                    }}
                  />
                  
                  {isSelected && (
                    <Circle
                      x={(annotation.bbox.x * scale + imageOffset.x) + (annotation.bbox.width * scale) / 2}
                      y={(annotation.bbox.y * scale + imageOffset.y) + (annotation.bbox.height * scale) / 2}
                      radius={5}
                      fill="white"
                      stroke="black"
                      strokeWidth={1}
                      draggable
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
                          });
                        }
                      }}
                    />
                  )}

                  {/* Label con nombre de clase */}
                  {annotation.class && showLabels && (
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
                </Group>
              );
            }
            return null;
          })}

          {/* New annotation being drawn */}
          {newAnnotation && newAnnotation.type === 'bbox' && (
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
          {newAnnotation && newAnnotation.type === 'circle' && (
            <Rect
              x={newAnnotation.x * scale + imageOffset.x}
              y={newAnnotation.y * scale + imageOffset.y}
              width={newAnnotation.width * scale}
              height={newAnnotation.height * scale}
              cornerRadius={[
                Math.abs(newAnnotation.width * scale) / 2,
                Math.abs(newAnnotation.height * scale) / 2,
              ]}
              stroke="#FFD93D"
              strokeWidth={2}
              dash={[10, 5]}
            />
          )}

          {/* Annotation pending class selection */}
          {pendingAnnotation && (
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
  </>
  );
};

export default AnnotationCanvas;