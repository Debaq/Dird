export type LayerType = 'original' | 'detections-ai' | 'segmentations-ai' | 'manual-annotations';

export interface CanvasLayer {
  id: LayerType;
  name: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
  zIndex: number;
}

export type ToolType = 'select' | 'bbox' | 'segment' | 'eraser' | 'pan' | 'zoom';

export interface BoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  class: string;
  confidence?: number;
  type: 'ai' | 'manual';
  visible: boolean;
  selected?: boolean;
}

export interface SegmentationMask {
  id: string;
  maskData: string;
  class: string;
  confidence?: number;
  type: 'ai' | 'manual';
  opacity: number;
  visible: boolean;
  selected?: boolean;
}

export interface AnnotationState {
  detections: BoundingBox[];
  segmentations: SegmentationMask[];
  activeTool: ToolType;
  selectedAnnotationId?: string;
}
