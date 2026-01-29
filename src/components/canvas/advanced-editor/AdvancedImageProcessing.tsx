import { useState, useEffect } from 'react';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Download, RotateCcw, Plus, Loader2 } from 'lucide-react';
import { useImageProcessingStore } from '@/stores/image-processing-store';
import { useImageProcessing } from '@/hooks/useImageProcessing';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AddFilterModal } from '../filters/AddFilterModal';
import { FilterItem } from '../filters/FilterItem';
import type { FilterType } from '@/stores/image-processing-store';

interface AdvancedImageProcessingProps {
  imageBlob: Blob | null;
  onProcessedImage: (canvas: HTMLCanvasElement | null) => void;
}

export function AdvancedImageProcessing({ imageBlob, onProcessedImage }: AdvancedImageProcessingProps) {
  const {
    filters,
    showOriginal,
    comparisonOpacity,
    addFilter,
    updateFilter,
    toggleFilter,
    deleteFilter,
    reorderFilters,
    resetFilters,
    setShowOriginal,
    setComparisonOpacity
  } = useImageProcessingStore();

  const { processedCanvas, isProcessing, error } = useImageProcessing(imageBlob);
  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);
  const [expandedFilters, setExpandedFilters] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  useEffect(() => {
    onProcessedImage(processedCanvas);
  }, [processedCanvas, onProcessedImage]);

  useEffect(() => {
    if (error) {
      toast.error('Error al procesar imagen', {
        description: error
      });
    }
  }, [error]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filters.findIndex(f => f.id === active.id);
    const newIndex = filters.findIndex(f => f.id === over.id);
    const reordered = arrayMove(filters, oldIndex, newIndex);
    reorderFilters(reordered);
  };

  const handleAddFilter = (type: FilterType) => {
    addFilter(type);
    toast.success('Filtro agregado');
  };

  const handleToggleExpand = (id: string) => {
    setExpandedFilters(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDownload = () => {
    if (!processedCanvas) {
      toast.error('No hay imagen procesada');
      return;
    }
    processedCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `imagen-procesada-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Imagen descargada');
    }, 'image/png');
  };

  const handleReset = () => {
    resetFilters();
    setExpandedFilters(new Set());
    toast.success('Filtros reseteados');
  };

  return (
    <div className="space-y-4 pt-4 border-t border-gray-800/50">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-gray-400 flex items-center gap-2">
          Pipeline de Procesamiento
        </h3>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDownload}
            disabled={!processedCanvas}
            title="Descargar"
            className="h-6 w-6 text-gray-400 hover:text-white"
          >
            <Download className="w-3 h-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleReset}
            disabled={filters.length === 0}
            title="Resetear"
            className="h-6 w-6 text-gray-400 hover:text-white"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Comparison Controls */}
      <div className="space-y-3 p-3 bg-gray-800/30 rounded border border-gray-700/30">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-gray-300">Comparar Original</Label>
          <Switch
            checked={showOriginal}
            onCheckedChange={setShowOriginal}
            disabled={!processedCanvas}
            className="data-[state=checked]:bg-blue-600"
          />
        </div>

        {showOriginal && processedCanvas && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-gray-500">Opacidad Original</Label>
              <span className="text-[10px] text-gray-400 font-mono">{Math.round(comparisonOpacity * 100)}%</span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[comparisonOpacity]}
              onValueChange={([val]) => setComparisonOpacity(val)}
              className="[&>.relative>.absolute]:bg-blue-600"
            />
          </div>
        )}
      </div>

      {/* Filters List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Filtros ({filters.length}/10)
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddFilterModalOpen(true)}
            disabled={filters.length >= 10}
            className="h-6 text-xs border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <Plus className="w-3 h-3 mr-1" />
            Agregar
          </Button>
        </div>

        {filters.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={filters.map(f => f.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                {filters.map((filter, index) => (
                  <FilterItem
                    key={filter.id}
                    filter={filter}
                    index={index}
                    onUpdate={updateFilter}
                    onToggle={toggleFilter}
                    onDelete={deleteFilter}
                    isExpanded={expandedFilters.has(filter.id)}
                    onToggleExpand={handleToggleExpand}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="text-center py-6 text-gray-600 text-xs border-2 border-dashed border-gray-800 rounded">
            Sin filtros activos
          </div>
        )}
      </div>

      {isProcessing && (
        <div className="flex items-center gap-2 text-xs text-blue-400 p-2 bg-blue-500/10 rounded border border-blue-500/20">
          <Loader2 className="w-3 h-3 animate-spin" />
          Procesando...
        </div>
      )}

      <AddFilterModal
        open={addFilterModalOpen}
        onOpenChange={setAddFilterModalOpen}
        onSelectFilter={handleAddFilter}
        currentCount={filters.length}
      />
    </div>
  );
}
