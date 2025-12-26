import { Circle, Group, Text } from 'react-konva';
import type { Landmark } from '@/types/annotations';

interface LandmarkLayerProps {
  landmarks: Landmark[];
  activeTool: string;
  onLandmarkClick: (landmarkId: string) => void;
  onLandmarkDragEnd: (landmarkId: string, x: number, y: number) => void;
}

/**
 * LandmarkLayer
 *
 * Renders anatomical landmarks (optic disc and fovea) on the canvas
 * Allows dragging to reposition landmarks
 */
export function LandmarkLayer({
  landmarks,
  activeTool,
  onLandmarkClick,
  onLandmarkDragEnd,
}: LandmarkLayerProps) {
  const isLandmarkTool = activeTool === 'landmark';

  return (
    <>
      {landmarks.map((landmark) => {
        if (!landmark.visible) return null;

        const isOpticDisc = landmark.type === 'optic_disc';

        // Colors based on type
        const color = isOpticDisc ? '#FF6B6B' : '#4ECDC4';
        const strokeColor = isOpticDisc ? '#E63946' : '#2A9D8F';
        const labelColor = '#FFFFFF';

        // Label
        const label = isOpticDisc ? 'OD' : 'F';
        const fullLabel = isOpticDisc ? 'Optic Disc' : 'Fovea';

        return (
          <Group
            key={landmark.id}
            draggable={isLandmarkTool}
            x={landmark.x}
            y={landmark.y}
            onDragEnd={(e) => {
              const node = e.target;
              onLandmarkDragEnd(landmark.id, node.x(), node.y());
            }}
            onClick={() => onLandmarkClick(landmark.id)}
            onTap={() => onLandmarkClick(landmark.id)}
          >
            {/* Outer ring (for visibility) */}
            <Circle
              radius={landmark.radius + 3}
              stroke={strokeColor}
              strokeWidth={2}
              opacity={0.8}
            />

            {/* Main circle */}
            <Circle
              radius={landmark.radius}
              fill={color}
              opacity={landmark.source === 'ai' ? 0.3 : 0.5}
              stroke={strokeColor}
              strokeWidth={1}
            />

            {/* Center dot */}
            <Circle
              radius={3}
              fill={strokeColor}
              opacity={1}
            />

            {/* Label background */}
            <Circle
              y={-landmark.radius - 15}
              radius={12}
              fill={strokeColor}
              opacity={0.9}
            />

            {/* Label text */}
            <Text
              y={-landmark.radius - 20}
              text={label}
              fontSize={10}
              fontStyle="bold"
              fill={labelColor}
              align="center"
              offsetX={5}
              listening={false}
            />

            {/* Full label (shown when hovering or landmark tool active) */}
            {isLandmarkTool && (
              <Text
                y={landmark.radius + 5}
                text={fullLabel}
                fontSize={11}
                fill={strokeColor}
                fontStyle="bold"
                align="center"
                offsetX={fullLabel.length * 3}
                listening={false}
              />
            )}

            {/* Source indicator (AI vs Manual) */}
            {landmark.source === 'ai' && landmark.confidence && (
              <Text
                y={landmark.radius + 20}
                text={`AI: ${(landmark.confidence * 100).toFixed(0)}%`}
                fontSize={9}
                fill="#666"
                align="center"
                offsetX={25}
                listening={false}
              />
            )}
          </Group>
        );
      })}
    </>
  );
}
