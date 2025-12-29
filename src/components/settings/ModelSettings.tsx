import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Download, Trash2, RefreshCw, CheckCircle, Info, Settings2 } from 'lucide-react';
import { modelDownloader, formatBytes, type AvailableModel } from '@/lib/ai/model-downloader';
import { inferenceService } from '@/lib/ai/inference-service';
import { useConfigStore } from '@/stores/config-store';
import type { ModelMetadata } from '@/lib/ai/model-metadata';
import ModelInfoModal from './ModelInfoModal';
import ClassManagementModal from './ClassManagementModal';
import { useConfirm } from '@/hooks/useConfirm';
import { classManager } from '@/lib/classes/class-manager';

const ModelSettings: React.FC = () => {
  const { t } = useTranslation();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [isDetectionCached, setIsDetectionCached] = useState(false);
  const [isSegmentationCached, setIsSegmentationCached] = useState(false);
  const [detectionVersion, setDetectionVersion] = useState<string | null>(null);
  const [segmentationVersion, setSegmentationVersion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [detectionMetadata, setDetectionMetadata] = useState<ModelMetadata | null>(null);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const [showClassManager, setShowClassManager] = useState(false);

  const { config, updateLocalModels } = useConfigStore();

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

      // Try to load metadata if model is cached
      if (detectionVer) {
        try {
          // First try to get from cache (model metadata is cached with the model)
          const cache = await caches.open('dird-onnx-models');
          const cachedMetadata = await cache.match(`https://raw.githubusercontent.com/Debaq/dird_models/main/detection-v${detectionVer}.json`);

          if (cachedMetadata) {
            const metadata = await cachedMetadata.json();
            setDetectionMetadata(metadata);
          } else {
            // If not in cache, try to fetch from GitHub
            const metadataUrl = `https://raw.githubusercontent.com/Debaq/dird_models/main/detection-v${detectionVer}.json`;
            const response = await fetch(metadataUrl);
            if (response.ok) {
              const metadata = await response.json();
              setDetectionMetadata(metadata);
              // Cache for future use
              await cache.put(metadataUrl, response.clone());
            }
          }
        } catch (error) {
          console.warn('Could not load detection metadata from cache or GitHub:', error);
          // Fallback: Get classes from classManager
          try {
            await classManager.ensureMetadataLoaded();
            const aiClasses = classManager.getAIClasses();
            // Create minimal metadata with classes from classManager
            setDetectionMetadata({
              classes: aiClasses,
              model_info: {
                version: detectionVer || 'unknown',
                type: 'detection'
              }
            } as any);
          } catch (fallbackError) {
            console.error('Could not load metadata from classManager:', fallbackError);
            // Last resort: set minimal metadata
            setDetectionMetadata({ classes: [] } as any);
          }
        }
      }

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





  const handleDownloadDetection = async () => {
    setIsLoading(true);
    try {
      await inferenceService.loadDetectionModel();
      toast.success(t('settings.models.downloadSuccess'));
      await loadCacheStatus();
    } catch (error) {
      console.error('Error downloading detection model:', error);
      const errorMessage = error instanceof Error ? error.message : t('errors.unknown');
      toast.error(t('settings.models.downloadError'), {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCache = async () => {
    const confirmed = await confirm({
      title: t('settings.models.clearCache'),
      description: t('settings.models.clearCacheConfirm'),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
      variant: 'warning',
    });

    if (!confirmed) return;

    setIsLoading(true);
    try {
      await modelDownloader.clearCache();
      await inferenceService.dispose();
      toast.success(t('settings.models.clearCacheSuccess'));
      await loadCacheStatus();
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast.error(t('settings.models.clearCacheError'));
    } finally {
      setIsLoading(false);
    }
  };

  // handleBranchChange se utiliza para cambiar la rama del modelo




  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.models.title')}</CardTitle>
          <CardDescription>
            {t('settings.models.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Available Models from Repository */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-coal-800">{t('settings.models.available')}</h3>
                <p className="text-sm text-smoke-500">
                  {t('settings.models.repository')}: <span className="font-mono">github.com/Debaq/dird_models</span>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadAvailableModels}
                disabled={loadingModels}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loadingModels ? 'animate-spin' : ''}`} />
                {t('ui.refresh')}
              </Button>
            </div>

            {loadingModels ? (
              <div className="text-center py-8 text-smoke-500">
                {t('settings.models.searching')}
              </div>
            ) : availableModels.length === 0 ? (
              <div className="text-center py-8 text-smoke-500">
                {t('settings.models.notFound')}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Detection Models */}
                {availableModels.filter(m => m.type === 'detection').length > 0 && (
                  <div>
                    <Label className="text-xs text-smoke-600 uppercase mb-2 block">
                      {t('settings.models.detectionModels')}
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
                                      {t('settings.models.latest')}
                                    </Badge>
                                  )}
                                  {isLoaded && (
                                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" />
                                      {t('settings.models.inUse')}
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
                                    {t('settings.models.downloaded')}
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-4 h-4 mr-2" />
                                    {t('settings.models.download')}
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
                      {t('settings.models.segmentationModels')}
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
                                      {t('settings.models.latest')}
                                    </Badge>
                                  )}
                                  {isLoaded && (
                                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" />
                                      {t('settings.models.inUse')}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                              >
                                {t('ui.comingSoon.general')}
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
            <h3 className="font-semibold text-coal-800">{t('settings.models.currentStatus')}</h3>
            <div className="space-y-4 text-sm">
              {/* Detection Model Status */}
              <div className="p-3 bg-smoke-50 rounded border border-smoke-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <span className="text-coal-700 font-medium">{t('models.detection')}</span>
                    {detectionVersion && (
                      <div className="text-xs text-smoke-500 font-mono mt-0.5">
                        detection-v{detectionVersion}.onnx
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isDetectionCached && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowClassManager(true)}
                          className="h-8 px-2"
                          title={t('settings.classes.manage')}
                        >
                          <Settings2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowModelInfo(true)}
                          className="h-8 px-2"
                          title={t('settings.models.viewInfo')}
                        >
                          <Info className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {isDetectionCached ? (
                      <Badge variant="default" className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        v{detectionVersion}
                      </Badge>
                    ) : (
                      <Badge variant="outline">{t('settings.models.notLoaded')}</Badge>
                    )}
                  </div>
                </div>
                
                {/* Sensitivity Slider */}
                <div className="space-y-2 pt-2 border-t border-smoke-200">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-medium text-coal-600">
                      {t('settings.models.sensitivity')}
                    </Label>
                    <span className="text-xs font-mono text-coal-600">
                      {Math.round((config.localModels.detection.sensitivity || 0.5) * 100)}%
                    </span>
                  </div>
                  <Slider
                    defaultValue={[config.localModels.detection.sensitivity || 0.5]}
                    value={[config.localModels.detection.sensitivity || 0.5]}
                    min={0.1}
                    max={0.95}
                    step={0.05}
                    onValueChange={(value) => {
                      updateLocalModels({
                        detection: {
                          ...config.localModels.detection,
                          sensitivity: value[0]
                        }
                      });
                    }}
                  />
                  <p className="text-[10px] text-smoke-500">
                    {t('settings.models.sensitivityHelp')}
                  </p>
                </div>
              </div>

              {/* Segmentation Model Status */}
              <div className="flex items-center justify-between p-3 bg-smoke-50 rounded border border-smoke-100">
                <div>
                  <span className="text-coal-700 font-medium">{t('models.segmentation')}</span>
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
                  <Badge variant="outline">{t('settings.models.notAvailable')}</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Cache Status */}
          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-coal-800">{t('settings.models.cache')}</h3>
                <p className="text-sm text-smoke-500">
                  {t('settings.models.totalSize')}: <span className="font-medium">{formatBytes(cacheSize)}</span>
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
                  {t('ui.refresh')}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClearCache}
                  disabled={isLoading || cacheSize === 0}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('settings.models.clearCache')}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.models.info')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-smoke-600">
          <p>
            {t('settings.models.info1')}
          </p>
          <p>
            {t('settings.models.info2')}
          </p>
          <p>
            {t('settings.models.info3')}
          </p>
          <p>
            {t('settings.models.info4')}
          </p>
        </CardContent>
      </Card>

      {/* Model Info Modal */}
      <ModelInfoModal
        open={showModelInfo}
        onOpenChange={setShowModelInfo}
        metadata={detectionMetadata}
      />

      <ClassManagementModal
        open={showClassManager}
        onOpenChange={setShowClassManager}
      />

      {/* Confirm Dialog */}
      {ConfirmDialogComponent}
    </div>
  );
};

export default ModelSettings;
