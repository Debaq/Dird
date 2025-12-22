import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ModelSource = 'local' | 'api';

export interface APIModelConfig {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  headers?: Record<string, string>;
  timeout?: number;
  modelName?: string;
}

export interface LocalModelConfig {
  detection: {
    enabled: boolean;
    modelPath: string;
  };
  segmentation: {
    enabled: boolean;
    modelPath: string;
  };
}

export interface AppearanceConfig {
  primaryColor: string;
  logo: string;
  theme: 'light' | 'dark' | 'auto';
  language: string;
}

export interface ProcessingConfig {
  autoProcess: boolean;
  maxImageSize: number; // MB
  compressionQuality: number; // 0-1
  batchSize: number;
}

export interface AppConfig {
  name: string;
  appearance: AppearanceConfig;
  modelSource: ModelSource;
  localModels: LocalModelConfig;
  apiModels: APIModelConfig;
  processing: ProcessingConfig;
  pwa: {
    installPromptShown: boolean;
    updateAvailable: boolean;
  };
}

interface ConfigStore {
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => void;
  updateAppearance: (updates: Partial<AppearanceConfig>) => void;
  updateProcessing: (updates: Partial<ProcessingConfig>) => void;
  updateAPIModels: (updates: Partial<APIModelConfig>) => void;
  updateLocalModels: (updates: Partial<LocalModelConfig>) => void;
  setModelSource: (source: ModelSource) => void;
  resetConfig: () => void;
}

const DEFAULT_CONFIG: AppConfig = {
  name: 'DIRD',
  appearance: {
    primaryColor: '#20B5AE',
    logo: '/logo-default.svg',
    theme: 'light',
    language: 'es'
  },
  modelSource: 'local',
  localModels: {
    detection: {
      enabled: true,
      modelPath: '/models/detection-v1.0.0.onnx'
    },
    segmentation: {
      enabled: false,
      modelPath: '/models/segmentation-v1.0.0.onnx'
    }
  },
  apiModels: {
    enabled: false,
    endpoint: '',
    apiKey: '',
    headers: {},
    timeout: 30000,
    modelName: ''
  },
  processing: {
    autoProcess: true,
    maxImageSize: 10,
    compressionQuality: 0.8,
    batchSize: 5
  },
  pwa: {
    installPromptShown: false,
    updateAvailable: false
  }
};

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,

      updateConfig: (updates) =>
        set((state) => ({
          config: { ...state.config, ...updates }
        })),

      updateAppearance: (updates) =>
        set((state) => ({
          config: {
            ...state.config,
            appearance: { ...state.config.appearance, ...updates }
          }
        })),

      updateProcessing: (updates) =>
        set((state) => ({
          config: {
            ...state.config,
            processing: { ...state.config.processing, ...updates }
          }
        })),

      updateAPIModels: (updates) =>
        set((state) => ({
          config: {
            ...state.config,
            apiModels: { ...state.config.apiModels, ...updates }
          }
        })),

      updateLocalModels: (updates) =>
        set((state) => ({
          config: {
            ...state.config,
            localModels: { ...state.config.localModels, ...updates }
          }
        })),

      setModelSource: (source) =>
        set((state) => ({
          config: { ...state.config, modelSource: source }
        })),

      resetConfig: () => set({ config: DEFAULT_CONFIG })
    }),
    {
      name: 'dird-config'
    }
  )
);
