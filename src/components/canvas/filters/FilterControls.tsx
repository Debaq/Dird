import type { FilterType, FilterConfig } from '@/stores/image-processing-store';
import { Slider } from '@/components/ui/slider';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';

interface FilterControlsProps {
  filterType: FilterType;
  config: FilterConfig;
  onChange: (config: FilterConfig) => void;
}

export function FilterControls({ filterType, config, onChange }: FilterControlsProps) {
  const { t } = useTranslation();
  const renderControls = () => {
    switch (filterType) {
      case 'brightness':
        return (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">{t('filters.controls.brightness')}</Label>
              <span className="text-xs text-smoke-600">{config.value || 0}</span>
            </div>
            <Slider
              min={-100}
              max={100}
              step={1}
              value={[config.value || 0]}
              onValueChange={([value]) => onChange({ value })}
            />
          </div>
        );

      case 'contrast':
        return (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">{t('filters.controls.contrast')}</Label>
              <span className="text-xs text-smoke-600">{(config.value || 1.0).toFixed(2)}</span>
            </div>
            <Slider
              min={0.5}
              max={3.0}
              step={0.1}
              value={[config.value || 1.0]}
              onValueChange={([value]) => onChange({ value })}
            />
          </div>
        );

      case 'saturation':
        return (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">{t('filters.controls.saturation')}</Label>
              <span className="text-xs text-smoke-600">{(config.value || 1.0).toFixed(2)}</span>
            </div>
            <Slider
              min={0}
              max={2.0}
              step={0.1}
              value={[config.value || 1.0]}
              onValueChange={([value]) => onChange({ value })}
            />
          </div>
        );

      case 'gamma':
        return (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">{t('filters.controls.gamma')}</Label>
              <span className="text-xs text-smoke-600">{(config.value || 1.2).toFixed(2)}</span>
            </div>
            <Slider
              min={0.3}
              max={3.0}
              step={0.05}
              value={[config.value || 1.2]}
              onValueChange={([value]) => onChange({ value })}
            />
            <p className="text-[10px] text-smoke-500">{t('filters.controls.gammaHint')}</p>
          </div>
        );

      case 'green_channel':
      case 'red_channel':
      case 'blue_channel':
      case 'grayscale':
      case 'histogram_equalization':
      case 'invert':
        return (
          <div className="text-xs text-smoke-600 italic">
            {t('filters.controls.noParams')}
          </div>
        );

      case 'clahe':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">{t('filters.controls.channel')}</Label>
              <Select
                value={config.channel || 'luminance'}
                onValueChange={(value) => onChange({ ...config, channel: value as any })}
                options={[
                  { value: 'luminance', label: t('filters.controls.channelLuminance') },
                  { value: 'green', label: t('filters.controls.channelGreen') },
                  { value: 'red', label: t('filters.controls.channelRed') },
                  { value: 'blue', label: t('filters.controls.channelBlue') }
                ]}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs">{t('filters.controls.clipLimit')}</Label>
                <span className="text-xs text-smoke-600">{(config.clipLimit || 2.0).toFixed(1)}</span>
              </div>
              <Slider
                min={1.0}
                max={10.0}
                step={0.5}
                value={[config.clipLimit || 2.0]}
                onValueChange={([value]) => onChange({ ...config, clipLimit: value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs">{t('filters.controls.tileGridSize')}</Label>
                <span className="text-xs text-smoke-600">{config.tileGridSize || 8}</span>
              </div>
              <Slider
                min={4}
                max={16}
                step={2}
                value={[config.tileGridSize || 8]}
                onValueChange={([value]) => onChange({ ...config, tileGridSize: value })}
              />
            </div>
          </div>
        );

      case 'threshold':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">{t('filters.controls.type')}</Label>
              <Select
                value={config.type || 'binary'}
                onValueChange={(value) => onChange({ ...config, type: value as any })}
                options={[
                  { value: 'binary', label: t('filters.controls.thresholdBinary') },
                  { value: 'binary_inv', label: t('filters.controls.thresholdBinaryInv') },
                  { value: 'trunc', label: t('filters.controls.thresholdTrunc') },
                  { value: 'tozero', label: t('filters.controls.thresholdToZero') },
                  { value: 'tozero_inv', label: t('filters.controls.thresholdToZeroInv') },
                  { value: 'otsu', label: t('filters.controls.thresholdOtsu') }
                ]}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs">{t('filters.controls.value')}</Label>
                <span className="text-xs text-smoke-600">{config.threshold || 127}</span>
              </div>
              <Slider
                min={0}
                max={255}
                step={1}
                value={[config.threshold || 127]}
                onValueChange={([value]) => onChange({ ...config, threshold: value })}
              />
            </div>
          </div>
        );

      case 'edge_detection':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">{t('filters.controls.method')}</Label>
              <Select
                value={config.method || 'canny'}
                onValueChange={(value) => onChange({ ...config, method: value as any })}
                options={[
                  { value: 'canny', label: 'Canny' },
                  { value: 'sobel', label: 'Sobel' },
                  { value: 'laplacian', label: 'Laplacian' }
                ]}
                className="h-8 text-xs"
              />
            </div>
            {config.method === 'canny' && (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">{t('filters.controls.threshold1')}</Label>
                    <span className="text-xs text-smoke-600">{config.threshold1 || 50}</span>
                  </div>
                  <Slider
                    min={0}
                    max={300}
                    step={5}
                    value={[config.threshold1 || 50]}
                    onValueChange={([value]) => onChange({ ...config, threshold1: value })}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">{t('filters.controls.threshold2')}</Label>
                    <span className="text-xs text-smoke-600">{config.threshold2 || 150}</span>
                  </div>
                  <Slider
                    min={0}
                    max={300}
                    step={5}
                    value={[config.threshold2 || 150]}
                    onValueChange={([value]) => onChange({ ...config, threshold2: value })}
                  />
                </div>
              </>
            )}
          </div>
        );

      case 'sharpening':
        return (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">{t('filters.controls.intensity')}</Label>
              <span className="text-xs text-smoke-600">{(config.value || 1.0).toFixed(1)}</span>
            </div>
            <Slider
              min={0}
              max={2.0}
              step={0.1}
              value={[config.value || 1.0]}
              onValueChange={([value]) => onChange({ value })}
            />
          </div>
        );

      case 'blur':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">{t('filters.controls.type')}</Label>
              <Select
                value={config.blurType || 'gaussian'}
                onValueChange={(value) => onChange({ ...config, blurType: value as any })}
                options={[
                  { value: 'gaussian', label: 'Gaussian' },
                  { value: 'median', label: 'Median' },
                  { value: 'bilateral', label: 'Bilateral' }
                ]}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs">{t('filters.controls.kernelSize')}</Label>
                <span className="text-xs text-smoke-600">{config.kernelSize || 5}</span>
              </div>
              <Slider
                min={3}
                max={11}
                step={2}
                value={[config.kernelSize || 5]}
                onValueChange={([value]) => onChange({ ...config, kernelSize: value })}
              />
            </div>
          </div>
        );

      case 'morphology':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">{t('filters.controls.type')}</Label>
              <Select
                value={config.morphType || 'dilate'}
                onValueChange={(value) => onChange({ ...config, morphType: value as any })}
                options={[
                  { value: 'dilate', label: t('filters.controls.morphDilate') },
                  { value: 'erode', label: t('filters.controls.morphErode') }
                ]}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs">{t('filters.controls.kernelSize')}</Label>
                <span className="text-xs text-smoke-600">{config.kernelSize || 3}</span>
              </div>
              <Slider
                min={3}
                max={7}
                step={2}
                value={[config.kernelSize || 3]}
                onValueChange={([value]) => onChange({ ...config, kernelSize: value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs">{t('filters.controls.iterations')}</Label>
                <span className="text-xs text-smoke-600">{config.iterations || 1}</span>
              </div>
              <Slider
                min={1}
                max={5}
                step={1}
                value={[config.iterations || 1]}
                onValueChange={([value]) => onChange({ ...config, iterations: value })}
              />
            </div>
          </div>
        );

      case 'tophat':
        return (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">{t('filters.controls.kernelSize')}</Label>
              <span className="text-xs text-smoke-600">{config.kernelSize || 9}</span>
            </div>
            <Slider
              min={3}
              max={15}
              step={2}
              value={[config.kernelSize || 9]}
              onValueChange={([value]) => onChange({ kernelSize: value })}
            />
          </div>
        );

      case 'color_mapping':
        return (
          <div className="space-y-2">
            <Label className="text-xs">{t('filters.controls.colorSpace')}</Label>
            <Select
              value={config.colorSpace || 'hsv'}
              onValueChange={(value) => onChange({ colorSpace: value as any })}
              options={[
                { value: 'hsv', label: 'HSV' },
                { value: 'lab', label: 'LAB' },
                { value: 'ycrcb', label: 'YCrCb' }
              ]}
              className="h-8 text-xs"
            />
          </div>
        );

      case 'frangi':
        return (
          <div className="text-xs text-smoke-600 italic">
            {t('filters.controls.frangiInfo')}
          </div>
        );

      default:
        return null;
    }
  };

  return <div className="space-y-2">{renderControls()}</div>;
}
