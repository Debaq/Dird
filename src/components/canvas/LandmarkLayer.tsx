import { Circle, Group } from 'react-konva';
import type { Landmark } from '@/types/annotations';

interface LandmarkLayerProps {
  landmarks: Landmark[];
  activeTool: string;
  selectedAnnotationId?: string | null;
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
  selectedAnnotationId: _selectedAnnotationId,
  onLandmarkClick,
  onLandmarkDragEnd,
}: LandmarkLayerProps) {
  const isLandmarkTool = activeTool === 'landmark';
  const isSelectTool = activeTool === 'select';

  return (
    <>
      {landmarks.map((landmark) => {
        if (!landmark.visible) return null;

        const isOpticDisc = landmark.type === 'optic_disc';

        // Colors based on type
        const color = isOpticDisc ? '#FF6B6B' : '#4ECDC4';
        const strokeColor = isOpticDisc ? '#E63946' : '#2A9D8F';

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
            onClick={(e) => {
              // Allow click selection with both landmark and select tools
              if (isLandmarkTool || isSelectTool) {
                e.cancelBubble = true;
                onLandmarkClick(landmark.id);
              }
            }}
            onTap={(e) => {
              if (isLandmarkTool || isSelectTool) {
                e.cancelBubble = true;
                onLandmarkClick(landmark.id);
              }
            }}
          >
            {/* Outer ring (for visibility) */}
            <Circle
              radius={landmark.radius + 3}
              stroke={strokeColor}
              strokeWidth={2}
              opacity={0.8}
            />

            {/* Main circle - optic disc has no fill, fovea has fill */}
            <Circle
              radius={landmark.radius}
              fill={isOpticDisc ? 'transparent' : color}
              opacity={landmark.source === 'ai' ? 0.3 : 0.5}
              stroke={strokeColor}
              strokeWidth={2}
            />

            {/* Center dot */}
            <Circle
              radius={3}
              fill={strokeColor}
              opacity={1}
            />
          </Group>
        );
      })}
    </>
  );
}
