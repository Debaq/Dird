import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface InferenceMetricEntry {
  timestamp: number;
  modelVersion: string;
  imageWidth: number;
  imageHeight: number;
  numDetections: number;
  preprocess_ms: number;
  inference_ms: number;
  postprocess_ms: number;
  nms_ms: number | null;
  spatial_ms: number;
  clinical_ms: number;
  total_ms: number;
}

interface StatSummary {
  mean: number;
  median: number;
  min: number;
  max: number;
  std: number;
}

export interface PhaseStats extends StatSummary {
  pct_of_total: number;
}

export interface InferenceMetricsStats {
  count: number;
  total_ms: StatSummary;
  preprocess_ms: PhaseStats;
  inference_ms: PhaseStats;
  postprocess_ms: PhaseStats;
  nms_ms: PhaseStats;
  spatial_ms: PhaseStats;
  clinical_ms: PhaseStats;
}

const MAX_HISTORY = 100;

function stats(values: number[]): StatSummary {
  if (values.length === 0) return { mean: 0, median: 0, min: 0, max: 0, std: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[(sorted.length - 1) / 2];
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return {
    mean,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    std: Math.sqrt(variance),
  };
}

function phaseStats(values: number[], totalMean: number): PhaseStats {
  const s = stats(values);
  return { ...s, pct_of_total: totalMean > 0 ? (s.mean / totalMean) * 100 : 0 };
}

export interface SessionMetricEntry {
  timestamp: number;
  sessionId: string | number | null;
  imagesProcessed: number;
  modelLoad_ms: number;
  session_total_ms: number;
  avg_per_image_ms: number;
}

export interface UsageMetrics {
  totalStudies: number;
  totalImages: number;
  totalInferenceTime_ms: number;
  totalSessionTime_ms: number;
  firstUseTs: number | null;
  lastUseTs: number | null;
}

interface InferenceMetricsStore {
  history: InferenceMetricEntry[];
  sessionHistory: SessionMetricEntry[];
  usage: UsageMetrics;
  addEntry: (entry: InferenceMetricEntry) => void;
  addSession: (entry: SessionMetricEntry) => void;
  clear: () => void;
  clearAll: () => void;
  getStats: () => InferenceMetricsStats;
}

const INITIAL_USAGE: UsageMetrics = {
  totalStudies: 0,
  totalImages: 0,
  totalInferenceTime_ms: 0,
  totalSessionTime_ms: 0,
  firstUseTs: null,
  lastUseTs: null,
};

export const useInferenceMetricsStore = create<InferenceMetricsStore>()(
  persist(
    (set, get) => ({
      history: [],
      sessionHistory: [],
      usage: INITIAL_USAGE,
      addEntry: (entry) =>
        set((state) => ({
          history: [entry, ...state.history].slice(0, MAX_HISTORY),
          usage: {
            ...state.usage,
            totalImages: state.usage.totalImages + 1,
            totalInferenceTime_ms: state.usage.totalInferenceTime_ms + entry.total_ms,
            firstUseTs: state.usage.firstUseTs ?? entry.timestamp,
            lastUseTs: entry.timestamp,
          },
        })),
      addSession: (entry) =>
        set((state) => ({
          sessionHistory: [entry, ...state.sessionHistory].slice(0, MAX_HISTORY),
          usage: {
            ...state.usage,
            totalStudies: state.usage.totalStudies + 1,
            totalSessionTime_ms: state.usage.totalSessionTime_ms + entry.session_total_ms,
            firstUseTs: state.usage.firstUseTs ?? entry.timestamp,
            lastUseTs: entry.timestamp,
          },
        })),
      clear: () => set({ history: [], sessionHistory: [] }),
      clearAll: () => set({ history: [], sessionHistory: [], usage: INITIAL_USAGE }),
      getStats: () => {
        const h = get().history;
        const totalMean = h.length
          ? h.reduce((s, e) => s + e.total_ms, 0) / h.length
          : 0;
        return {
          count: h.length,
          total_ms: stats(h.map((e) => e.total_ms)),
          preprocess_ms: phaseStats(h.map((e) => e.preprocess_ms), totalMean),
          inference_ms: phaseStats(h.map((e) => e.inference_ms), totalMean),
          postprocess_ms: phaseStats(h.map((e) => e.postprocess_ms), totalMean),
          nms_ms: phaseStats(h.map((e) => e.nms_ms ?? 0), totalMean),
          spatial_ms: phaseStats(h.map((e) => e.spatial_ms ?? 0), totalMean),
          clinical_ms: phaseStats(h.map((e) => e.clinical_ms ?? 0), totalMean),
        };
      },
    }),
    {
      name: 'dird-inference-metrics',
      partialize: (state) => ({
        history: state.history,
        sessionHistory: state.sessionHistory,
        usage: state.usage,
      }),
    }
  )
);
