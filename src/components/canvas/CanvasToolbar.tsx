import React from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, RotateCw, Brain, Loader2, Maximize } from 'lucide-react';
import type { HistoryEntry } from '@/types/annotations';

interface CanvasToolbarProps {
  history?: {
    entries: HistoryEntry[];
    index: number;
    onAdd: (entry: HistoryEntry) => void;
    onUndo: () => void;
    onRedo: () => void;
  };
  onReDetect: () => void;
  isProcessing: boolean;
  onResetZoom: () => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  history,
  onReDetect,
  isProcessing,
  onResetZoom,
}) => {
  const { t } = useTranslation();

  return (
    <div className="absolute top-2 left-2 z-10 flex space-x-2">
      <button
        onClick={history?.onUndo}
        disabled={!history || history.index < 0}
        className={`p-2 rounded-lg ${!history || history.index < 0 ? 'bg-gray-200 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-100 shadow'}`}
        title={`${t('canvas.undo')} (Ctrl+Z)`}
      >
        <RotateCcw className="w-4 h-4" />
      </button>
      <button
        onClick={history?.onRedo}
        disabled={!history || history.index >= history.entries.length - 1}
        className={`p-2 rounded-lg ${!history || history.index >= history.entries.length - 1 ? 'bg-gray-200 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-100 shadow'}`}
        title={`${t('canvas.redo')} (Ctrl+Y)`}
      >
        <RotateCw className="w-4 h-4" />
      </button>
      <button
        onClick={onReDetect}
        disabled={isProcessing}
        className={`p-2 rounded-lg ${isProcessing ? 'bg-gray-200 text-gray-400' : 'bg-white text-primary-600 hover:bg-primary-50 shadow'}`}
        title="Re-detectar (IA)"
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Brain className="w-4 h-4" />
        )}
      </button>
      <button
        onClick={onResetZoom}
        className="p-2 rounded-lg bg-white text-gray-700 hover:bg-gray-100 shadow"
        title={t('canvas.resetZoom')}
      >
        <Maximize className="w-4 h-4" />
      </button>
    </div>
  );
};
