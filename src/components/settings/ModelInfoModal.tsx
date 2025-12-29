import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import type { ModelMetadata } from '@/lib/ai/model-metadata';
import { getClassColor } from '@/lib/ai/model-metadata';
import { classManager } from '@/lib/classes/class-manager';
import { useEffect, useState } from 'react';

interface ModelInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: ModelMetadata | null;
}

const ModelInfoModal: React.FC<ModelInfoModalProps> = ({ open, onOpenChange, metadata }) => {
  const { t } = useTranslation();
  const [enrichedMetadata, setEnrichedMetadata] = useState<ModelMetadata | null>(metadata);

  // Enrich metadata with classManager data if available
  useEffect(() => {
    const enrichMetadata = async () => {
      if (!metadata) {
        setEnrichedMetadata(null);
        return;
      }

      // Always try to enrich with classManager data
      await classManager.ensureMetadataLoaded();
      const classDefinitions = classManager.getAIClassDefinitions();

      // Map legacy structure to new structure for compatibility
      const enriched: ModelMetadata = { ...metadata };

      // Ensure classes array
      if (classDefinitions.length > 0) {
        enriched.classes = classDefinitions;
      }

      // Map legacy metrics to performance_metrics structure
      if (metadata.metrics && !metadata.performance_metrics) {
        enriched.performance_metrics = {
          global: {
            mAP50: metadata.metrics.mAP50 || 0,
            'mAP50-95': metadata.metrics.mAP50_95 || 0,
            precision_overall: metadata.metrics.precision || 0,
            recall_overall: metadata.metrics.recall || 0,
          },
          per_class_mAP50: metadata.metrics.per_class_mAP50 || {},
        };
      }

      // Map training_info to analysis_report structure
      if (metadata.training_info && !metadata.analysis_report) {
        const hasIssues = metadata.training_info.known_issues && metadata.training_info.known_issues.length > 0;

        enriched.analysis_report = {
          status: hasIssues ? 'REQUIRES_IMPROVEMENT' : 'GOOD',
          critical_findings: (metadata.training_info.known_issues || []).map(issue => ({
            issue: issue,
            observation: 'Detected during training',
          })),
          recommendations_next_steps: metadata.training_info.recommended_improvements || [],
        };
      }

      // Map legacy model_info fields
      if (!enriched.model_info) {
        enriched.model_info = {
          version: metadata.model_version || 'unknown',
          type: metadata.model_type || 'detection',
          date_trained: metadata.date_trained || 'unknown',
          input_size: metadata.input_size || [640, 640],
        };
      }

      setEnrichedMetadata(enriched);
    };

    enrichMetadata();
  }, [metadata, open]);

  const statusConfig = {
    EXCELLENT: { color: 'bg-green-500', icon: CheckCircle, text: t('settings.models.statusTexts.excellent') },
    GOOD: { color: 'bg-blue-500', icon: Info, text: t('settings.models.statusTexts.good') },
    REQUIRES_IMPROVEMENT: { color: 'bg-yellow-500', icon: AlertTriangle, text: t('settings.models.statusTexts.improvement') },
    CRITICAL: { color: 'bg-red-500', icon: AlertCircle, text: t('settings.models.statusTexts.critical') },
  };

  const status = enrichedMetadata?.analysis_report?.status || 'GOOD';
  const StatusIcon = statusConfig[status].icon;

  const hasFullMetadata = enrichedMetadata && (enrichedMetadata.model_info || enrichedMetadata.performance_metrics);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {t('settings.models.modelInfo')}
            <Badge variant="outline" className="font-mono">
              {enrichedMetadata?.model_info?.version || enrichedMetadata?.model_version || 'N/A'}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {t('settings.models.modelInfoDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Warning when metadata is not fully loaded */}
          {!hasFullMetadata && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-900 mb-1">
                      {t('settings.models.metadataNotLoaded') || 'Metadata completo no disponible'}
                    </p>
                    <p className="text-sm text-amber-700">
                      {t('settings.models.metadataNotLoadedDesc') || 'La información completa del modelo no está disponible. Intenta recargar el modelo o verifica la conexión a internet.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Model Info */}
          {hasFullMetadata && (
            <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('settings.models.generalInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-smoke-600">{t('settings.models.type')}</span>
                <div className="font-medium text-coal-800">{enrichedMetadata.model_info?.type || enrichedMetadata.model_type || 'N/A'}</div>
              </div>
              <div>
                <span className="text-smoke-600">{t('settings.models.dateTrained')}</span>
                <div className="font-medium text-coal-800">{enrichedMetadata.model_info?.date_trained || enrichedMetadata.date_trained || 'N/A'}</div>
              </div>
              <div>
                <span className="text-smoke-600">{t('settings.models.inputSize')}</span>
                <div className="font-medium text-coal-800">
                  {enrichedMetadata.model_info?.input_size ? `${enrichedMetadata.model_info.input_size[0]} x ${enrichedMetadata.model_info.input_size[1]}` : enrichedMetadata.input_size ? `${enrichedMetadata.input_size[0]} x ${enrichedMetadata.input_size[1]}` : 'N/A'}
                </div>
              </div>
              <div>
                <span className="text-smoke-600">{t('settings.models.modelStatus')}</span>
                <div className="flex items-center gap-2 mt-1">
                  <StatusIcon className={`w-4 h-4 ${statusConfig[status].color.replace('bg-', 'text-')}`} />
                  <span className="font-medium text-coal-800">{statusConfig[status].text}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Global Metrics */}
          {enrichedMetadata?.performance_metrics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('settings.models.globalMetrics')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-smoke-600">mAP@50</span>
                      <span className="text-sm font-medium text-coal-800">
                        {(enrichedMetadata.performance_metrics.global.mAP50 * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={enrichedMetadata.performance_metrics.global.mAP50 * 100} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-smoke-600">mAP@50-95</span>
                      <span className="text-sm font-medium text-coal-800">
                        {(enrichedMetadata.performance_metrics.global['mAP50-95'] * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={enrichedMetadata.performance_metrics.global['mAP50-95'] * 100} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-smoke-600">{t('settings.models.globalMetricsPrecision') || 'Precisión Global'}</span>
                      <span className="text-sm font-medium text-coal-800">
                        {(enrichedMetadata.performance_metrics.global.precision_overall * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={enrichedMetadata.performance_metrics.global.precision_overall * 100} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-smoke-600">{t('settings.models.globalMetricsRecall') || 'Recall Global'}</span>
                      <span className="text-sm font-medium text-coal-800">
                        {(enrichedMetadata.performance_metrics.global.recall_overall * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={enrichedMetadata.performance_metrics.global.recall_overall * 100} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Classes and Performance */}
          {enrichedMetadata?.classes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('settings.models.detectableClasses')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {enrichedMetadata.classes.map((classItem) => {
                    // Handle both string[] and ClassDefinitionMetadata[]
                    const classId = typeof classItem === 'string' ? classItem : classItem.technical_name;
                    const displayName = typeof classItem === 'object' && 'display_name_es' in classItem
                      ? classItem.display_name_es
                      : t(classId, { ns: 'classes' });
                    const mAP = enrichedMetadata.performance_metrics?.per_class_mAP50?.[classId];
                    const color = getClassColor(classId, enrichedMetadata);

                    return (
                      <div key={classId} className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-coal-800">
                                {displayName}
                              </span>
                              <span className="text-xs text-smoke-500 font-mono">
                                ({classId})
                              </span>
                            </div>
                            {mAP !== undefined && (
                              <span className="text-sm font-medium text-coal-800">
                                {(mAP * 100).toFixed(1)}%
                              </span>
                            )}
                          </div>
                          {mAP !== undefined && (
                            <Progress value={mAP * 100} className="h-1.5" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Training Information */}
          {enrichedMetadata?.training_info && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('settings.models.trainingInfo') || 'Training Information'}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                {enrichedMetadata.training_info.dataset && (
                  <div className="col-span-2">
                    <span className="text-smoke-600">Dataset</span>
                    <div className="font-medium text-coal-800">{enrichedMetadata.training_info.dataset}</div>
                  </div>
                )}
                {enrichedMetadata.training_info.num_images && (
                  <div>
                    <span className="text-smoke-600">{t('settings.models.numImages') || 'Images'}</span>
                    <div className="font-medium text-coal-800">{enrichedMetadata.training_info.num_images.toLocaleString()}</div>
                  </div>
                )}
                {enrichedMetadata.training_info.num_annotations && (
                  <div>
                    <span className="text-smoke-600">{t('settings.models.numAnnotations') || 'Annotations'}</span>
                    <div className="font-medium text-coal-800">{enrichedMetadata.training_info.num_annotations.toLocaleString()}</div>
                  </div>
                )}
                {enrichedMetadata.training_info.epochs && (
                  <div>
                    <span className="text-smoke-600">Epochs</span>
                    <div className="font-medium text-coal-800">{enrichedMetadata.training_info.epochs}</div>
                  </div>
                )}
                {enrichedMetadata.training_info.framework && (
                  <div>
                    <span className="text-smoke-600">Framework</span>
                    <div className="font-medium text-coal-800">{enrichedMetadata.training_info.framework}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Critical Findings */}
          {enrichedMetadata?.analysis_report?.critical_findings && enrichedMetadata.analysis_report.critical_findings.length > 0 && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  {t('settings.models.criticalFindings') || 'Known Issues'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {enrichedMetadata.analysis_report.critical_findings.map((finding, index) => (
                  <div key={index} className="border-l-4 border-yellow-400 pl-4 py-2">
                    <div className="font-medium text-coal-800 mb-1">{finding.issue}</div>
                    {finding.observation && finding.observation !== 'Detected during training' && (
                      <div className="text-sm text-smoke-700">{finding.observation}</div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {enrichedMetadata?.analysis_report?.recommendations_next_steps && enrichedMetadata.analysis_report.recommendations_next_steps.length > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  {t('settings.models.recommendations')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {enrichedMetadata.analysis_report.recommendations_next_steps.map((recommendation, index) => (
                    <li key={index} className="flex gap-2 text-sm text-coal-700">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ModelInfoModal;
