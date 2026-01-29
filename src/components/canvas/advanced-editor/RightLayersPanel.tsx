import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Copy,
  Layers as LayersIcon,
  Image as ImageIcon,
  BarChart3,
  Palette,
  Sliders,
  GripVertical
} from 'lucide-react';
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CanvasLayer } from '../AdvancedLayerControls';
import type { CanvasTool } from '../ToolPanel';

import { AdvancedImageProcessing } from './AdvancedImageProcessing';

interface RightLayersPanelProps {
  layers: CanvasLayer[];
  activeTool: CanvasTool;
  onLayerToggle: (layerId: string) => void;
  onLayerOpacityChange: (layerId: string, opacity: number) => void;
  onLayerLockToggle: (layerId: string) => void;
  onLayerReorder?: (oldIndex: number, newIndex: number) => void;
  imageUrl?: string;
  imageBlob?: Blob | null;
  onProcessedImage?: (canvas: HTMLCanvasElement | null) => void;
  layerData?: Record<string, any[]>;
  onSelectAnnotation?: (layerId: string, id: string | number) => void;
  onDeleteAnnotation?: (layerId: string, id: string | number) => void;
  selectedLandmarkType?: 'optic_disc' | 'fovea';
  onLandmarkTypeChange?: (type: 'optic_disc' | 'fovea') => void;
}

interface SortableLayerItemProps {
  layer: CanvasLayer;
  imageUrl?: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleVisible: () => void;
  onToggleLock: () => void;
  onOpacityChange: (opacity: number) => void;
  t: (key: string) => string;
  items?: any[];
  onSelect?: (layerId: string, id: string | number) => void;
  onDelete?: (layerId: string, id: string | number) => void;
}

function SortableLayerItem({
  layer,
  imageUrl,
  isExpanded,
  onToggleExpand,
  onToggleVisible,
  onToggleLock,
  onOpacityChange,
  t,
  items,
  onSelect,
  onDelete
}: SortableLayerItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: layer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-2 touch-none">
      <motion.div
        className={`bg-gray-800/50 rounded-lg border overflow-hidden transition-colors ${
          isDragging ? 'border-blue-500/50 shadow-lg' : 'border-gray-700/50 hover:border-gray-600/50'
        }`}
      >
        {/* Layer Header */}
        <div 
          className="flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-700/30 transition-colors"
          onClick={onToggleExpand}
        >
           {/* Drag Handle */}
           <div 
             {...attributes} 
             {...listeners} 
             className="cursor-grab hover:text-gray-300 text-gray-500 p-1"
             onClick={(e) => e.stopPropagation()}
           >
             <GripVertical className="w-4 h-4" />
           </div>

          <button
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-300 font-medium truncate">
              {t(layer.name) || layer.id}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisible();
              }}
              className={`p-1 rounded transition-colors ${
                layer.visible
                  ? 'text-blue-400 hover:text-blue-300'
                  : 'text-gray-600 hover:text-gray-500'
              }`}
              title={layer.visible ? 'Ocultar' : 'Mostrar'}
            >
              {layer.visible ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock();
              }}
              className={`p-1 rounded transition-colors ${
                layer.locked
                  ? 'text-red-400 hover:text-red-300'
                  : 'text-gray-600 hover:text-gray-500'
              }`}
              title={layer.locked ? 'Desbloquear' : 'Bloquear'}
            >
              {layer.locked ? (
                <Lock className="w-4 h-4" />
              ) : (
                <Unlock className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Layer Details (Expanded) */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-gray-700/50"
            >
              <div className="p-3 space-y-3">
                {layer.id === 'original' ? (
                  /* Thumbnail for Original Layer */
                  <div className="relative aspect-video bg-gray-900/50 rounded border border-gray-700/50 overflow-hidden">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={t(layer.name) || layer.id}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                ) : (
                  /* Object List for Other Layers */
                  <div className="max-h-40 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                    {items && items.length > 0 ? (
                      items.map((item, index) => {
                        const label = item.class || item.type || `Item ${index + 1}`;
                        const id = item.id;
                        return (
                          <div 
                            key={id || index}
                            className="flex items-center justify-between p-2 bg-gray-900/30 rounded hover:bg-gray-800/50 group cursor-pointer"
                            onClick={() => onSelect?.(layer.id, id)}
                          >
                            <span className="text-xs text-gray-400 truncate flex-1">{label}</span>
                            {onDelete && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(layer.id, id);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-1"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-gray-500 text-center py-2">Sin objetos</p>
                    )}
                  </div>
                )}

                {/* Opacity Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Opacidad</span>
                    <span className="text-gray-300 font-mono">
                      {Math.round(layer.opacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={layer.opacity * 100}
                    onChange={(e) =>
                      onOpacityChange(parseInt(e.target.value) / 100)
                    }
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                </div>

                {/* Actions - Only keep Delete for the whole layer if needed, or remove duplication */}
                {layer.id !== 'original' && (
                  <div className="flex items-center gap-1">
                    <button className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 text-xs rounded transition-colors">
                      <Copy className="w-3 h-3" />
                      <span>Duplicar</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export function RightLayersPanel({
  layers,
  activeTool,
  onLayerToggle,
  onLayerOpacityChange,
  onLayerLockToggle,
  onLayerReorder,
  imageUrl,
  imageBlob,
  onProcessedImage,
  layerData,
  onSelectAnnotation,
  onDeleteAnnotation,
  selectedLandmarkType,
  onLandmarkTypeChange
}: RightLayersPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'layers' | 'properties' | 'histogram' | 'colors'>('layers');
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set(['original']));
  const tabsRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleLayerExpand = (layerId: string) => {
    setExpandedLayers(prev => {
      const next = new Set(prev);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsRef.current) {
      const scrollAmount = 100;
      tabsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onLayerReorder) {
      // The list we display is REVERSED from the actual data layers
      // UI: [TopLayer, MiddleLayer, BottomLayer] (Indices 0, 1, 2)
      // Data: [BottomLayer, MiddleLayer, TopLayer] (Indices 0, 1, 2)

      const reversedLayers = [...layers].reverse();
      const oldIndex = reversedLayers.findIndex((l) => l.id === active.id);
      const newIndex = reversedLayers.findIndex((l) => l.id === over.id);

      // Convert back to original indices
      // Original Index = Length - 1 - Reversed Index
      const originalOldIndex = (layers.length - 1) - oldIndex;
      const originalNewIndex = (layers.length - 1) - newIndex;

      onLayerReorder(originalOldIndex, originalNewIndex);
    }
  };

  const reversedLayers = [...layers].reverse();

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed right-0 top-12 bottom-0 w-80 bg-gradient-to-l from-gray-900 via-gray-900/95 to-gray-900/80 backdrop-blur-xl border-l border-gray-800/50 shadow-2xl z-40 flex flex-col"
    >
      {/* Tabs */}
      <div className="flex items-center border-b border-gray-800/50 relative">
        <button
          onClick={() => scrollTabs('left')}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors z-10"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div
          ref={tabsRef}
          className="flex-1 flex overflow-x-auto scrollbar-hide mask-fade-sides"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <button
            onClick={() => setActiveTab('layers')}
            className={`flex-shrink-0 flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors whitespace-nowrap ${
              activeTab === 'layers'
                ? 'bg-blue-500/20 text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
            }`}
          >
            <LayersIcon className="w-4 h-4" />
            <span>{t('advancedEditor.layers') || 'Capas'}</span>
          </button>

          <button
            onClick={() => setActiveTab('properties')}
            className={`flex-shrink-0 flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors whitespace-nowrap ${
              activeTab === 'properties'
                ? 'bg-blue-500/20 text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>{t('advancedEditor.properties') || 'Props'}</span>
          </button>

          <button
            onClick={() => setActiveTab('histogram')}
            className={`flex-shrink-0 flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors whitespace-nowrap ${
              activeTab === 'histogram'
                ? 'bg-blue-500/20 text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>{t('advancedEditor.histogram') || 'Hist'}</span>
          </button>

          <button
            onClick={() => setActiveTab('colors')}
            className={`flex-shrink-0 flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors whitespace-nowrap ${
              activeTab === 'colors'
                ? 'bg-blue-500/20 text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>{t('advancedEditor.colors') || 'Colors'}</span>
          </button>
        </div>

        <button
          onClick={() => scrollTabs('right')}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors z-10"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        <AnimatePresence mode="wait">
          {activeTab === 'layers' && (
            <motion.div
              key="layers"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-3 space-y-2"
            >
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={reversedLayers.map(l => l.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {reversedLayers.map((layer) => (
                    <SortableLayerItem
                      key={layer.id}
                      layer={layer}
                      imageUrl={imageUrl}
                      isExpanded={expandedLayers.has(layer.id)}
                      onToggleExpand={() => toggleLayerExpand(layer.id)}
                      onToggleVisible={() => onLayerToggle(layer.id)}
                      onToggleLock={() => onLayerLockToggle(layer.id)}
                      onOpacityChange={(opacity) => onLayerOpacityChange(layer.id, opacity)}
                      t={t}
                      items={layerData?.[layer.id]}
                      onSelect={onSelectAnnotation}
                      onDelete={onDeleteAnnotation}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </motion.div>
          )}

          {activeTab === 'properties' && (
            <motion.div
              key="properties"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 space-y-4"
            >
              <div className="text-center text-gray-400">
                <Sliders className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Propiedades de {activeTool}</p>
                <p className="text-xs mt-1">Herramienta activa</p>
              </div>

              {/* Landmark Tool Properties */}
              {activeTool === 'landmark' && (
                <div className="space-y-3 pt-4 border-t border-gray-800/50">
                  <label className="text-xs text-gray-400">Tipo de Landmark</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onLandmarkTypeChange?.('optic_disc')}
                      className={`p-2 rounded border text-xs transition-colors ${
                        selectedLandmarkType === 'optic_disc'
                          ? 'bg-red-500/20 text-red-400 border-red-500/50'
                          : 'bg-gray-800/50 text-gray-400 border-gray-700/50 hover:bg-gray-700/50'
                      }`}
                    >
                      Disco Óptico
                    </button>
                    <button
                      onClick={() => onLandmarkTypeChange?.('fovea')}
                      className={`p-2 rounded border text-xs transition-colors ${
                        selectedLandmarkType === 'fovea'
                          ? 'bg-teal-500/20 text-teal-400 border-teal-500/50'
                          : 'bg-gray-800/50 text-gray-400 border-gray-700/50 hover:bg-gray-700/50'
                      }`}
                    >
                      Fóvea
                    </button>
                  </div>
                  
                  <button
                    disabled
                    className="w-full py-2 bg-gray-800/30 text-gray-500 text-xs rounded border border-gray-700/30 cursor-not-allowed"
                  >
                    Precisar (Próximamente)
                  </button>
                </div>
              )}

              {/* Image Processing Properties */}
              {activeTool === 'image-processing' && onProcessedImage && (
                <AdvancedImageProcessing
                  imageBlob={imageBlob || null}
                  onProcessedImage={onProcessedImage}
                />
              )}

              {/* Tool-specific properties would go here */}
              <div className="space-y-3 pt-4 border-t border-gray-800/50">
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">Tamaño de Pincel</label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    defaultValue="5"
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-gray-400">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      defaultValue="#3b82f6"
                      className="w-12 h-12 rounded cursor-pointer"
                    />
                    <span className="text-xs text-gray-300 font-mono">#3b82f6</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'histogram' && (
            <motion.div
              key="histogram"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 space-y-4"
            >
              <div className="text-center text-gray-400">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Histograma RGB</p>
                <p className="text-xs mt-1">Análisis en tiempo real</p>
              </div>

              {/* Placeholder for histogram */}
              <div className="h-48 bg-gray-800/50 rounded-lg border border-gray-700/50 flex items-end justify-around p-4">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 mx-px"
                    style={{
                      height: `${Math.random() * 100}%`,
                      background: 'linear-gradient(to top, #3b82f6, #60a5fa)',
                    }}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                  <p className="text-red-400 font-medium">Red</p>
                  <p className="text-gray-400 mt-1">Avg: 128</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/30 rounded p-2">
                  <p className="text-green-400 font-medium">Green</p>
                  <p className="text-gray-400 mt-1">Avg: 142</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-2">
                  <p className="text-blue-400 font-medium">Blue</p>
                  <p className="text-gray-400 mt-1">Avg: 156</p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'colors' && (
            <motion.div
              key="colors"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 space-y-4"
            >
              <div className="text-center text-gray-400">
                <Palette className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Paleta de Colores</p>
                <p className="text-xs mt-1">Extraída de la imagen</p>
              </div>

              {/* Color palette */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  '#1f2937',
                  '#3b82f6',
                  '#ef4444',
                  '#10b981',
                  '#f59e0b',
                  '#8b5cf6',
                  '#ec4899',
                  '#06b6d4',
                ].map((color, i) => (
                  <button
                    key={i}
                    className="aspect-square rounded-lg border-2 border-gray-700 hover:border-gray-500 transition-colors relative group"
                    style={{ backgroundColor: color }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 border border-gray-700">
                      {color}
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-gray-800/50">
                <p className="text-xs text-gray-400 mb-2">Colores recientes</p>
                <div className="flex gap-2">
                  {['#3b82f6', '#ef4444', '#10b981'].map((color, i) => (
                    <button
                      key={i}
                      className="w-8 h-8 rounded border-2 border-gray-700 hover:border-gray-500 transition-colors"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Stats */}
      <div className="border-t border-gray-800/50 p-3 bg-gray-900/50">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-800/50 rounded p-2">
            <p className="text-gray-400">Capas visibles</p>
            <p className="text-white font-medium mt-1">
              {layers.filter(l => l.visible).length} / {layers.length}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded p-2">
            <p className="text-gray-400">Resolución</p>
            <p className="text-white font-medium mt-1">1920x1080</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
