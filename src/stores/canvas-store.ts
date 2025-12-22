import { create } from 'zustand';
import { ToolType, CanvasLayer, LayerType } from '@/types/annotations';

const DEFAULT_LAYERS: CanvasLayer[] = [
  { id: 'original', name: 'Original Image', visible: true, opacity: 1, locked: true, zIndex: 0 },
  { id: 'segmentations-ai', name: 'AI Segmentations', visible: true, opacity: 0.6, locked: false, zIndex: 1 },
  { id: 'detections-ai', name: 'AI Detections', visible: true, opacity: 1, locked: false, zIndex: 2 },
  { id: 'manual-annotations', name: 'Manual Annotations', visible: true, opacity: 1, locked: false, zIndex: 3 }
];

interface CanvasStore {
  activeTool: ToolType;
  layers: CanvasLayer[];
  selectedAnnotationId: string | null;

  setActiveTool: (tool: ToolType) => void;
  toggleLayerVisibility: (layerId: LayerType) => void;
  setLayerOpacity: (layerId: LayerType, opacity: number) => void;
  setSelectedAnnotation: (id: string | null) => void;
  resetLayers: () => void;
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  activeTool: 'select',
  layers: DEFAULT_LAYERS,
  selectedAnnotationId: null,

  setActiveTool: (tool) => set({ activeTool: tool }),

  toggleLayerVisibility: (layerId) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    })),

  setLayerOpacity: (layerId, opacity) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === layerId ? { ...layer, opacity } : layer
      )
    })),

  setSelectedAnnotation: (id) => set({ selectedAnnotationId: id }),

  resetLayers: () => set({ layers: DEFAULT_LAYERS })
}));
