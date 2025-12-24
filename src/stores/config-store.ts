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
    sensitivity: number; // 0-1
  };
  segmentation: {
    enabled: boolean;
    modelPath: string;
    sensitivity: number; // 0-1
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

export interface ReportConfig {
  title: string;
  subtitle: string;
  useSystemLogo: boolean;
  customLogo: string | null;
  colors: {
    primary: string;
    secondary: string;
    text: string;
  };
  sections: {
    patientInfo: boolean;
    summary: boolean;
    gallery: boolean;
    evaluatorNotes: boolean;
  };
  gallery: {
    includeOriginal: boolean;
    includeAnnotated: boolean;
  };
  patientInfoFields: {
    name: boolean;
    id: boolean;
    age: boolean;
    diabetes: boolean;
    hta: boolean;
    dlp: boolean;
    medications: boolean;
    otherConditions: boolean;
    sessionDate: boolean;
    sessionNotes: boolean;
  };
  signature: {
    text: string;
  };
}

export interface AppConfig {
  name: string;
  appearance: AppearanceConfig;
  modelSource: ModelSource;
  localModels: LocalModelConfig;
  apiModels: APIModelConfig;
  processing: ProcessingConfig;
  report: ReportConfig;
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
  updateReportConfig: (updates: Partial<ReportConfig>) => void;
  updateAPIModels: (updates: Partial<APIModelConfig>) => void;
  updateLocalModels: (updates: Partial<LocalModelConfig>) => void;
  setModelSource: (source: ModelSource) => void;
  resetConfig: () => void;
}

export const DEFAULT_CONFIG: AppConfig = {
  name: 'DIRD',
  appearance: {
    primaryColor: '#20B5AE',
    logo: 'logo-default.svg',
    theme: 'light',
    language: 'es'
  },
  modelSource: 'local',
  localModels: {
    detection: {
      enabled: true,
      modelPath: '/models/detection-v1.0.0.onnx',
      sensitivity: 0.5
    },
    segmentation: {
      enabled: false,
      modelPath: '/models/segmentation-v1.0.0.onnx',
      sensitivity: 0.5
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
  report: {
    title: 'DIRD',
    subtitle: 'Detección de Retinopatía Diabética',
    useSystemLogo: true,
    customLogo: null,
    colors: {
      primary: '#20B5AE',
      secondary: '#D87A1A',
      text: '#282828'
    },
    sections: {
      patientInfo: true,
      summary: true,
      gallery: true,
      evaluatorNotes: true
    },
    gallery: {
      includeOriginal: false,
      includeAnnotated: true
    },
    patientInfoFields: {
      name: true,
      id: true,
      age: true,
      diabetes: true,
      hta: true,
      dlp: true,
      medications: true,
      otherConditions: true,
      sessionDate: true,
      sessionNotes: true
    },
    signature: {
      text: 'Firma del Especialista'
    }
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

      updateReportConfig: (updates) =>
        set((state) => ({
          config: {
            ...state.config,
            report: { ...state.config.report, ...updates }
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
      name: 'dird-config',
      version: 2,
      migrate: (persistedState: any, version) => {
        if (version === 0) {
          return {
            ...persistedState,
            report: DEFAULT_CONFIG.report,
          };
        }
        if (version === 1) {
          return {
            ...persistedState,
            report: {
              ...persistedState.report,
              patientInfoFields: DEFAULT_CONFIG.report.patientInfoFields
            }
          };
        }
        return persistedState;
      },
    }
  )
);
