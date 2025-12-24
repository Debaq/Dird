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

interface ModelInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: ModelMetadata | null;
}

const ModelInfoModal: React.FC<ModelInfoModalProps> = ({ open, onOpenChange, metadata }) => {
  const { t } = useTranslation();

  if (!metadata) return null;

  const statusConfig = {
    EXCELLENT: { color: 'bg-green-500', icon: CheckCircle, text: 'Excelente' },
    GOOD: { color: 'bg-blue-500', icon: Info, text: 'Bueno' },
    REQUIRES_IMPROVEMENT: { color: 'bg-yellow-500', icon: AlertTriangle, text: 'Requiere Mejora' },
    CRITICAL: { color: 'bg-red-500', icon: AlertCircle, text: 'Crítico' },
  };

  const status = metadata.analysis_report?.status || 'GOOD';
  const StatusIcon = statusConfig[status].icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {t('settings.models.modelInfo') || 'Información del Modelo'}
            <Badge variant="outline" className="font-mono">
              {metadata.model_info?.version || 'N/A'}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Detalles técnicos, métricas de rendimiento y análisis del modelo de detección
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Model Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información General</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-smoke-600">Tipo:</span>
                <div className="font-medium text-coal-800">{metadata.model_info?.type || 'N/A'}</div>
              </div>
              <div>
                <span className="text-smoke-600">Fecha de Entrenamiento:</span>
                <div className="font-medium text-coal-800">{metadata.model_info?.date_trained || 'N/A'}</div>
              </div>
              <div>
                <span className="text-smoke-600">Tamaño de Entrada:</span>
                <div className="font-medium text-coal-800">
                  {metadata.model_info?.input_size ? `${metadata.model_info.input_size[0]} x ${metadata.model_info.input_size[1]}` : 'N/A'}
                </div>
              </div>
              <div>
                <span className="text-smoke-600">Estado del Modelo:</span>
                <div className="flex items-center gap-2 mt-1">
                  <StatusIcon className={`w-4 h-4 ${statusConfig[status].color.replace('bg-', 'text-')}`} />
                  <span className="font-medium text-coal-800">{statusConfig[status].text}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Global Metrics */}
          {metadata.performance_metrics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Métricas Globales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-smoke-600">mAP@50</span>
                      <span className="text-sm font-medium text-coal-800">
                        {(metadata.performance_metrics.global.mAP50 * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={metadata.performance_metrics.global.mAP50 * 100} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-smoke-600">mAP@50-95</span>
                      <span className="text-sm font-medium text-coal-800">
                        {(metadata.performance_metrics.global['mAP50-95'] * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={metadata.performance_metrics.global['mAP50-95'] * 100} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-smoke-600">Precisión Global</span>
                      <span className="text-sm font-medium text-coal-800">
                        {(metadata.performance_metrics.global.precision_overall * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={metadata.performance_metrics.global.precision_overall * 100} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-smoke-600">Recall Global</span>
                      <span className="text-sm font-medium text-coal-800">
                        {(metadata.performance_metrics.global.recall_overall * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={metadata.performance_metrics.global.recall_overall * 100} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Classes and Performance */}
          {metadata.classes && metadata.performance_metrics?.per_class_mAP50 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clases Detectables</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metadata.classes.map((classId) => {
                    const mAP = metadata.performance_metrics.per_class_mAP50[classId];
                    const color = getClassColor(classId);

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
                                {t(classId, { ns: 'classes' })}
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

          {/* Critical Findings */}
          {metadata.analysis_report?.critical_findings && metadata.analysis_report.critical_findings.length > 0 && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  Hallazgos Críticos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {metadata.analysis_report.critical_findings.map((finding, index) => (
                  <div key={index} className="border-l-4 border-yellow-400 pl-4 py-2">
                    <div className="font-medium text-coal-800 mb-1">{finding.issue}</div>
                    {finding.metric && (
                      <div className="text-sm text-smoke-600 mb-1">
                        <span className="font-medium">Métrica:</span> {finding.metric}
                      </div>
                    )}
                    <div className="text-sm text-smoke-700">{finding.observation}</div>
                    {finding.cause && (
                      <div className="text-sm text-smoke-600 mt-1">
                        <span className="font-medium">Causa:</span> {finding.cause}
                      </div>
                    )}
                    {finding.implication && (
                      <div className="text-sm text-smoke-600 mt-1">
                        <span className="font-medium">Implicación:</span> {finding.implication}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {metadata.analysis_report?.recommendations_next_steps && metadata.analysis_report.recommendations_next_steps.length > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Recomendaciones y Próximos Pasos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {metadata.analysis_report.recommendations_next_steps.map((recommendation, index) => (
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
