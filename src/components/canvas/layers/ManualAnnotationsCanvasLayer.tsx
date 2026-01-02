import React from 'react';
import { Layer, Group, Rect, Circle, Text, Image as KonvaImage } from 'react-konva';
import { useTranslation } from 'react-i18next';
import { classManager } from '@/lib/classes/class-manager';
import { getClassName } from '@/lib/ai/class-translations';

interface Point {
  x: number;
  y: number;
}

interface ManualAnnotationsCanvasLayerProps {
  visible: boolean;
  opacity: number;
  manualAnnotations: any[];
  manualSegmentations: any[];
  segmentationImages: Map<number, HTMLImageElement>;
  konvaImageWidth: number;
  konvaImageHeight: number;
  scale: number;
  imageOffset: Point;
  activeTool: string;
  selectedAnnotationId: string | null;
  hoveredDetectionId: number | null;
  showLabels: boolean;
  landmarks: any[];
  isCanvasReady: boolean;
  newAnnotation: any;
  pendingAnnotation: any;
  onHover: (id: number | null) => void;
  onSelect: (id: string) => void;
  onDragStart: (id: number) => void;
  onUpdate: (id: number, attrs: any, isFinal: boolean) => void;
  onDelete: (detection: any) => void;
  onZoomToBbox: (bbox: any, isLandmark: boolean) => void;
}

export const ManualAnnotationsCanvasLayer: React.FC<ManualAnnotationsCanvasLayerProps> = ({
  visible,
  opacity,
  manualAnnotations,
  manualSegmentations,
  segmentationImages,
  konvaImageWidth,
  konvaImageHeight,
  scale,
  imageOffset,
  activeTool,
  selectedAnnotationId,
  hoveredDetectionId,
  showLabels,
  landmarks,
  isCanvasReady,
  newAnnotation,
  pendingAnnotation,
  onHover,
  onSelect,
  onDragStart,
  onUpdate,
  onDelete,
  onZoomToBbox,
}) => {
  const { i18n } = useTranslation();

  return (
    <Layer
      name="manual-annotations-layer"
      opacity={opacity}
      visible={visible}
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
            width={konvaImageWidth}
            height={konvaImageHeight}
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
                  if (annotation.id) onHover(annotation.id);
                }}
                onMouseLeave={() => {
                  onHover(null);
                }}
                onDragStart={() => annotation.id && onDragStart(annotation.id)}
                onClick={async (e) => {
                  if (activeTool === 'eraser' && annotation.id) {
                    e.cancelBubble = true;
                    onDelete(annotation);
                  } else if (activeTool === 'select' && annotation.id) {
                    onSelect(String(annotation.id));
                    e.cancelBubble = true;
                  } else if (activeTool === 'zoom' && annotation.id) {
                    onZoomToBbox(annotation.bbox, isLandmarkClass);
                    e.cancelBubble = true;
                  }
                }}
                onDragEnd={(e) => {
                  if (annotation.id) {
                    onUpdate(annotation.id, {
                      x: e.target.x(),
                      y: e.target.y(),
                      width: e.target.width() * e.target.scaleX(),
                      height: e.target.height() * e.target.scaleY()
                    }, true);
                  }
                }}
                onTransformStart={() => annotation.id && onDragStart(annotation.id)}
                onTransformEnd={(e) => {
                  if (annotation.id) {
                    const node = e.target;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    node.scaleX(1);
                    node.scaleY(1);
                    onUpdate(annotation.id, {
                      x: node.x(),
                      y: node.y(),
                      width: Math.max(5, node.width() * scaleX),
                      height: Math.max(5, node.height() * scaleY),
                      rotation: node.rotation()
                    }, true);
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
                  onDragStart={() => annotation.id && onDragStart(annotation.id)}
                  onDragMove={(e) => {
                    const circle = e.target;
                    const stage = circle.getStage();
                    const rect = stage?.findOne('#det-' + annotation.id);
                    if (rect) {
                      const w = rect.width() * rect.scaleX();
                      const h = rect.height() * rect.scaleY();
                      rect.x(circle.x() - w / 2);
                      rect.y(circle.y() - h / 2);
                    }
                  }}
                  onDragEnd={(e) => {
                    const circle = e.target;
                    const stage = circle.getStage();
                    const rect = stage?.findOne('#det-' + annotation.id);
                    if (rect && annotation.id) {
                      onUpdate(annotation.id, {
                        x: rect.x(),
                        y: rect.y(),
                        width: rect.width() * rect.scaleX(),
                        height: rect.height() * rect.scaleY()
                      }, true);
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
  );
};
