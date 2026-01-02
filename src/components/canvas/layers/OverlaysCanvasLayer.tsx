import React from 'react';
import { MeasurementsCanvasLayer } from './MeasurementsCanvasLayer';
import { AnalysisCanvasLayer } from './AnalysisCanvasLayer';
import type { CanvasTool } from '../ToolPanel';

interface Point {
  x: number;
  y: number;
}

interface OverlaysCanvasLayerProps {
  // Measurements
  measurementsVisible: boolean;
  measurementsOpacity: number;
  measurements: any[];
  detections: any[];
  activeTool: CanvasTool;
  rulerOrigin: Point | null;
  rulerDestination: Point | null;
  selectedMeasurementId: number | null;
  tempMeasurementUpdates: Map<number, { originX: number; originY: number; destinationX: number; destinationY: number }>;
  onSelectMeasurement: (id: number) => void;
  onDeleteMeasurement: (id: number) => void;
  onMeasurementDragMove: (
    id: number,
    part: 'origin' | 'destination' | 'line',
    newPos: { x: number; y: number },
    dragDelta?: { x: number; y: number }
  ) => void;
  onMeasurementDragEnd: (
    id: number,
    part: 'origin' | 'destination' | 'line',
    newPos: { x: number; y: number },
    dragDelta?: { x: number; y: number }
  ) => void;

  // Analysis (quadrants + macular zones)
  quadrantsVisible: boolean;
  quadrantsOpacity: number;
  macularZonesVisible: boolean;
  macularZonesOpacity: number;
  circinateRingsVisible: boolean;
  landmarks: any[];
  konvaImageWidth: number;
  konvaImageHeight: number;
  macularEdemaData: any;

  // Common
  scale: number;
  imageOffset: Point;
  stageScale: number;
}

/**
 * Consolidated Overlays Layer
 * Combines measurements and analysis overlays (quadrants, macular zones) into a single Konva Layer
 * This helps keep the total number of layers within Konva's recommended 3-5 range
 */
export const OverlaysCanvasLayer: React.FC<OverlaysCanvasLayerProps> = (props) => {
  const {
    measurementsVisible,
    measurementsOpacity,
    measurements,
    detections,
    activeTool,
    rulerOrigin,
    rulerDestination,
    selectedMeasurementId,
    tempMeasurementUpdates,
    onSelectMeasurement,
    onDeleteMeasurement,
    onMeasurementDragMove,
    onMeasurementDragEnd,
    quadrantsVisible,
    quadrantsOpacity,
    macularZonesVisible,
    macularZonesOpacity,
    circinateRingsVisible,
    landmarks,
    konvaImageWidth,
    konvaImageHeight,
    macularEdemaData,
    scale,
    imageOffset,
    stageScale,
  } = props;

  // Note: We render these as separate Layer components but within a single React component
  // This is because Konva's Layer is a rendering optimization boundary
  // We still benefit from having fewer layers overall

  return (
    <>
      {/* Measurements (ruler tool) */}
      <MeasurementsCanvasLayer
        visible={measurementsVisible}
        opacity={measurementsOpacity}
        measurements={measurements}
        detections={detections}
        activeTool={activeTool}
        rulerOrigin={rulerOrigin}
        rulerDestination={rulerDestination}
        scale={scale}
        imageOffset={imageOffset}
        stageScale={stageScale}
        selectedMeasurementId={selectedMeasurementId}
        tempMeasurementUpdates={tempMeasurementUpdates}
        onSelect={onSelectMeasurement}
        onDelete={onDeleteMeasurement}
        onDragMove={onMeasurementDragMove}
        onDragEnd={onMeasurementDragEnd}
      />

      {/* Analysis overlays (quadrants + macular zones) */}
      <AnalysisCanvasLayer
        imageOffset={imageOffset}
        scale={scale}
        quadrantsVisible={quadrantsVisible}
        quadrantsOpacity={quadrantsOpacity}
        landmarks={landmarks}
        konvaImageWidth={konvaImageWidth}
        konvaImageHeight={konvaImageHeight}
        macularZonesVisible={macularZonesVisible}
        macularZonesOpacity={macularZonesOpacity}
        macularEdemaData={macularEdemaData}
        circinateRingsVisible={circinateRingsVisible}
      />
    </>
  );
};
