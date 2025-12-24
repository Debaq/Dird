import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Stage, Layer, Image as KonvaImage, Rect, Group, Text } from 'react-konva';
import { RotateCcw, RotateCw } from 'lucide-react';
import type { Image } from '@/lib/db/schema';
import type { CanvasTool } from './ToolPanel';
import type { CanvasLayer } from './LayerControls';
import { db } from '@/lib/db/schema';
import { classManager } from '@/lib/classes/class-manager';
import ClassSelectionModal from './ClassSelectionModal';
import { getClassName } from '@/lib/ai/class-translations';
import { useConfigStore } from '@/stores/config-store';

interface AnnotationCanvasProps {
  image: Image;
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

  // Load image
  useEffect(() => {
    console.log('📸 Iniciando carga de imagen...');
    setIsCanvasReady(false); // Reset cuando cambia la imagen

    const img = new window.Image();
    const url = URL.createObjectURL(image.originalBlob);

    img.onload = () => {
      console.log('📸 Imagen cargada, configurando canvas...');
      setKonvaImage(img);
      calculateScale(img.width, img.height);
      URL.revokeObjectURL(url);

      // Dar un pequeño delay para que Konva termine de renderizar
      setTimeout(() => {
        console.log('✅ Canvas listo para recibir detecciones');
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
    setStagePos({
      x: e.target.x(),
      y: e.target.y(),
    });
  };

  // Handle annotation drawing
  const handleMouseDown = (e: any) => {
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
      console.log('🔄 Detecciones o configuración cambiaron, forzando re-mount.');
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
  const [detectionHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Handle class selection from modal
  const handleClassSelected = async (className: string) => {
    if (!pendingAnnotation || !image.id) return;

    try {
      // Guardar en base de datos como detección manual
      await db.detections.add({
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
      });

      // Agregar al estado local para visualización inmediata
      setAnnotations([
        ...annotations,
        { ...pendingAnnotation, class: className }
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

    const lastOperation = detectionHistory[historyIndex];

    if (lastOperation.type === 'delete') {
      // Para deshacer una eliminación, necesitamos recrear la detección
      const newDetection = {
        ...lastOperation.detection,
        id: undefined, // Eliminar el ID para que Dexie genere uno nuevo
      };

      await db.detections.add(newDetection);
      onAnnotationAdded?.();
    }

    setHistoryIndex(prev => prev - 1);
  };

  // Función para rehacer la última operación deshecha
  const handleRedo = async () => {
    if (historyIndex >= detectionHistory.length - 1) return;

    const nextOperation = detectionHistory[historyIndex + 1];

    if (nextOperation.type === 'delete') {
      await db.detections.delete(nextOperation.detection.id);
      onAnnotationAdded?.();
    }

    setHistoryIndex(prev => prev + 1);
  };

  // Manejar teclas de acceso rápido (Ctrl+Z para deshacer, Ctrl+Y o Ctrl+Shift+Z para rehacer)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, detectionHistory]);

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

            return (
              <Group key={`detection-${detection.id || idx}`}>
                <Rect
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
                  onMouseEnter={() => {
                    console.log('🟦 HOVER ENTER - Detection ID:', detection.id, 'Class:', detection.class);
                    if (detection.id) setHoveredDetectionId(detection.id);
                  }}
                  onMouseLeave={() => {
                    console.log('🟦 HOVER LEAVE - Detection ID:', detection.id);
                    setHoveredDetectionId(null);
                  }}
                  onClick={(e) => {
                    console.log('🟦 CLICK - Detection ID:', detection.id, 'Tool:', activeTool);
                    if (activeTool === 'eraser' && detection.id) {
                      e.cancelBubble = true;
                      db.detections.delete(detection.id).then(() => {
                        onAnnotationAdded?.();
                      });
                    }
                  }}
                />
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

            // Verificar si es una detección de la base de datos (tiene bbox)
            if (annotation.bbox) {
              return (
                <Group key={`manual-${annotation.id || idx}`}>
                  {/* Caja de anotación */}
                  <Rect
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
                    onMouseEnter={() => {
                      console.log('🟧 HOVER ENTER - Manual ID:', annotation.id, 'Class:', annotation.class);
                      if (annotation.id) setHoveredDetectionId(annotation.id);
                    }}
                    onMouseLeave={() => {
                      console.log('🟧 HOVER LEAVE - Manual ID:', annotation.id);
                      setHoveredDetectionId(null);
                    }}
                    onClick={(e) => {
                      console.log('🟧 CLICK - Manual ID:', annotation.id, 'Tool:', activeTool);
                      if (activeTool === 'eraser' && annotation.id) {
                        e.cancelBubble = true;
                        db.detections.delete(annotation.id).then(() => {
                          onAnnotationAdded?.();
                        });
                      }
                    }}
                  />
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
