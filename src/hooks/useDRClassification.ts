/**
 * Hook for DR Classification
 * Provides easy access to DR classification functionality in React components
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DRClassification } from '../lib/analysis/dr-classifier';
import {
  classifySessionDR,
  classifyPatientDR,
  compareSessionClassifications
} from '../lib/analysis/dr-classification-service';

interface UseDRClassificationReturn {
  classification: DRClassification | null;
  isLoading: boolean;
  error: string | null;
  classifySession: (sessionId: number) => Promise<void>;
  classifyPatient: (patientId: number) => Promise<void>;
  compareSessions: (sessionIds: number[]) => Promise<void>;
  reset: () => void;
}

export function useDRClassification(): UseDRClassificationReturn {
  const [classification, setClassification] = useState<DRClassification | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const classifySession = useCallback(async (sessionId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await classifySessionDR(sessionId);
      if (result) {
        setClassification(result);
      } else {
        setError(t('errors.drClassification.noClassification'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknown'));
      console.error('Error en clasificación:', err);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const classifyPatient = useCallback(async (patientId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await classifyPatientDR(patientId);
      if (result) {
        setClassification(result);
      } else {
        setError(t('errors.drClassification.noClassification'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknown'));
      console.error('Error en clasificación:', err);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const compareSessions = useCallback(async (sessionIds: number[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const results = await compareSessionClassifications(sessionIds);
      if (results.length > 0) {
        // Set the latest classification
        setClassification(results[results.length - 1]);
      } else {
        setError(t('errors.drClassification.noClassifications'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknown'));
      console.error('Error en comparación:', err);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const reset = useCallback(() => {
    setClassification(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    classification,
    isLoading,
    error,
    classifySession,
    classifyPatient,
    compareSessions,
    reset
  };
}
