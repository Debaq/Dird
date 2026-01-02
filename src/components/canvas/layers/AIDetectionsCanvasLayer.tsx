import React from 'react';
import { Layer, Group, Rect, Circle, Text, Image as KonvaImage } from 'react-konva';
import { useTranslation } from 'react-i18next';
import { classManager } from '@/lib/classes/class-manager';
import { getClassName } from '@/lib/ai/class-translations';

interface Point {
  x: number;
  y: number;
}

interface AIDetectionsCanvasLayerProps {
  visible: boolean;
  opacity: number;
  detections: any[];
  segmentations: any[];
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
  onHover: (id: number | null) => void;
  onSelect: (id: string) => void;
  onDragStart: (id: number) => void;
  onUpdate: (id: number, attrs: any, isFinal: boolean) => void;
  onDelete: (detection: any) => void;
  onZoomToBbox: (bbox: any, isLandmark: boolean) => void;
}

export const AIDetectionsCanvasLayer: React.FC<AIDetectionsCanvasLayerProps> = ({
  visible,
  opacity,
  detections,
  segmentations,
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
  onHover,
  onSelect,
  onDragStart,
  onUpdate,
  onDelete,
  onZoomToBbox,
}) => {
  const { t, i18n } = useTranslation();

  return (
    <Layer
      name="ai-detections-layer"
      opacity={opacity}
      visible={visible}
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
            width={konvaImageWidth}
            height={konvaImageHeight}
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
                if (detection.id) onHover(detection.id);
              }}
              onMouseLeave={() => {
                onHover(null);
              }}
              onDragStart={() => detection.id && onDragStart(detection.id)}
              onClick={async (e) => {
                if (activeTool === 'eraser' && detection.id) {
                  e.cancelBubble = true;
                  onDelete(detection);
                } else if (activeTool === 'select' && detection.id) {
                  onSelect(String(detection.id));
                  e.cancelBubble = true;
                } else if (activeTool === 'zoom' && detection.id) {
                  onZoomToBbox(detection.bbox, isLandmarkClass);
                  e.cancelBubble = true;
                }
              }}
              onDragEnd={(e) => {
                if (detection.id) {
                  onUpdate(detection.id, {
                    x: e.target.x(),
                    y: e.target.y(),
                    width: e.target.width() * e.target.scaleX(),
                    height: e.target.height() * e.target.scaleY()
                  }, true);
                }
              }}
              onTransformStart={() => detection.id && onDragStart(detection.id)}
              onTransformEnd={(e) => {
                if (detection.id) {
                  const node = e.target;
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  node.scaleX(1);
                  node.scaleY(1);
                  onUpdate(detection.id, {
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
                x={(detection.bbox.x * scale + imageOffset.x) + (detection.bbox.width * scale) / 2}
                y={(detection.bbox.y * scale + imageOffset.y) + (detection.bbox.height * scale) / 2}
                radius={5}
                fill="white"
                stroke="black"
                strokeWidth={1}
                draggable
                onDragStart={() => detection.id && onDragStart(detection.id)}
                onDragMove={(e) => {
                  const circle = e.target;
                  const stage = circle.getStage();
                  const rect = stage?.findOne('#det-' + detection.id);
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
                  const rect = stage?.findOne('#det-' + detection.id);
                  if (rect && detection.id) {
                    onUpdate(detection.id, {
                      x: rect.x(),
                      y: rect.y(),
                      width: rect.width() * rect.scaleX(),
                      height: rect.height() * rect.scaleY()
                    }, true);
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
  );
};
