import { create } from 'zustand';

export type FilterType =
  | 'brightness' | 'contrast' | 'saturation'
  | 'green_channel' | 'red_channel' | 'blue_channel'
  | 'grayscale' | 'clahe' | 'threshold' | 'edge_detection'
  | 'sharpening' | 'blur' | 'morphology'
  | 'histogram_equalization' | 'invert' | 'frangi' | 'tophat' | 'color_mapping';

export interface FilterConfig {
  // Básicos
  value?: number;           // brightness, contrast, saturation, sharpening

  // CLAHE
  clipLimit?: number;
  tileGridSize?: number;

  // Threshold
  type?: 'binary' | 'binary_inv' | 'trunc' | 'tozero' | 'tozero_inv' | 'otsu';
  threshold?: number;

  // Edge Detection
  method?: 'canny' | 'sobel' | 'laplacian';
  threshold1?: number;
  threshold2?: number;

  // Blur
  blurType?: 'gaussian' | 'median' | 'bilateral';
  kernelSize?: number;

  // Morphology
  morphType?: 'dilate' | 'erode';
  iterations?: number;

  // Color Mapping
  colorSpace?: 'hsv' | 'lab' | 'ycrcb';

  // Frangi
  sigmaRange?: [number, number];
  betaOne?: number;
  betaTwo?: number;
}

export interface ImageFilter {
  id: string;                 // UUID único
  type: FilterType;
  config: FilterConfig;
  enabled: boolean;           // Toggle on/off sin eliminar
  order: number;              // Posición en pipeline
}

interface ImageProcessingStore {
  filters: ImageFilter[];
  showOriginal: boolean;
  comparisonOpacity: number;

  // Actions
  addFilter: (type: FilterType) => void;
  updateFilter: (id: string, config: FilterConfig) => void;
  toggleFilter: (id: string) => void;
  deleteFilter: (id: string) => void;
  reorderFilters: (newOrder: ImageFilter[]) => void;
  resetFilters: () => void;
  setShowOriginal: (show: boolean) => void;
  setComparisonOpacity: (opacity: number) => void;
}

const DEFAULT_CONFIGS: Record<FilterType, FilterConfig> = {
  brightness: { value: 0 },
  contrast: { value: 1.0 },
  saturation: { value: 1.0 },
  green_channel: {},
  red_channel: {},
  blue_channel: {},
  grayscale: {},
  clahe: { clipLimit: 2.0, tileGridSize: 8 },
  threshold: { type: 'binary', threshold: 127 },
  edge_detection: { method: 'canny', threshold1: 50, threshold2: 150 },
  sharpening: { value: 1.0 },
  blur: { blurType: 'gaussian', kernelSize: 5 },
  morphology: { morphType: 'dilate', kernelSize: 3, iterations: 1 },
  histogram_equalization: {},
  invert: {},
  frangi: { sigmaRange: [1, 3], betaOne: 0.5, betaTwo: 15 },
  tophat: { kernelSize: 9 },
  color_mapping: { colorSpace: 'hsv' }
};

export const useImageProcessingStore = create<ImageProcessingStore>((set, get) => ({
  filters: [],
  showOriginal: false,
  comparisonOpacity: 0.5,

  addFilter: (type) => {
    const { filters } = get();
    if (filters.length >= 10) {
      console.warn('Maximum 10 filters reached');
      return;
    }

    const newFilter: ImageFilter = {
      id: crypto.randomUUID(),
      type,
      config: { ...DEFAULT_CONFIGS[type] },
      enabled: true,
      order: filters.length
    };

    set({ filters: [...filters, newFilter] });
  },

  updateFilter: (id, config) => {
    set((state) => ({
      filters: state.filters.map((f) =>
        f.id === id ? { ...f, config: { ...f.config, ...config } } : f
      )
    }));
  },

  toggleFilter: (id) => {
    set((state) => ({
      filters: state.filters.map((f) =>
        f.id === id ? { ...f, enabled: !f.enabled } : f
      )
    }));
  },

  deleteFilter: (id) => {
    set((state) => ({
      filters: state.filters
        .filter((f) => f.id !== id)
        .map((f, index) => ({ ...f, order: index })) // Re-index
    }));
  },

  reorderFilters: (newOrder) => {
    set({
      filters: newOrder.map((f, index) => ({ ...f, order: index }))
    });
  },

  resetFilters: () => {
    set({ filters: [], showOriginal: false, comparisonOpacity: 0.5 });
  },

  setShowOriginal: (show) => set({ showOriginal: show }),

  setComparisonOpacity: (opacity) => set({ comparisonOpacity: opacity })
}));
