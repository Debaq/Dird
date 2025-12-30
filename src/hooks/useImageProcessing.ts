import { useEffect, useState, useCallback, useRef } from 'react';
import { useImageProcessingStore } from '@/stores/image-processing-store';
import { waitForOpenCV } from '@/lib/ai/optic-disc-refiner';
import { applyFilterPipeline } from '@/lib/image-processing/filter-pipeline';

export function useImageProcessing(imageBlob: Blob | null) {
  const { filters, showOriginal } = useImageProcessingStore();
  const [processedCanvas, setProcessedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debouncing: solo procesar después de 200ms sin cambios
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const processImage = useCallback(async () => {
    if (!imageBlob) {
      setProcessedCanvas(null);
      return;
    }

    // Filtrar solo filtros activos
    const activeFilters = filters.filter(f => f.enabled).sort((a, b) => a.order - b.order);

    if (activeFilters.length === 0) {
      setProcessedCanvas(null);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Esperar OpenCV si hay filtros avanzados
      const hasOpenCVFilters = activeFilters.some(f =>
        !['brightness', 'contrast', 'saturation'].includes(f.type)
      );

      if (hasOpenCVFilters) {
        const ready = await waitForOpenCV(5000);
        if (!ready) {
          throw new Error('OpenCV no disponible. Recarga la página.');
        }
      }

      // Cargar imagen
      const img = await loadImageFromBlob(imageBlob);

      // Aplicar pipeline de filtros
      const resultCanvas = await applyFilterPipeline(img, activeFilters);

      setProcessedCanvas(resultCanvas);
    } catch (err) {
      console.error('Error processing image:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setProcessedCanvas(null);
    } finally {
      setIsProcessing(false);
    }
  }, [imageBlob, filters, showOriginal]);

  // Debounced processing
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      processImage();
    }, 200);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [processImage]);

  return { processedCanvas, isProcessing, error };
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
