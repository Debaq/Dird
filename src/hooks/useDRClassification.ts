/**
 * Hook for DR Classification
 * Provides easy access to DR classification functionality in React components
 */

import { useState, useCallback } from 'react';
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

  const classifySession = useCallback(async (sessionId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await classifySessionDR(sessionId);
      if (result) {
        setClassification(result);
      } else {
        setError('No se pudo generar la clasificación');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error en clasificación:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const classifyPatient = useCallback(async (patientId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await classifyPatientDR(patientId);
      if (result) {
        setClassification(result);
      } else {
        setError('No se pudo generar la clasificación');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error en clasificación:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const compareSessions = useCallback(async (sessionIds: number[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const results = await compareSessionClassifications(sessionIds);
      if (results.length > 0) {
        // Set the latest classification
        setClassification(results[results.length - 1]);
      } else {
        setError('No se pudieron generar las clasificaciones');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error en comparación:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
