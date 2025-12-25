import React, { useState } from 'react';
import { 
  Eye, EyeOff, Lock, Unlock, Tag, Edit3, Trash2, ArrowUpDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { db, type Detection } from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import { classManager } from '@/lib/classes/class-manager';
import { getClassName } from '@/lib/ai/class-translations';
import ClassSelectionModal from './ClassSelectionModal';
import type { HistoryEntry } from '@/types/annotations';

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
  onDetectionsUpdate: () => void;
  onAddToHistory?: (entry: HistoryEntry) => void;
}

const AdvancedLayerControls: React.FC<AdvancedLayerControlsProps> = ({
  layers,
  onLayerUpdate,
  aiDetections,
  manualDetections,
  onDetectionsUpdate,
  onAddToHistory,
}) => {
  const { t, i18n } = useTranslation();
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({});
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [editingDetection, setEditingDetection] = useState<Detection | null>(null);

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

  return (
    <div className="bg-white rounded-lg border border-coal-200 p-4">
      <h3 className="font-semibold text-coal-800 mb-3">{t('canvas.layers.title')}</h3>
      <div className="space-y-2">
        {layers
          .sort((a, b) => b.zIndex - a.zIndex)
          .map((layer) => {
            const layerDetections = getLayerDetections(layer.id);
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
                    {layerDetections.length > 0 && (
                      <span className="ml-2 bg-coal-100 text-coal-600 text-xs px-2 py-0.5 rounded-full">
                        {layerDetections.length}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onLayerUpdate(layer.id, { visible: !layer.visible });
                      }}
                      className="p-2 lg:p-1 hover:bg-coal-100 rounded"
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
                        className="p-2 lg:p-1 hover:bg-coal-100 rounded"
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
                      className="p-2 lg:p-1 hover:bg-coal-100 rounded"
                      disabled={layer.id === 'original'}
                      title={layer.locked ? t('canvas.layers.unlock') : t('canvas.layers.lock')}
                    >
                      {layer.locked ? (
                        <Lock className="w-4 h-4 text-smoke-400" />
                      ) : (
                        <Unlock className="w-4 h-4 text-coal-600" />
                      )}
                    </button>
                    <button
                      className="p-2 lg:p-1 hover:bg-coal-100 rounded"
                      title={isExpanded ? t('canvas.layers.collapse') : t('canvas.layers.expand')}
                    >
                      <ArrowUpDown 
                        className={cn(
                          "w-4 h-4 transition-transform",
                          isExpanded ? "rotate-180 text-primary-500" : "text-smoke-400"
                        )} 
                      />
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
                    <span className="text-xs text-smoke-500 w-8 text-right">
                      {Math.round(layer.opacity * 100)}%
                    </span>
                  </div>
                )}

                {isExpanded && layerDetections.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-coal-100">
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {layerDetections.map((detection) => (
                        <div 
                          key={detection.id} 
                          className="p-2 bg-coal-50 rounded text-xs flex items-center justify-between group"
                        >
                          <div className="flex items-center">
                            <div
                              className="w-3 h-3 rounded-full mr-2"
                              style={{ backgroundColor: classManager.getColorForClass(detection.class) }}
                            />
                            <span className="font-medium">{getClassName(detection.class, i18n.language)}</span>
                            {detection.confidence && (
                              <span className="text-smoke-500 ml-2">
                                {Math.round(detection.confidence * 100)}%
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditClick(detection)}
                              title={layer.id === 'detections-ai' ? t('canvas.layers.convertAndEdit') : t('canvas.layers.editAnnotationClass')}
                              className="h-8 lg:h-6 px-2"
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteDetection(detection.id!)}
                              title={t('canvas.layers.deleteAnnotation')}
                              className="h-8 lg:h-6 px-2"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
      
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