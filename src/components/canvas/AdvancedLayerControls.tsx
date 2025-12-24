import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, Unlock, Tag, Edit3, Trash2, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { db, type Detection } from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import { classManager, type ClassDefinition } from '@/lib/classes/class-manager';
import { Select } from '@/components/ui/select';

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
}

const AdvancedLayerControls: React.FC<AdvancedLayerControlsProps> = ({
  layers,
  onLayerUpdate,
  aiDetections,
  manualDetections,
  onDetectionsUpdate,
}) => {
  const { t } = useTranslation();
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({});
  const [classDefinitions, setClassDefinitions] = useState<ClassDefinition[]>([]);
  const [loadingClasses, setLoadingClasses] = useState<boolean>(true);

  useEffect(() => {
    const loadClassDefinitions = async () => {
      try {
        const definitions = await classManager.getAllClasses();
        setClassDefinitions(definitions);
        setLoadingClasses(false);
      } catch (error) {
        console.error('Error loading class definitions:', error);
        setClassDefinitions([]);
        setLoadingClasses(false);
      }
    };

    loadClassDefinitions();
  }, []);

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
      await db.detections.delete(detectionId);
      onDetectionsUpdate();
    } catch (error) {
      console.error('Error deleting detection:', error);
    }
  };

  const handleConvertToManual = async (detection: Detection) => {
    try {
      // Convertir detección AI a manual
      await db.detections.update(detection.id!, {
        type: 'manual',
        customLabel: detection.class, // Guardar la clase original
      });
      onDetectionsUpdate();
    } catch (error) {
      console.error('Error converting detection to manual:', error);
    }
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
                    {layer.name}
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
                      title={layer.visible ? 'Ocultar capa' : 'Mostrar capa'}
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
                        title={layer.showLabels !== false ? 'Ocultar etiquetas' : 'Mostrar etiquetas'}
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
                      title={layer.locked ? 'Desbloquear capa' : 'Bloquear capa'}
                    >
                      {layer.locked ? (
                        <Lock className="w-4 h-4 text-smoke-400" />
                      ) : (
                        <Unlock className="w-4 h-4 text-coal-600" />
                      )}
                    </button>
                    <button
                      className="p-2 lg:p-1 hover:bg-coal-100 rounded"
                      title={isExpanded ? 'Cerrar' : 'Expandir'}
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
                            <span className="font-medium">{getClassName(detection.class)}</span>
                            {detection.confidence && (
                              <span className="text-smoke-500 ml-2">
                                {Math.round(detection.confidence * 100)}%
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                            <Select
                              value={detection.class}
                              onValueChange={(newClass) => handleEditDetectionClass(detection, newClass)}
                              options={classDefinitions.map(cls => ({ value: cls.name, label: cls.displayName }))}
                              className="h-8 lg:h-6 w-[100px] text-xs p-1"
                              disabled={loadingClasses}
                            />
                            {layer.id === 'detections-ai' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleConvertToManual(detection)}
                                title="Convertir a manual"
                                className="h-8 lg:h-6 px-2"
                              >
                                <Edit3 className="w-3 h-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteDetection(detection.id!)}
                              title="Eliminar"
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
    </div>
  );
};

export default AdvancedLayerControls;