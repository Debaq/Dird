import React, { useMemo } from 'react';
import { Layer, Group, Circle, Line, Text } from 'react-konva';
import type { CanvasTool } from '../ToolPanel';

interface Point {
  x: number;
  y: number;
}

interface MeasurementsCanvasLayerProps {
  visible: boolean;
  opacity: number;
  measurements: any[];
  detections: any[];
  activeTool: CanvasTool;
  rulerOrigin: Point | null;
  rulerDestination: Point | null;
  scale: number;
  imageOffset: Point;
  stageScale: number;
  selectedMeasurementId: number | null;
  tempMeasurementUpdates: Map<number, { originX: number; originY: number; destinationX: number; destinationY: number }>;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onDragMove: (
    id: number,
    part: 'origin' | 'destination' | 'line',
    newPos: { x: number; y: number },
    dragDelta?: { x: number; y: number }
  ) => void;
  onDragEnd: (
    id: number,
    part: 'origin' | 'destination' | 'line',
    newPos: { x: number; y: number },
    dragDelta?: { x: number; y: number }
  ) => void;
}

export const MeasurementsCanvasLayer: React.FC<MeasurementsCanvasLayerProps> = ({
  visible,
  opacity,
  measurements,
  detections,
  activeTool,
  rulerOrigin,
  rulerDestination,
  scale,
  imageOffset,
  stageScale,
  selectedMeasurementId,
  tempMeasurementUpdates,
  onSelect,
  onDelete,
  onDragMove,
  onDragEnd,
}) => {
  if (!visible && (!rulerOrigin || activeTool !== 'ruler')) return null;

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
      (d: any) => d.class === 'optic_disc' || d.class === 'optic disc'
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

  return (
    <Layer opacity={opacity}>
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
                onDragMove(measurement.id!, 'origin', { x, y });
              }}
              onDragEnd={(e) => {
                const x = (e.target.x() - imageOffset.x) / scale;
                const y = (e.target.y() - imageOffset.y) / scale;
                onDragEnd(measurement.id!, 'origin', { x, y });
              }}
              onClick={(e) => {
                e.cancelBubble = true;
                if (activeTool === 'eraser') {
                  onDelete(measurement.id!);
                } else if (activeTool === 'select') {
                  onSelect(measurement.id!);
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
                onDragMove(measurement.id!, 'line', { x: 0, y: 0 }, dragDelta);
              }}
              onDragEnd={(e) => {
                // Get drag delta in image coordinates
                const dragDelta = {
                  x: e.target.x() / scale,
                  y: e.target.y() / scale
                };
                onDragEnd(measurement.id!, 'line', { x: 0, y: 0 }, dragDelta);
                e.target.position({ x: 0, y: 0 });
              }}
              onClick={(e) => {
                e.cancelBubble = true;
                if (activeTool === 'eraser') {
                  onDelete(measurement.id!);
                } else if (activeTool === 'select') {
                  onSelect(measurement.id!);
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
                onDragMove(measurement.id!, 'destination', { x, y });
              }}
              onDragEnd={(e) => {
                const x = (e.target.x() - imageOffset.x) / scale;
                const y = (e.target.y() - imageOffset.y) / scale;
                onDragEnd(measurement.id!, 'destination', { x, y });
              }}
              onClick={(e) => {
                e.cancelBubble = true;
                if (activeTool === 'eraser') {
                  onDelete(measurement.id!);
                } else if (activeTool === 'select') {
                  onSelect(measurement.id!);
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
                  (d: any) => d.class === 'optic_disc' || d.class === 'optic disc'
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
  );
};
