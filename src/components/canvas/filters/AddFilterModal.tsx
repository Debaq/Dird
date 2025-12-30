import { Sun, Circle, Palette, Target, Scan, Sparkles, Blend, Grid3x3, Contrast, Wand, FlipVertical2 } from 'lucide-react';
import type { FilterType } from '@/stores/image-processing-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AddFilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectFilter: (filterType: FilterType) => void;
  currentCount: number;
}

const filterCategories = [
  {
    name: 'Básicos',
    filters: [
      { type: 'brightness' as FilterType, label: 'Brillo', icon: Sun, description: 'Ajustar brillo de la imagen' },
      { type: 'contrast' as FilterType, label: 'Contraste', icon: Circle, description: 'Ajustar contraste' },
      { type: 'saturation' as FilterType, label: 'Saturación', icon: Palette, description: 'Ajustar saturación de color' }
    ]
  },
  {
    name: 'Canales',
    filters: [
      { type: 'green_channel' as FilterType, label: 'Canal Verde', icon: Target, description: 'Extraer canal verde (mejor para retina)' },
      { type: 'red_channel' as FilterType, label: 'Canal Rojo', icon: Target, description: 'Extraer canal rojo' },
      { type: 'blue_channel' as FilterType, label: 'Canal Azul', icon: Target, description: 'Extraer canal azul' }
    ]
  },
  {
    name: 'Conversión',
    filters: [
      { type: 'grayscale' as FilterType, label: 'Escala de Grises', icon: Contrast, description: 'Convertir a blanco y negro' },
      { type: 'color_mapping' as FilterType, label: 'Espacio de Color', icon: Palette, description: 'HSV, LAB, YCrCb' },
      { type: 'invert' as FilterType, label: 'Invertir Colores', icon: FlipVertical2, description: 'Negativo de la imagen' }
    ]
  },
  {
    name: 'Realce',
    filters: [
      { type: 'clahe' as FilterType, label: 'CLAHE', icon: Sparkles, description: 'Realce adaptativo de contraste' },
      { type: 'histogram_equalization' as FilterType, label: 'Ecualización de Histograma', icon: Contrast, description: 'Mejorar contraste global' },
      { type: 'sharpening' as FilterType, label: 'Nitidez', icon: Wand, description: 'Afilar bordes de la imagen' }
    ]
  },
  {
    name: 'Detección',
    filters: [
      { type: 'edge_detection' as FilterType, label: 'Detección de Bordes', icon: Scan, description: 'Canny, Sobel, Laplacian' },
      { type: 'threshold' as FilterType, label: 'Umbralización', icon: Contrast, description: 'Binarización de imagen' }
    ]
  },
  {
    name: 'Morfología',
    filters: [
      { type: 'morphology' as FilterType, label: 'Dilatación/Erosión', icon: Grid3x3, description: 'Operaciones morfológicas' },
      { type: 'tophat' as FilterType, label: 'Top-Hat', icon: Grid3x3, description: 'Morfología matemática' }
    ]
  },
  {
    name: 'Filtros',
    filters: [
      { type: 'blur' as FilterType, label: 'Desenfoque', icon: Blend, description: 'Gaussian, Median, Bilateral' },
      { type: 'frangi' as FilterType, label: 'Realce de Vasos', icon: Target, description: 'Frangi vessel enhancement' }
    ]
  }
];

export function AddFilterModal({ open, onOpenChange, onSelectFilter, currentCount }: AddFilterModalProps) {
  const handleSelect = (filterType: FilterType) => {
    if (currentCount >= 10) {
      return;
    }
    onSelectFilter(filterType);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar Filtro</DialogTitle>
          <DialogDescription>
            Selecciona un filtro para agregar al pipeline de procesamiento ({currentCount}/10)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {filterCategories.map((category) => (
            <div key={category.name}>
              <h3 className="text-sm font-semibold text-coal-700 mb-2">{category.name}</h3>
              <div className="grid grid-cols-2 gap-2">
                {category.filters.map((filter) => {
                  const Icon = filter.icon;
                  const isDisabled = currentCount >= 10;

                  return (
                    <button
                      key={filter.type}
                      onClick={() => handleSelect(filter.type)}
                      disabled={isDisabled}
                      className="p-3 rounded-lg border border-coal-200 hover:border-primary-500 hover:bg-primary-50 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-coal-200 disabled:hover:bg-transparent"
                    >
                      <div className="flex items-start gap-2">
                        <Icon className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-coal-800">{filter.label}</div>
                          <div className="text-[10px] text-smoke-600 leading-tight mt-0.5">{filter.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
