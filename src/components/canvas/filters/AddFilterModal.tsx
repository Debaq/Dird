import { Sun, Circle, Palette, Target, Scan, Sparkles, Blend, Grid3x3, Contrast, Wand, FlipVertical2, SunDim } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
    nameKey: 'filters.categories.basic',
    filters: [
      { type: 'brightness' as FilterType, labelKey: 'filters.list.brightness.label', icon: Sun, descKey: 'filters.list.brightness.description' },
      { type: 'contrast' as FilterType, labelKey: 'filters.list.contrast.label', icon: Circle, descKey: 'filters.list.contrast.description' },
      { type: 'saturation' as FilterType, labelKey: 'filters.list.saturation.label', icon: Palette, descKey: 'filters.list.saturation.description' },
      { type: 'gamma' as FilterType, labelKey: 'filters.list.gamma.label', icon: SunDim, descKey: 'filters.list.gamma.description' }
    ]
  },
  {
    nameKey: 'filters.categories.channels',
    filters: [
      { type: 'green_channel' as FilterType, labelKey: 'filters.list.greenChannel.label', icon: Target, descKey: 'filters.list.greenChannel.description' },
      { type: 'red_channel' as FilterType, labelKey: 'filters.list.redChannel.label', icon: Target, descKey: 'filters.list.redChannel.description' },
      { type: 'blue_channel' as FilterType, labelKey: 'filters.list.blueChannel.label', icon: Target, descKey: 'filters.list.blueChannel.description' }
    ]
  },
  {
    nameKey: 'filters.categories.conversion',
    filters: [
      { type: 'grayscale' as FilterType, labelKey: 'filters.list.grayscale.label', icon: Contrast, descKey: 'filters.list.grayscale.description' },
      { type: 'color_mapping' as FilterType, labelKey: 'filters.list.colorMapping.label', icon: Palette, descKey: 'filters.list.colorMapping.description' },
      { type: 'invert' as FilterType, labelKey: 'filters.list.invert.label', icon: FlipVertical2, descKey: 'filters.list.invert.description' }
    ]
  },
  {
    nameKey: 'filters.categories.enhancement',
    filters: [
      { type: 'clahe' as FilterType, labelKey: 'filters.list.clahe.label', icon: Sparkles, descKey: 'filters.list.clahe.description' },
      { type: 'histogram_equalization' as FilterType, labelKey: 'filters.list.histogramEqualization.label', icon: Contrast, descKey: 'filters.list.histogramEqualization.description' },
      { type: 'sharpening' as FilterType, labelKey: 'filters.list.sharpening.label', icon: Wand, descKey: 'filters.list.sharpening.description' }
    ]
  },
  {
    nameKey: 'filters.categories.detection',
    filters: [
      { type: 'edge_detection' as FilterType, labelKey: 'filters.list.edgeDetection.label', icon: Scan, descKey: 'filters.list.edgeDetection.description' },
      { type: 'threshold' as FilterType, labelKey: 'filters.list.threshold.label', icon: Contrast, descKey: 'filters.list.threshold.description' }
    ]
  },
  {
    nameKey: 'filters.categories.morphology',
    filters: [
      { type: 'morphology' as FilterType, labelKey: 'filters.list.morphology.label', icon: Grid3x3, descKey: 'filters.list.morphology.description' },
      { type: 'tophat' as FilterType, labelKey: 'filters.list.tophat.label', icon: Grid3x3, descKey: 'filters.list.tophat.description' }
    ]
  },
  {
    nameKey: 'filters.categories.filters',
    filters: [
      { type: 'blur' as FilterType, labelKey: 'filters.list.blur.label', icon: Blend, descKey: 'filters.list.blur.description' },
      { type: 'frangi' as FilterType, labelKey: 'filters.list.frangi.label', icon: Target, descKey: 'filters.list.frangi.description' }
    ]
  }
];

export function AddFilterModal({ open, onOpenChange, onSelectFilter, currentCount }: AddFilterModalProps) {
  const { t } = useTranslation();
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
          <DialogTitle>{t('filters.modal.title')}</DialogTitle>
          <DialogDescription>
            {t('filters.modal.description', { count: currentCount, max: 10 })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {filterCategories.map((category) => (
            <div key={category.nameKey}>
              <h3 className="text-sm font-semibold text-coal-700 mb-2">{t(category.nameKey)}</h3>
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
                          <div className="text-xs font-medium text-coal-800">{t(filter.labelKey)}</div>
                          <div className="text-[10px] text-smoke-600 leading-tight mt-0.5">{t(filter.descKey)}</div>
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
