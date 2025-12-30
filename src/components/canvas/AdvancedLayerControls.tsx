import React, { useState, useEffect } from 'react';
import {
  Eye, EyeOff, Lock, Unlock, Tag, Edit3, Trash2, Ruler
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { db, type Detection, type Measurement } from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import { classManager } from '@/lib/classes/class-manager';
import { getClassName } from '@/lib/ai/class-translations';
import ClassSelectionModal from './ClassSelectionModal';
import type { HistoryEntry } from '@/types/annotations';
import type { CircinatePatternAnalysis } from '@/lib/analysis/macular-edema-detector';
import { CircinateRingsAnalysisSection } from './CircinateRingsAnalysisSection';

export interface CanvasLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
  zIndex: number;
  showLabels?: boolean;
}

interface AdvancedLayerControlsProps {
  layers: CanvasLayer[];
  onLayerUpdate: (layerId: string, updates: Partial<CanvasLayer>) => void;
  aiDetections: Detection[];
  manualDetections: Detection[];
  measurements: Measurement[];
  onDetectionsUpdate: () => void;
  onMeasurementsUpdate?: () => void;
  onAddToHistory?: (entry: HistoryEntry) => void;
  selectedAnnotationId?: string | null;
  selectedMeasurementId?: number | null;
  onSelectAnnotation?: (id: string | null) => void;
  onSelectMeasurement?: (id: number | null) => void;
  circinateAnalysis?: CircinatePatternAnalysis | null;
}

const AdvancedLayerControls: React.FC<AdvancedLayerControlsProps> = ({
  layers,
  onLayerUpdate,
  aiDetections,
  manualDetections,
  measurements,
  onDetectionsUpdate,
  onMeasurementsUpdate,
  onAddToHistory,
  selectedAnnotationId,
  selectedMeasurementId,
  onSelectAnnotation,
  onSelectMeasurement,
  circinateAnalysis,
}) => {
  const { t, i18n } = useTranslation();
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({});
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [editingDetection, setEditingDetection] = useState<Detection | null>(null);

  // Auto-expand layer when an element is selected
  useEffect(() => {
    if (selectedAnnotationId) {
      const isAI = aiDetections.some(d => String(d.id) === selectedAnnotationId);
      const isManual = manualDetections.some(d => String(d.id) === selectedAnnotationId);
      
      if (isAI) setExpandedLayers(prev => ({ ...prev, 'detections-ai': true }));
      if (isManual) setExpandedLayers(prev => ({ ...prev, 'manual-annotations': true }));
    }
    
    if (selectedMeasurementId) {
      setExpandedLayers(prev => ({ ...prev, 'measurements': true }));
    }
  }, [selectedAnnotationId, selectedMeasurementId, aiDetections, manualDetections]);

  const toggleLayerExpansion = (layerId: string) => {
    setExpandedLayers(prev => ({
      ...prev,
      [layerId]: !prev[layerId]
    }));
  };

  const getLayerDetections = (layerId: string) => {
    switch (layerId) {
      case 'detections-ai':
        return aiDetections;
      case 'manual-annotations':
        return manualDetections;
      default:
        return [];
    }
  };

  const getLayerMeasurements = (layerId: string) => {
    if (layerId === 'measurements') {
      return measurements;
    }
    return [];
  };

  const handleDeleteMeasurement = async (measurementId: number) => {
    try {
      await db.measurements.update(measurementId, { visible: false });
      onMeasurementsUpdate?.();
    } catch (error) {
      console.error('Error deleting measurement:', error);
    }
  };

  const handleEditDetectionClass = async (detection: Detection, newClass: string) => {
    try {
      // Record history for update
      if (onAddToHistory) {
        const detectionBefore = await db.detections.get(detection.id!);
        // We construct the "after" state
        const detectionAfter = { ...detectionBefore, class: newClass, type: detection.type === 'ai' ? 'manual' : detection.type };
        if (detection.type === 'ai') {
             // @ts-ignore
             detectionAfter.customLabel = detection.class;
        }
        
        onAddToHistory({
            type: 'update',
            before: detectionBefore,
            after: detectionAfter
        });
      }

      if (detection.type === 'ai') {
        // Convertir detección AI a manual con la nueva clase
        await db.detections.update(detection.id!, {
          type: 'manual',
          class: newClass,
          customLabel: detection.class, // Guardar la clase original
        });
      } else {
        // Actualizar la clase de una detección manual existente
        await db.detections.update(detection.id!, {
          class: newClass,
        });
      }
      onDetectionsUpdate();
    } catch (error) {
      console.error('Error updating detection class:', error);
    }
  };

  const handleDeleteDetection = async (detectionId: number) => {
    try {
      if (onAddToHistory) {
        const detection = await db.detections.get(detectionId);
        if (detection) {
          onAddToHistory({ type: 'delete', detection });
        }
      }
      await db.detections.delete(detectionId);
      onDetectionsUpdate();
    } catch (error) {
      console.error('Error deleting detection:', error);
    }
  };

  const handleEditClick = (detection: Detection) => {
    setEditingDetection(detection);
    setClassModalOpen(true);
  };

  const handleClassModalConfirm = (newClass: string) => {
    if (editingDetection) {
      handleEditDetectionClass(editingDetection, newClass);
    }
    setClassModalOpen(false);
    setEditingDetection(null);
  };

  const targetLabelLayers = ['detections-ai', 'manual-annotations'];
  const areAnyLabelsVisible = layers
    .filter(l => targetLabelLayers.includes(l.id))
    .some(l => l.showLabels !== false);

  const handleToggleAllLabels = () => {
    const newState = !areAnyLabelsVisible;
    targetLabelLayers.forEach(id => {
      const layer = layers.find(l => l.id === id);
      if (layer) {
        onLayerUpdate(id, { showLabels: newState });
      }
    });
  };

  const targetMarkLayers = ['detections-ai', 'manual-annotations'];
  const areAnyMarksVisible = layers
    .filter(l => targetMarkLayers.includes(l.id))
    .some(l => l.visible !== false);

  const handleToggleAllMarks = () => {
    const newState = !areAnyMarksVisible;
    targetMarkLayers.forEach(id => {
      const layer = layers.find(l => l.id === id);
      if (layer) {
        onLayerUpdate(id, { visible: newState });
      }
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-coal-200 dark:border-gray-700 p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 className="font-semibold text-coal-800 dark:text-gray-100">{t('canvas.layers.title')}</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleAllLabels}
            title={areAnyLabelsVisible ? t('canvas.layers.hideAllLabels') + ' (L)' : t('canvas.layers.showAllLabels') + ' (L)'}
            className="h-8 px-2"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-smoke-600 dark:text-gray-400">
               <span>{areAnyLabelsVisible ? t('canvas.layers.hideAllLabels') + ' (L)' : t('canvas.layers.showAllLabels') + ' (L)'}</span>
               <Tag className={cn("w-4 h-4", areAnyLabelsVisible ? "text-primary-500" : "text-smoke-400")} />
            </div>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleAllMarks}
            title={areAnyMarksVisible ? t('canvas.layers.hideAllMarks') + ' (M)' : t('canvas.layers.showAllMarks') + ' (M)'}
            className="h-8 px-2"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-smoke-600 dark:text-gray-400">
               <span>{areAnyMarksVisible ? t('canvas.layers.hideAllMarks') + ' (M)' : t('canvas.layers.showAllMarks') + ' (M)'}</span>
               {areAnyMarksVisible ? <Eye className="w-4 h-4 text-primary-500" /> : <EyeOff className="w-4 h-4 text-smoke-400" />}
            </div>
          </Button>
        </div>
      </div>
      <div className="space-y-2 overflow-y-auto flex-1 pr-1 scrollbar-thin scrollbar-thumb-coal-200 dark:scrollbar-thumb-gray-700">
        {layers
          .filter(l => l.id !== 'original')
          .sort((a, b) => b.zIndex - a.zIndex)
          .map((layer) => {
            const layerDetections = getLayerDetections(layer.id);
            const layerMeasurements = getLayerMeasurements(layer.id);
            const itemCount = layerDetections.length + layerMeasurements.length;
            const isExpanded = expandedLayers[layer.id] || false;

            return (
              <div
                key={layer.id}
                className={cn(
                  'p-3 rounded-lg border transition-colors',
                  layer.visible ? 'border-coal-200 bg-white' : 'border-coal-100 bg-coal-50'
                )}
              >
                <div
                  className="flex items-center justify-between mb-2 cursor-pointer"
                  onClick={() => toggleLayerExpansion(layer.id)}
                >
                  <span
                    className={cn(
                      'text-sm font-medium flex items-center',
                      layer.visible ? 'text-coal-800' : 'text-smoke-400'
                    )}
                  >
                    {t(layer.name)}
                    {itemCount > 0 && (
                      <span className="ml-2 bg-coal-100 text-coal-600 text-xs px-2 py-0.5 rounded-full">
                        {itemCount}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onLayerUpdate(layer.id, { visible: !layer.visible });
                      }}
                      className="p-2 xl:p-1 hover:bg-coal-100 rounded"
                      title={layer.visible ? t('canvas.layers.hide') : t('canvas.layers.show')}
                    >
                      {layer.visible ? (
                        <Eye className="w-4 h-4 text-primary-500" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-smoke-400" />
                      )}
                    </button>
                    {(layer.id === 'detections-ai' || layer.id === 'manual-annotations') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLayerUpdate(layer.id, { showLabels: !layer.showLabels });
                        }}
                        className="p-2 xl:p-1 hover:bg-coal-100 rounded"
                        title={layer.showLabels !== false ? t('canvas.layers.hideLabels') : t('canvas.layers.showLabels')}
                      >
                        <Tag className={cn(
                          "w-4 h-4",
                          layer.showLabels !== false ? "text-primary-500" : "text-smoke-400"
                        )} />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onLayerUpdate(layer.id, { locked: !layer.locked });
                      }}
                      className="p-2 xl:p-1 hover:bg-coal-100 rounded"
                      disabled={layer.id === 'original'}
                      title={layer.locked ? t('canvas.layers.unlock') : t('canvas.layers.lock')}
                    >
                      {layer.locked ? (
                        <Lock className="w-4 h-4 text-smoke-400" />
                      ) : (
                        <Unlock className="w-4 h-4 text-coal-600" />
                      )}
                    </button>
                  </div>
                </div>

                {layer.visible && layer.id !== 'original' && (
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-xs text-smoke-500">{t('canvas.layers.opacity')}</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={layer.opacity * 100}
                      onChange={(e) =>
                        onLayerUpdate(layer.id, {
                          opacity: parseInt(e.target.value) / 100,
                        })
                      }
                      className="flex-1 h-1 bg-coal-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                )}

                {isExpanded && itemCount > 0 && (
                  <div className="mt-3 pt-3 border-t border-coal-100">
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {layerDetections.map((detection) => {
                        const isSelected = selectedAnnotationId === String(detection.id);
                        return (
                          <div
                            key={detection.id}
                            onClick={() => onSelectAnnotation?.(String(detection.id))}
                            className={cn(
                              "p-2 rounded text-xs flex items-center justify-between group cursor-pointer transition-colors",
                              isSelected 
                                ? "bg-primary-50 border border-primary-200 shadow-sm" 
                                : "bg-coal-50 hover:bg-coal-100 border border-transparent"
                            )}
                          >
                            <div className="flex items-center">
                              <div
                                className="w-3 h-3 rounded-full mr-2"
                                style={{ backgroundColor: classManager.getColorForClass(detection.class) }}
                              />
                              <span className={cn("font-medium", isSelected && "text-primary-700")}>
                                {getClassName(detection.class, i18n.language)}
                              </span>
                              {detection.confidence && (
                                <span className="text-smoke-500 ml-2">
                                  {Math.round(detection.confidence * 100)}%
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-1 opacity-100 xl:opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditClick(detection);
                                }}
                                title={layer.id === 'detections-ai' ? t('canvas.layers.convertAndEdit') : t('canvas.layers.editAnnotationClass')}
                                className="h-8 xl:h-6 px-2"
                              >
                                <Edit3 className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDetection(detection.id!);
                                }}
                                title={t('canvas.layers.deleteAnnotation')}
                                className="h-8 xl:h-6 px-2"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      {layerMeasurements.map((measurement) => {
                        const isSelected = selectedMeasurementId === measurement.id;
                        return (
                          <div
                            key={`measurement-${measurement.id}`}
                            onClick={() => onSelectMeasurement?.(measurement.id!)}
                            className={cn(
                              "p-2 rounded text-xs flex items-center justify-between group cursor-pointer transition-colors",
                              isSelected 
                                ? "bg-emerald-50 border border-emerald-200 shadow-sm" 
                                : "bg-coal-50 hover:bg-coal-100 border border-transparent"
                            )}
                          >
                            <div className="flex items-center">
                              <Ruler className={cn("w-3 h-3 mr-2", isSelected ? "text-emerald-700" : "text-emerald-600")} />
                              <span className={cn("font-medium", isSelected && "text-emerald-700")}>
                                {measurement.distanceDD
                                  ? `${measurement.distanceDD.toFixed(2)} DD`
                                  : `${measurement.distancePixels.toFixed(1)} px`}
                              </span>
                            </div>

                            <div className="flex items-center space-x-1 opacity-100 xl:opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteMeasurement(measurement.id!);
                                }}
                                title={t('canvas.layers.deleteAnnotation')}
                                className="h-8 xl:h-6 px-2"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Circinate Rings Analysis Section */}
      {circinateAnalysis && (
        <div className="mt-3 flex-shrink-0">
          <CircinateRingsAnalysisSection
            circinateAnalysis={circinateAnalysis}
            layerVisible={layers.find(l => l.id === 'circinate-rings')?.visible ?? false}
            onToggleLayer={() => {
              const circinateLayer = layers.find(l => l.id === 'circinate-rings');
              if (circinateLayer) {
                onLayerUpdate('circinate-rings', { visible: !circinateLayer.visible });
              }
            }}
          />
        </div>
      )}

      <ClassSelectionModal
        open={classModalOpen}
        onOpenChange={setClassModalOpen}
        onClassSelected={handleClassModalConfirm}
        onCancel={() => {
          setClassModalOpen(false);
          setEditingDetection(null);
        }}
        imageId={0}
      />
    </div>
  );
};

export default AdvancedLayerControls;