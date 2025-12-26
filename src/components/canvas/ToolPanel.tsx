import React from 'react';
import { Square, Circle, Eraser, Move, ZoomIn, Hand, Ruler } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export type CanvasTool = 'select' | 'bbox' | 'circle' | 'eraser' | 'pan' | 'zoom' | 'ruler';

interface ToolPanelProps {
  activeTool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  disabled?: boolean;
}

const ToolPanel: React.FC<ToolPanelProps> = ({ activeTool, onToolChange, disabled }) => {
  const { t } = useTranslation();

  const tools = [
    { id: 'select' as CanvasTool, icon: Hand, label: t('canvas.tools.select') },
    { id: 'bbox' as CanvasTool, icon: Square, label: t('canvas.tools.bbox') },
    { id: 'circle' as CanvasTool, icon: Circle, label: t('canvas.tools.circle') },
    { id: 'ruler' as CanvasTool, icon: Ruler, label: t('canvas.tools.ruler') },
    { id: 'eraser' as CanvasTool, icon: Eraser, label: t('canvas.tools.eraser') },
    { id: 'pan' as CanvasTool, icon: Move, label: t('canvas.tools.pan') },
    { id: 'zoom' as CanvasTool, icon: ZoomIn, label: t('canvas.tools.zoom') },
  ];

  return (
    <div className="bg-white rounded-lg border border-coal-200 p-4">
      <h3 className="font-semibold text-coal-800 mb-3">{t('canvas.tools.title')}</h3>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-2 gap-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;

          return (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              disabled={disabled}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors',
                isActive
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-coal-200 hover:border-coal-300 text-smoke-600',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">{tool.label}</span>
            </button>
          );
        })}
      </div>

      {activeTool === 'bbox' && (
        <div className="mt-4 p-3 bg-primary-50 rounded-lg">
          <p className="text-xs text-primary-800">
            {t('canvas.tools.bboxInstruction')}
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
    </div>
  );
};

export default ToolPanel;
