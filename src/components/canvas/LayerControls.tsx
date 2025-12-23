import React from 'react';
import { Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next'; // Added this line

export interface CanvasLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
  zIndex: number;
}

interface LayerControlsProps {
  layers: CanvasLayer[];
  onLayerUpdate: (layerId: string, updates: Partial<CanvasLayer>) => void;
}

const LayerControls: React.FC<LayerControlsProps> = ({ layers, onLayerUpdate }) => {
  const { t } = useTranslation(); // Added this line

  return (
    <div className="bg-white rounded-lg border border-coal-200 p-4">
      <h3 className="font-semibold text-coal-800 mb-3">{t('canvas.layers.title')}</h3>
      <div className="space-y-2">
        {layers
          .sort((a, b) => b.zIndex - a.zIndex)
          .map((layer) => (
            <div
              key={layer.id}
              className={cn(
                'p-3 rounded-lg border transition-colors',
                layer.visible ? 'border-coal-200 bg-white' : 'border-coal-100 bg-coal-50'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={cn(
                    'text-sm font-medium',
                    layer.visible ? 'text-coal-800' : 'text-smoke-400'
                  )}
                >
                  {layer.name}
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onLayerUpdate(layer.id, { visible: !layer.visible })}
                    className="p-1 hover:bg-coal-100 rounded"
                  >
                    {layer.visible ? (
                      <Eye className="w-4 h-4 text-primary-500" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-smoke-400" />
                    )}
                  </button>
                  <button
                    onClick={() => onLayerUpdate(layer.id, { locked: !layer.locked })}
                    className="p-1 hover:bg-coal-100 rounded"
                    disabled={layer.id === 'original'}
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
                <div className="flex items-center space-x-2">
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
            </div>
          ))}
      </div>
    </div>
  );
};

export default LayerControls;
