import React from 'react';
import { Square, Eraser, Move, ZoomIn, MousePointer2, Ruler, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { LandmarkType } from '@/types/annotations';

export type CanvasTool = 'select' | 'bbox' | 'circle' | 'eraser' | 'pan' | 'zoom' | 'ruler' | 'landmark';

interface ToolPanelProps {
  activeTool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  disabled?: boolean;
  selectedLandmarkType?: LandmarkType;
  onLandmarkTypeChange?: (type: LandmarkType) => void;
}

const ToolPanel: React.FC<ToolPanelProps> = ({
  activeTool,
  onToolChange,
  disabled,
  selectedLandmarkType = 'optic_disc',
  onLandmarkTypeChange
}) => {
  const { t } = useTranslation();

  const tools = [
    { id: 'select' as CanvasTool, icon: MousePointer2, label: t('canvas.tools.select') },
    { id: 'bbox' as CanvasTool, icon: Square, label: t('canvas.tools.bbox') },
    { id: 'landmark' as CanvasTool, icon: Target, label: t('canvas.tools.landmark') || 'Landmarks' },
    { id: 'ruler' as CanvasTool, icon: Ruler, label: t('canvas.tools.ruler') },
    { id: 'eraser' as CanvasTool, icon: Eraser, label: t('canvas.tools.eraser') },
    { id: 'pan' as CanvasTool, icon: Move, label: t('canvas.tools.pan') },
    { id: 'zoom' as CanvasTool, icon: ZoomIn, label: t('canvas.tools.zoom') },
  ];

  return (
    <div className="bg-white rounded-lg border border-coal-200 p-1.5">
      <h3 className="font-semibold text-coal-800 mb-1.5 text-[10px] uppercase tracking-wider opacity-60 px-1">{t('canvas.tools.title')}</h3>
      <div className="flex flex-wrap gap-1">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;

          return (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              disabled={disabled}
              title={tool.label}
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-md border transition-all',
                isActive
                  ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm'
                  : 'border-coal-100 hover:border-coal-300 text-smoke-600 bg-white',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      {activeTool === 'select' && (
        <div className="mt-2 p-2 bg-primary-50 rounded border border-primary-100">
          <p className="text-[10px] leading-tight text-primary-800">
            {t('canvas.tools.selectInstruction')}
          </p>
        </div>
      )}

      {activeTool === 'bbox' && (
        <div className="mt-2 p-2 bg-primary-50 rounded border border-primary-100">
          <p className="text-[10px] leading-tight text-primary-800">
            {t('canvas.tools.bboxInstruction')}
          </p>
        </div>
      )}

      {activeTool === 'eraser' && (
        <div className="mt-2 p-2 bg-red-50 rounded border border-red-100">
          <p className="text-[10px] leading-tight text-red-800">
            {t('canvas.tools.eraserInstruction')}
          </p>
        </div>
      )}

      {activeTool === 'pan' && (
        <div className="mt-2 p-2 bg-primary-50 rounded border border-primary-100">
          <p className="text-[10px] leading-tight text-primary-800">
            {t('canvas.tools.panInstruction')}
          </p>
        </div>
      )}

      {activeTool === 'zoom' && (
        <div className="mt-2 p-2 bg-primary-50 rounded border border-primary-100">
          <p className="text-[10px] leading-tight text-primary-800">
            {t('canvas.tools.zoomInstruction')}
          </p>
        </div>
      )}

      {activeTool === 'ruler' && (
        <div className="mt-4 p-3 bg-primary-50 rounded-lg">
          <p className="text-xs text-primary-800">
            {t('canvas.tools.rulerInstruction')}
          </p>
        </div>
      )}

      {activeTool === 'landmark' && onLandmarkTypeChange && (
        <div className="mt-4 space-y-3">
          <div className="p-3 bg-primary-50 rounded-lg">
            <p className="text-xs text-primary-800">
              {t('canvas.tools.landmarkInstruction') || 'Click to place anatomical landmarks (optic disc or fovea). Drag to reposition.'}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-coal-700 mb-2 block">
              Select Landmark Type:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onLandmarkTypeChange('optic_disc')}
                className={cn(
                  'p-2 rounded-lg border-2 text-xs font-medium transition-colors',
                  selectedLandmarkType === 'optic_disc'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-coal-200 hover:border-coal-300 text-smoke-600'
                )}
              >
                <div className="flex items-center justify-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  Optic Disc
                </div>
              </button>
              <button
                onClick={() => onLandmarkTypeChange('fovea')}
                className={cn(
                  'p-2 rounded-lg border-2 text-xs font-medium transition-colors',
                  selectedLandmarkType === 'fovea'
                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                    : 'border-coal-200 hover:border-coal-300 text-smoke-600'
                )}
              >
                <div className="flex items-center justify-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-teal-500" />
                  Fovea
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolPanel;
