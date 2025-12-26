import { Line, Circle, Text, Group } from 'react-konva';
import type { Landmark } from '@/types/annotations';

interface QuadrantOverlayProps {
  visible: boolean;
  opacity: number;
  landmarks: Landmark[];
  imageWidth: number;
  imageHeight: number;
}

/**
 * QuadrantOverlay
 *
 * Draws quadrant division lines on the canvas based on anatomical landmarks
 * (optic disc and fovea) or uses fallback center-based division.
 */
export function QuadrantOverlay({
  visible,
  opacity,
  landmarks,
  imageWidth,
  imageHeight,
}: QuadrantOverlayProps) {
  if (!visible || imageWidth === 0 || imageHeight === 0) {
    return null;
  }

  // Find optic disc and fovea landmarks
  const opticDisc = landmarks.find(l => l.type === 'optic_disc' && l.visible);
  const fovea = landmarks.find(l => l.type === 'fovea' && l.visible);

  // Get colors (subtle, not intrusive)
  const lineColor = 'rgba(100, 180, 255, 0.6)'; // Light blue
  const labelColor = 'rgba(100, 180, 255, 0.9)';

  return (
    <Group listening={false}>
      {opticDisc && fovea ? (
        // Anatomical reference mode
        <AnatomicalQuadrants
          opticDisc={opticDisc}
          fovea={fovea}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          lineColor={lineColor}
          labelColor={labelColor}
          opacity={opacity}
        />
      ) : (
        // Fallback: simple center-based division
        <FallbackQuadrants
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          lineColor={lineColor}
          labelColor={labelColor}
          opacity={opacity}
        />
      )}
    </Group>
  );
}

/**
 * Anatomical quadrants based on optic disc and fovea
 */
function AnatomicalQuadrants({
  opticDisc,
  fovea,
  imageWidth,
  imageHeight,
  lineColor,
  labelColor,
  opacity,
}: {
  opticDisc: Landmark;
  fovea: Landmark;
  imageWidth: number;
  imageHeight: number;
  lineColor: string;
  labelColor: string;
  opacity: number;
}) {
  // Calculate angle from OD to fovea (temporal axis)
  const dx = fovea.x - opticDisc.x;
  const dy = fovea.y - opticDisc.y;
  const angle = Math.atan2(dy, dx);

  // Perpendicular angle (nasal-temporal divider)
  const perpAngle = angle;

  // Superior-inferior divider (perpendicular to temporal axis)
  const superiorInferiorAngle = angle + Math.PI / 2;

  // Calculate line endpoints extending from OD center
  const lineLength = Math.max(imageWidth, imageHeight) * 1.5;

  // Temporal-Nasal divider (through OD, parallel to OD-Fovea vector)
  const tnX1 = opticDisc.x - Math.cos(perpAngle) * lineLength;
  const tnY1 = opticDisc.y - Math.sin(perpAngle) * lineLength;
  const tnX2 = opticDisc.x + Math.cos(perpAngle) * lineLength;
  const tnY2 = opticDisc.y + Math.sin(perpAngle) * lineLength;

  // Superior-Inferior divider (perpendicular to OD-Fovea)
  const siX1 = opticDisc.x - Math.cos(superiorInferiorAngle) * lineLength;
  const siY1 = opticDisc.y - Math.sin(superiorInferiorAngle) * lineLength;
  const siX2 = opticDisc.x + Math.cos(superiorInferiorAngle) * lineLength;
  const siY2 = opticDisc.y + Math.sin(superiorInferiorAngle) * lineLength;

  // Calculate label positions (at edges of image)
  const labelDistance = Math.min(imageWidth, imageHeight) * 0.4;

  // ST label position (in the direction of fovea, up)
  const stAngle = angle - Math.PI / 4;
  const stX = opticDisc.x + Math.cos(stAngle) * labelDistance;
  const stY = opticDisc.y + Math.sin(stAngle) * labelDistance;

  // IT label position
  const itAngle = angle + Math.PI / 4;
  const itX = opticDisc.x + Math.cos(itAngle) * labelDistance;
  const itY = opticDisc.y + Math.sin(itAngle) * labelDistance;

  // SN label position
  const snAngle = angle + Math.PI * 3 / 4;
  const snX = opticDisc.x + Math.cos(snAngle) * labelDistance;
  const snY = opticDisc.y + Math.sin(snAngle) * labelDistance;

  // IN label position
  const inAngle = angle - Math.PI * 3 / 4;
  const inX = opticDisc.x + Math.cos(inAngle) * labelDistance;
  const inY = opticDisc.y + Math.sin(inAngle) * labelDistance;

  // Helper to keep labels inside image boundaries with a small margin
  const margin = 20;
  const clampX = (x: number) => Math.max(margin, Math.min(x, imageWidth - margin - 30));
  const clampY = (y: number) => Math.max(margin, Math.min(y, imageHeight - margin - 20));

  return (
    <Group opacity={opacity}>
      {/* Temporal-Nasal divider */}
      <Line
        points={[tnX1, tnY1, tnX2, tnY2]}
        stroke={lineColor}
        strokeWidth={2}
        dash={[10, 10]}
        listening={false}
      />

      {/* Superior-Inferior divider */}
      <Line
        points={[siX1, siY1, siX2, siY2]}
        stroke={lineColor}
        strokeWidth={2}
        dash={[10, 10]}
        listening={false}
      />

      {/* Quadrant labels */}
      <Text
        x={clampX(stX - 15)}
        y={clampY(stY - 10)}
        text="ST"
        fontSize={16}
        fontStyle="bold"
        fill={labelColor}
        listening={false}
      />

      <Text
        x={clampX(itX - 15)}
        y={clampY(itY - 10)}
        text="IT"
        fontSize={16}
        fontStyle="bold"
        fill={labelColor}
        listening={false}
      />

      <Text
        x={clampX(snX - 15)}
        y={clampY(snY - 10)}
        text="SN"
        fontSize={16}
        fontStyle="bold"
        fill={labelColor}
        listening={false}
      />

      <Text
        x={clampX(inX - 15)}
        y={clampY(inY - 10)}
        text="IN"
        fontSize={16}
        fontStyle="bold"
        fill={labelColor}
        listening={false}
      />
    </Group>
  );
}

/**
 * Fallback quadrants using simple center-based division
 */
function FallbackQuadrants({
  imageWidth,
  imageHeight,
  lineColor,
  labelColor,
  opacity,
}: {
  imageWidth: number;
  imageHeight: number;
  lineColor: string;
  labelColor: string;
  opacity: number;
}) {
  const centerX = imageWidth / 2;
  const centerY = imageHeight / 2;

  return (
    <Group opacity={opacity}>
      {/* Vertical line */}
      <Line
        points={[centerX, 0, centerX, imageHeight]}
        stroke={lineColor}
        strokeWidth={2}
        dash={[10, 10]}
        listening={false}
      />

      {/* Horizontal line */}
      <Line
        points={[0, centerY, imageWidth, centerY]}
        stroke={lineColor}
        strokeWidth={2}
        dash={[10, 10]}
        listening={false}
      />

      {/* Quadrant labels (using fallback mode labels) */}
      <Text
        x={centerX + imageWidth / 4 - 15}
        y={centerY - imageHeight / 4 - 10}
        text="ST"
        fontSize={16}
        fontStyle="bold"
        fill={labelColor}
        listening={false}
        opacity={0.5}
      />

      <Text
        x={centerX + imageWidth / 4 - 15}
        y={centerY + imageHeight / 4 - 10}
        text="IT"
        fontSize={16}
        fontStyle="bold"
        fill={labelColor}
        listening={false}
        opacity={0.5}
      />

      <Text
        x={centerX - imageWidth / 4 - 15}
        y={centerY - imageHeight / 4 - 10}
        text="SN"
        fontSize={16}
        fontStyle="bold"
        fill={labelColor}
        listening={false}
        opacity={0.5}
      />

      <Text
        x={centerX - imageWidth / 4 - 15}
        y={centerY + imageHeight / 4 - 10}
        text="IN"
        fontSize={16}
        fontStyle="bold"
        fill={labelColor}
        listening={false}
        opacity={0.5}
      />

      {/* Warning text */}
      <Text
        x={10}
        y={imageHeight - 30}
        text="⚠ Fallback mode: Place landmarks for anatomical reference"
        fontSize={12}
        fill="rgba(255, 150, 0, 0.8)"
        listening={false}
      />
    </Group>
  );
}
