import React from 'react';
import { Layer, Group } from 'react-konva';
import { QuadrantOverlay } from '../QuadrantOverlay';
import { MacularZonesOverlay } from '../MacularZonesOverlay';

interface AnalysisCanvasLayerProps {
  imageOffset: { x: number; y: number };
  scale: number;
  quadrantsVisible: boolean;
  quadrantsOpacity: number;
  landmarks: any[];
  konvaImageWidth: number;
  konvaImageHeight: number;
  macularZonesVisible: boolean;
  macularZonesOpacity: number;
  macularEdemaData: any;
  circinateRingsVisible: boolean;
}

export const AnalysisCanvasLayer: React.FC<AnalysisCanvasLayerProps> = ({
  imageOffset,
  scale,
  quadrantsVisible,
  quadrantsOpacity,
  landmarks,
  konvaImageWidth,
  konvaImageHeight,
  macularZonesVisible,
  macularZonesOpacity,
  macularEdemaData,
  circinateRingsVisible,
}) => {
  return (
    <Layer>
      <Group
        x={imageOffset.x}
        y={imageOffset.y}
        scaleX={scale}
        scaleY={scale}
      >
        {/* Quadrant overlay */}
        <QuadrantOverlay
          visible={quadrantsVisible}
          opacity={quadrantsOpacity}
          landmarks={landmarks}
          imageWidth={konvaImageWidth}
          imageHeight={konvaImageHeight}
        />

        {/* Macular zones overlay */}
        {macularEdemaData && (
          <MacularZonesOverlay
            visible={macularZonesVisible}
            opacity={macularZonesOpacity}
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
            showCircinateRings={circinateRingsVisible}
          />
        )}
      </Group>
    </Layer>
  );
};
