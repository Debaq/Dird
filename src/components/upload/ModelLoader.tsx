import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { inferenceService } from '@/lib/ai/inference-service';
import { getAvailableModels } from '@/lib/ai/model-metadata';
import type { ModelInfo } from '@/lib/ai/model-metadata';

interface ModelLoaderProps {
  onModelsReady?: () => void;
}

type ModelStatus = 'idle' | 'loading' | 'loaded' | 'error';

const ModelLoader: React.FC<ModelLoaderProps> = ({ onModelsReady }) => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [detectionStatus, setDetectionStatus] = useState<ModelStatus>('idle');
  const [segmentationStatus, setSegmentationStatus] = useState<ModelStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAvailableModels();
  }, []);

  const loadAvailableModels = async () => {
    try {
      const availableModels = await getAvailableModels();
      setModels(availableModels);
    } catch (error) {
      console.error('Error loading model metadata:', error);
      setError('No se pudieron cargar los modelos');
    }
  };

  const loadDetectionModel = async () => {
    const detectionModel = models.find((m) => m.metadata.model_type === 'detection');
    if (!detectionModel) {
      setError('Modelo de detección no disponible');
      return;
    }

    setDetectionStatus('loading');
    setError(null);

    try {
      await inferenceService.loadDetectionModel(detectionModel.path, detectionModel.metadata);
      setDetectionStatus('loaded');
      checkAllModelsLoaded();
    } catch (error) {
      console.error('Error loading detection model:', error);
      setDetectionStatus('error');
      setError('Error al cargar el modelo de detección');
    }
  };

  const loadSegmentationModel = async () => {
    const segmentationModel = models.find((m) => m.metadata.model_type === 'segmentation');
    if (!segmentationModel) {
      setError('Modelo de segmentación no disponible');
      return;
    }

    setSegmentationStatus('loading');
    setError(null);

    try {
      await inferenceService.loadSegmentationModel(
        segmentationModel.path,
        segmentationModel.metadata
      );
      setSegmentationStatus('loaded');
      checkAllModelsLoaded();
    } catch (error) {
      console.error('Error loading segmentation model:', error);
      setSegmentationStatus('error');
      setError('Error al cargar el modelo de segmentación');
    }
  };

  const checkAllModelsLoaded = () => {
    if (inferenceService.isDetectionModelLoaded()) {
      onModelsReady?.();
    }
  };

  const getStatusIcon = (status: ModelStatus) => {
    switch (status) {
      case 'loading':
        return <Loader className="w-5 h-5 animate-spin text-primary-500" />;
      case 'loaded':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const detectionModel = models.find((m) => m.metadata.model_type === 'detection');
  const segmentationModel = models.find((m) => m.metadata.model_type === 'segmentation');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modelos de IA</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Detection Model */}
        {detectionModel && (
          <div className="flex items-center justify-between p-3 bg-coal-50 rounded-lg">
            <div className="flex-1">
              <h4 className="font-medium text-coal-800">Modelo de Detección</h4>
              <p className="text-xs text-smoke-500">{detectionModel.metadata.model_version}</p>
              {detectionStatus === 'loaded' && (
                <p className="text-xs text-green-600 mt-1">
                  Precisión: {(detectionModel.metadata.metrics?.precision || 0) * 100}%
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(detectionStatus)}
              {detectionStatus === 'idle' && (
                <Button size="sm" onClick={loadDetectionModel}>
                  Cargar
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Segmentation Model */}
        {segmentationModel && (
          <div className="flex items-center justify-between p-3 bg-coal-50 rounded-lg">
            <div className="flex-1">
              <h4 className="font-medium text-coal-800">Modelo de Segmentación</h4>
              <p className="text-xs text-smoke-500">
                {segmentationModel.metadata.model_version}
              </p>
              <p className="text-xs text-accent-600 mt-1">Beta</p>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(segmentationStatus)}
              {segmentationStatus === 'idle' && (
                <Button size="sm" variant="outline" onClick={loadSegmentationModel}>
                  Cargar
                </Button>
              )}
            </div>
          </div>
        )}

        {models.length === 0 && !error && (
          <p className="text-sm text-smoke-500 text-center py-4">
            No hay modelos disponibles
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default ModelLoader;
