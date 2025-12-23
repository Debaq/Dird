import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Download, Trash2, RefreshCw, Github, HardDrive, CheckCircle } from 'lucide-react';
import { modelDownloader, formatBytes, type AvailableModel } from '@/lib/ai/model-downloader';
import { inferenceService } from '@/lib/ai/inference-service';

const ModelSettings: React.FC = () => {
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [isDetectionCached, setIsDetectionCached] = useState(false);
  const [isSegmentationCached, setIsSegmentationCached] = useState(false);
  const [detectionVersion, setDetectionVersion] = useState<string | null>(null);
  const [segmentationVersion, setSegmentationVersion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState(modelDownloader.getConfig());
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    loadCacheStatus();
    loadAvailableModels();
  }, []);

  const loadCacheStatus = async () => {
    try {
      const size = await modelDownloader.getCacheSize();
      setCacheSize(size);

      // Get loaded versions
      const detectionVer = await modelDownloader.getLoadedModelVersion('detection');
      setDetectionVersion(detectionVer);
      setIsDetectionCached(!!detectionVer); // If there's a version, it's cached

      const segmentationVer = await modelDownloader.getLoadedModelVersion('segmentation');
      setSegmentationVersion(segmentationVer);
      setIsSegmentationCached(!!segmentationVer); // If there's a version, it's cached
    } catch (error) {
      console.error('Error loading cache status:', error);
    }
  };

  const loadAvailableModels = async () => {
    setLoadingModels(true);
    try {
      const models = await modelDownloader.listAvailableModels('main');

      // Sort models by version (descending)
      const sortedModels = models.sort((a, b) => {
        const aParts = a.version.split('.').map(Number);
        const bParts = b.version.split('.').map(Number);

        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aVal = aParts[i] || 0;
          const bVal = bParts[i] || 0;
          if (aVal !== bVal) {
            return bVal - aVal; // Descending order
          }
        }
        return 0;
      });

      setAvailableModels(sortedModels);
      console.log('Modelos disponibles (ordenados):', sortedModels);
    } catch (error) {
      console.error('Error loading available models:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  // Helper to check if this is the latest version of its type
  const isLatestVersion = (model: AvailableModel): boolean => {
    const sameTypeModels = availableModels.filter(m => m.type === model.type);
    if (sameTypeModels.length === 0) return false;
    return sameTypeModels[0].version === model.version;
  };

  const handleDownloadDetection = async () => {
    setIsLoading(true);
    try {
      await inferenceService.loadDetectionModel();
      alert('✅ Modelo de detección descargado y cargado exitosamente');
      await loadCacheStatus();
    } catch (error) {
      console.error('Error downloading detection model:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert('❌ Error al descargar el modelo:\n\n' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('¿Estás seguro de que quieres limpiar el cache de modelos?')) return;

    setIsLoading(true);
    try {
      await modelDownloader.clearCache();
      await inferenceService.dispose();
      alert('Cache limpiado exitosamente');
      await loadCacheStatus();
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Error al limpiar el cache');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBranchChange = (modelType: 'detection' | 'segmentation', branch: string) => {
    const newConfig = { ...config };
    if (newConfig[modelType]) {
      newConfig[modelType] = {
        ...newConfig[modelType]!,
        branch,
      };
    }
    setConfig(newConfig);
    modelDownloader.updateConfig(newConfig);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Modelos</CardTitle>
          <CardDescription>
            Gestiona los modelos de IA descargados desde GitHub o locales
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Available Models from Repository */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-coal-800">Modelos Disponibles</h3>
                <p className="text-sm text-smoke-500">
                  Repositorio: <span className="font-mono">github.com/Debaq/dird_models</span>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadAvailableModels}
                disabled={loadingModels}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loadingModels ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>

            {loadingModels ? (
              <div className="text-center py-8 text-smoke-500">
                Buscando modelos disponibles...
              </div>
            ) : availableModels.length === 0 ? (
              <div className="text-center py-8 text-smoke-500">
                No se encontraron modelos en el repositorio
              </div>
            ) : (
              <div className="space-y-3">
                {/* Detection Models */}
                {availableModels.filter(m => m.type === 'detection').length > 0 && (
                  <div>
                    <Label className="text-xs text-smoke-600 uppercase mb-2 block">
                      Modelos de Detección
                    </Label>
                    <div className="space-y-2">
                      {availableModels
                        .filter(m => m.type === 'detection')
                        .map((model, index) => {
                          const isLatest = index === 0; // First one is the latest after sorting
                          const isLoaded = detectionVersion === model.version;

                          return (
                            <div
                              key={model.name}
                              className={`flex items-center justify-between p-3 border rounded-md hover:bg-smoke-50 ${
                                isLoaded ? 'bg-primary-50 border-primary-200' : ''
                              }`}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-sm font-medium">{model.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    v{model.version}
                                  </Badge>
                                  {isLatest && (
                                    <Badge variant="default" className="text-xs">
                                      Más reciente
                                    </Badge>
                                  )}
                                  {isLoaded && (
                                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" />
                                      En uso
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant={isLoaded ? "secondary" : "outline"}
                                size="sm"
                                onClick={handleDownloadDetection}
                                disabled={isLoading || isLoaded}
                              >
                                {isLoaded ? (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Descargado
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-4 h-4 mr-2" />
                                    Descargar
                                  </>
                                )}
                              </Button>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Segmentation Models */}
                {availableModels.filter(m => m.type === 'segmentation').length > 0 && (
                  <div>
                    <Label className="text-xs text-smoke-600 uppercase mb-2 block">
                      Modelos de Segmentación
                    </Label>
                    <div className="space-y-2">
                      {availableModels
                        .filter(m => m.type === 'segmentation')
                        .map((model, index) => {
                          const isLatest = index === 0; // First one is the latest after sorting
                          const isLoaded = segmentationVersion === model.version;

                          return (
                            <div
                              key={model.name}
                              className={`flex items-center justify-between p-3 border rounded-md hover:bg-smoke-50 ${
                                isLoaded ? 'bg-primary-50 border-primary-200' : ''
                              }`}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-sm font-medium">{model.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    v{model.version}
                                  </Badge>
                                  {isLatest && (
                                    <Badge variant="default" className="text-xs">
                                      Más reciente
                                    </Badge>
                                  )}
                                  {isLoaded && (
                                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" />
                                      En uso
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                              >
                                Próximamente
                              </Button>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Current Status */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-coal-800">Estado Actual</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between p-2 bg-smoke-50 rounded">
                <div>
                  <span className="text-smoke-700 font-medium">Modelo de Detección</span>
                  {detectionVersion && (
                    <div className="text-xs text-smoke-500 font-mono mt-0.5">
                      detection-v{detectionVersion}.onnx
                    </div>
                  )}
                </div>
                {isDetectionCached ? (
                  <Badge variant="default" className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    v{detectionVersion}
                  </Badge>
                ) : (
                  <Badge variant="outline">No cargado</Badge>
                )}
              </div>
              <div className="flex items-center justify-between p-2 bg-smoke-50 rounded">
                <div>
                  <span className="text-smoke-700 font-medium">Modelo de Segmentación</span>
                  {segmentationVersion && (
                    <div className="text-xs text-smoke-500 font-mono mt-0.5">
                      segmentation-v{segmentationVersion}.onnx
                    </div>
                  )}
                </div>
                {isSegmentationCached ? (
                  <Badge variant="default" className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    v{segmentationVersion}
                  </Badge>
                ) : (
                  <Badge variant="outline">No disponible</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Cache Status */}
          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-coal-800">Cache de Modelos</h3>
                <p className="text-sm text-smoke-500">
                  Tamaño total: <span className="font-medium">{formatBytes(cacheSize)}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadCacheStatus}
                  disabled={isLoading}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Actualizar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClearCache}
                  disabled={isLoading || cacheSize === 0}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Limpiar Cache
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Información</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-smoke-600">
          <p>
            • Los modelos se descargan desde GitHub y se almacenan en cache para uso offline
          </p>
          <p>
            • Cada rama del repositorio contiene una versión diferente del modelo
          </p>
          <p>
            • Si la descarga falla, se usará el modelo local como fallback
          </p>
          <p>
            • El cache persiste entre sesiones y se puede limpiar en cualquier momento
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ModelSettings;
