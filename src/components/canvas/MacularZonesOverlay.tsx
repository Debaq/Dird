/**
 * MacularZonesOverlay
 *
 * Visualizes macular edema detection zones on the canvas
 * - Shows foveal zone circle (e.g., 500μm radius)
 * - Highlights hard exudates within zone
 * - Shows circinate pattern if detected
 * - Displays clinical information
 */

import { useTranslation } from 'react-i18next';
import { Circle, Line, Text, Group, Ring } from 'react-konva';
import type { Detection } from '@/lib/db/schema';
import type { SpatialCalibration } from '@/lib/analysis/spatial-calibrator';
import { micronsToPixels } from '@/lib/analysis/spatial-calibrator';

interface MacularZonesOverlayProps {
  visible: boolean;
  opacity: number;
  fovea: Detection | null;
  macularEdemaResult: {
    detected: boolean;
    method: string;
    exudatesInZone: Detection[];
    circinatePattern: boolean;
    description: string;
    calibration: SpatialCalibration;
  } | null;
  zoneRadiusUm: number; // Radius in micrometers (e.g., 500)
  showDiscDiameterZone?: boolean; // Show 1 DD zone (ETDRS)
  showLegend?: boolean; // Show legend text panel
}

/**
 * MacularZonesOverlay Component
 */
export function MacularZonesOverlay({
  visible,
  opacity,
  fovea,
  macularEdemaResult,
  zoneRadiusUm,
  showDiscDiameterZone = false,
  showLegend = true,
}: MacularZonesOverlayProps) {
  const { t } = useTranslation();

  if (!visible || !fovea || !macularEdemaResult) {
    return null;
  }

  const { calibration, exudatesInZone, circinatePattern, detected, method, description } = macularEdemaResult;

  // Calculate fovea center
  const foveaCenter = {
    x: fovea.bbox.x + fovea.bbox.width / 2,
    y: fovea.bbox.y + fovea.bbox.height / 2,
  };

  // Convert zone radius from micrometers to pixels
  const zoneRadiusPixels = micronsToPixels(zoneRadiusUm, calibration);

  // Calculate disc diameter zone radius (1 DD = ~1500 μm)
  const discDiameterRadiusPixels = showDiscDiameterZone
    ? micronsToPixels(calibration.opticDiscDiameterMicrons, calibration)
    : 0;

  // Colors
  const zoneColor = detected ? 'rgba(255, 165, 0, 0.7)' : 'rgba(100, 200, 100, 0.5)'; // Orange if detected, green if not
  const highlightColor = 'rgba(255, 50, 50, 0.9)'; // Red for highlighted exudates
  const circinateLineColor = 'rgba(255, 100, 0, 0.6)'; // Orange for circinate pattern lines
  const labelColor = detected ? 'rgba(255, 165, 0, 1)' : 'rgba(100, 200, 100, 1)';

  return (
    <Group listening={false} opacity={opacity}>
      {/* 1 DD zone (background, if enabled) */}
      {showDiscDiameterZone && (
        <Circle
          x={foveaCenter.x}
          y={foveaCenter.y}
          radius={discDiameterRadiusPixels}
          stroke="rgba(150, 150, 200, 0.4)"
          strokeWidth={1}
          dash={[5, 5]}
          listening={false}
        />
      )}

      {/* Main foveal zone circle */}
      <Circle
        x={foveaCenter.x}
        y={foveaCenter.y}
        radius={zoneRadiusPixels}
        stroke={zoneColor}
        strokeWidth={2}
        dash={[8, 4]}
        listening={false}
      />

      {/* Highlight exudates within zone */}
      {exudatesInZone.map((exudate, index) => {
        const exudateCenter = {
          x: exudate.bbox.x + exudate.bbox.width / 2,
          y: exudate.bbox.y + exudate.bbox.height / 2,
        };

        return (
          <Group key={`exudate-highlight-${index}`}>
            {/* Ring around exudate */}
            <Ring
              x={exudateCenter.x}
              y={exudateCenter.y}
              innerRadius={Math.max(exudate.bbox.width, exudate.bbox.height) / 2}
              outerRadius={Math.max(exudate.bbox.width, exudate.bbox.height) / 2 + 4}
              fill={highlightColor}
              listening={false}
            />

            {/* Line from fovea to exudate (if circinate pattern) */}
            {circinatePattern && (
              <Line
                points={[foveaCenter.x, foveaCenter.y, exudateCenter.x, exudateCenter.y]}
                stroke={circinateLineColor}
                strokeWidth={1}
                opacity={0.4}
                listening={false}
              />
            )}
          </Group>
        );
      })}

      {/* Fovea center marker */}
      <Circle
        x={foveaCenter.x}
        y={foveaCenter.y}
        radius={3}
        fill={labelColor}
        listening={false}
      />

      {/* Legend / Info Panel */}
      {showLegend && (
        <MacularEdemaLegend
          method={method}
          detected={detected}
          description={description}
          exudatesCount={exudatesInZone.length}
          circinatePattern={circinatePattern}
          zoneRadiusUm={zoneRadiusUm}
          labelColor={labelColor}
          x={10} // Fixed position relative to layer/group
          y={10}
          t={t}
        />
      )}
    </Group>
  );
}

/**
 * Legend component showing macular edema detection information
 */
function MacularEdemaLegend({
  method,
  detected,
  description,
  exudatesCount,
  circinatePattern,
  zoneRadiusUm,
  labelColor,
  x,
  y,
  t,
}: {
  method: string;
  detected: boolean;
  description: string;
  exudatesCount: number;
  circinatePattern: boolean;
  zoneRadiusUm: number;
  labelColor: string;
  x: number;
  y: number;
  t: any;
}) {
  const bgColor = detected ? 'rgba(255, 165, 0, 0.15)' : 'rgba(100, 200, 100, 0.1)';
  const borderColor = detected ? 'rgba(255, 165, 0, 0.6)' : 'rgba(100, 200, 100, 0.5)';
  const textColor = detected ? 'rgba(255, 165, 0, 1)' : 'rgba(100, 200, 100, 1)';

  const panelWidth = 480;
  const lineHeight = 18;
  const padding = 10;

  // Build legend lines
  const lines = [
    t('canvas.overlays.macular.detectionTitle', { method }),
    t('canvas.overlays.macular.zoneInfo', { radius: zoneRadiusUm }),
    t('canvas.overlays.macular.statusLabel', { 
      status: detected ? t('canvas.overlays.macular.statusDetected') : t('canvas.overlays.macular.statusNotDetected') 
    }),
    t('canvas.overlays.macular.exudatesCount', { count: exudatesCount }),
  ];

  if (circinatePattern) {
    lines.push(t('canvas.overlays.macular.circinatePattern'));
  }

  if (description) {
    let translatedDescription = description;
    
    if (description === 'noneFound') {
      translatedDescription = t('canvas.overlays.macular.noneFound');
    } else if (description === 'noneInZone') {
      translatedDescription = t('canvas.overlays.macular.noneInZone');
    } else if (description.startsWith('onlyFewInZone|')) {
      const params = description.split('|')[1].split(',').reduce((acc: any, curr) => {
        const [k, v] = curr.split(':');
        acc[k] = v;
        return acc;
      }, {});
      translatedDescription = t('canvas.overlays.macular.onlyFewInZone', params);
    } else if (description.startsWith('detectedInZone|')) {
      const params = description.split('|')[1].split(',').reduce((acc: any, curr) => {
        const [k, v] = curr.split(':');
        acc[k] = v;
        return acc;
      }, {});
      
      const key = params.pattern === 'true' 
        ? 'canvas.overlays.macular.detectedInZoneWithPattern' 
        : 'canvas.overlays.macular.detectedInZone';
        
      translatedDescription = t(key, params);
    }

    lines.push(t('canvas.overlays.macular.details', { description: translatedDescription }));
  }

  // Estimate height with some buffer for wrapping
  const panelHeight = lines.length * lineHeight + padding * 2 + 20;

  return (
    <Group x={x} y={y}>
      {/* Background panel */}
      <Group>
        {/* Background */}
        <Line
          points={[
            0, 0,
            panelWidth, 0,
            panelWidth, panelHeight,
            0, panelHeight,
            0, 0
          ]}
          fill={bgColor}
          stroke={borderColor}
          strokeWidth={1}
          closed={true}
          listening={false}
        />

        {/* Text lines */}
        {lines.map((line, index) => (
          <Text
            key={`legend-line-${index}`}
            x={padding}
            y={padding + index * lineHeight}
            text={line}
            fontSize={12}
            fontStyle={index === 0 ? 'bold' : 'normal'}
            fill={index === 2 && detected ? labelColor : textColor}
            width={panelWidth - padding * 2}
            wrap="word"
            listening={false}
          />
        ))}
      </Group>
    </Group>
  );
}

/**
 * Export types for use in parent components
 */
export type { MacularZonesOverlayProps };
