import { useState, useEffect } from 'react';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Wand2, Download, RotateCcw, Plus, Loader2 } from 'lucide-react';
import { useImageProcessingStore } from '@/stores/image-processing-store';
import { useImageProcessing } from '@/hooks/useImageProcessing';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AddFilterModal } from './filters/AddFilterModal';
import { FilterItem } from './filters/FilterItem';
import type { FilterType } from '@/stores/image-processing-store';

interface ImageProcessingPanelProps {
  imageBlob: Blob | null;
  onProcessedImage: (canvas: HTMLCanvasElement | null) => void;
  disabled?: boolean;
}

export function ImageProcessingPanel({ imageBlob, onProcessedImage, disabled }: ImageProcessingPanelProps) {
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

  // Pasar imagen procesada al componente padre
  useEffect(() => {
    onProcessedImage(processedCanvas);
  }, [processedCanvas, onProcessedImage]);

  // Mostrar errores
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
      toast.error('No hay imagen procesada para descargar');
      return;
    }

    processedCanvas.toBlob((blob) => {
      if (!blob) {
        toast.error('Error al generar imagen');
        return;
      }

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
    <div className="bg-white rounded-lg border border-coal-200 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-coal-800 text-sm flex items-center gap-2">
          <Wand2 className="w-4 h-4" />
          Procesamiento Avanzado
        </h3>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDownload}
            disabled={!processedCanvas || disabled}
            title="Descargar imagen procesada"
            className="h-7 w-7"
          >
            <Download className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleReset}
            disabled={filters.length === 0 || disabled}
            title="Resetear filtros"
            className="h-7 w-7"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Comparación */}
      <div className="space-y-2 p-2 bg-smoke-50 rounded border border-smoke-200">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-coal-700">Superponer Original</Label>
          <Switch
            checked={showOriginal}
            onCheckedChange={setShowOriginal}
            disabled={disabled || !processedCanvas}
          />
        </div>

        {showOriginal && processedCanvas && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-smoke-600">Opacidad Original</Label>
              <span className="text-xs text-smoke-600">{Math.round(comparisonOpacity * 100)}%</span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[comparisonOpacity]}
              onValueChange={([val]) => setComparisonOpacity(val)}
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {/* Pipeline de Filtros */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-coal-700">
            Filtros ({filters.length}/10)
          </span>
          <Button
            size="sm"
            onClick={() => setAddFilterModalOpen(true)}
            disabled={filters.length >= 10 || disabled}
            className="h-7 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Agregar
          </Button>
        </div>

        {/* Lista de Filtros (Drag and Drop) */}
        {filters.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={filters.map(f => f.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
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
        )}

        {filters.length === 0 && (
          <div className="text-center py-8 text-smoke-400 text-xs">
            No hay filtros aplicados
          </div>
        )}
      </div>

      {/* Indicador de procesamiento */}
      {isProcessing && (
        <div className="flex items-center gap-2 text-xs text-primary-600 p-2 bg-primary-50 rounded border border-primary-100">
          <Loader2 className="w-3 h-3 animate-spin" />
          Procesando imagen...
        </div>
      )}

      {/* Modal de agregar filtro */}
      <AddFilterModal
        open={addFilterModalOpen}
        onOpenChange={setAddFilterModalOpen}
        onSelectFilter={handleAddFilter}
        currentCount={filters.length}
      />
    </div>
  );
}
