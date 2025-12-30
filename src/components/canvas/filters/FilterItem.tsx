import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImageFilter, FilterConfig } from '@/stores/image-processing-store';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { FilterControls } from './FilterControls';

interface FilterItemProps {
  filter: ImageFilter;
  index: number;
  onUpdate: (id: string, config: FilterConfig) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
}

const getFilterDisplayName = (type: string): string => {
  const names: Record<string, string> = {
    brightness: 'Brillo',
    contrast: 'Contraste',
    saturation: 'Saturación',
    green_channel: 'Canal Verde',
    red_channel: 'Canal Rojo',
    blue_channel: 'Canal Azul',
    grayscale: 'Escala de Grises',
    clahe: 'CLAHE',
    threshold: 'Umbralización',
    edge_detection: 'Detección de Bordes',
    sharpening: 'Nitidez',
    blur: 'Desenfoque',
    morphology: 'Dilatación/Erosión',
    histogram_equalization: 'Ecualización de Histograma',
    invert: 'Invertir Colores',
    frangi: 'Realce de Vasos',
    tophat: 'Top-Hat',
    color_mapping: 'Espacio de Color'
  };
  return names[type] || type;
};

export function FilterItem({
  filter,
  index,
  onUpdate,
  onToggle,
  onDelete,
  isExpanded,
  onToggleExpand
}: FilterItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: filter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border rounded-lg bg-white transition-shadow',
        isDragging ? 'shadow-lg opacity-50' : 'shadow-sm',
        !filter.enabled && 'opacity-60'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-2 bg-smoke-50 rounded-t-lg border-b">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-4 h-4 text-smoke-400" />
        </div>

        <button
          onClick={() => onToggleExpand(filter.id)}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          <ChevronDown
            className={cn(
              'w-3 h-3 transition-transform flex-shrink-0',
              !isExpanded && '-rotate-90'
            )}
          />
          <span className="text-xs font-medium text-coal-800 truncate">
            {index + 1}. {getFilterDisplayName(filter.type)}
          </span>
        </button>

        <Switch
          checked={filter.enabled}
          onCheckedChange={() => onToggle(filter.id)}
          className="scale-75"
        />

        <Button
          size="icon"
          variant="ghost"
          onClick={() => onDelete(filter.id)}
          className="h-6 w-6 flex-shrink-0"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>

      {/* Controles (Collapsible) */}
      <Collapsible open={isExpanded}>
        <CollapsibleContent>
          <div className="p-3">
            <FilterControls
              filterType={filter.type}
              config={filter.config}
              onChange={(newConfig) => onUpdate(filter.id, newConfig)}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
