/**
 * CircinateRingsAnalysisSection
 *
 * Collapsible section showing circinate rings analysis with a toggle button
 * to control the visibility of the circinate rings layer
 */

import React, { useState } from 'react';
import { Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CircinatePatternAnalysis } from '@/lib/analysis/macular-edema-detector';
import { CircinateAnalysisContent } from './CircinateAnalysisPanel';

interface CircinateRingsAnalysisSectionProps {
  circinateAnalysis: CircinatePatternAnalysis | null;
  layerVisible: boolean;
  onToggleLayer: () => void;
}

export function CircinateRingsAnalysisSection({
  circinateAnalysis,
  layerVisible,
  onToggleLayer,
}: CircinateRingsAnalysisSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!circinateAnalysis) {
    return null;
  }

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleLayer();
    // Collapse panel when toggling layer visibility on
    if (!layerVisible) {
      setIsExpanded(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-coal-200 dark:border-gray-700 overflow-hidden">
      {/* Header with expand/collapse and eye toggle */}
      <div
        className={cn(
          'flex items-center justify-between p-3 cursor-pointer transition-colors',
          'hover:bg-coal-50 dark:hover:bg-gray-700/50'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-smoke-600 dark:text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-smoke-600 dark:text-gray-400" />
          )}
          <span className="text-sm font-medium text-coal-800 dark:text-gray-100">
            Análisis de Anillos Circinados
          </span>
        </div>

        {/* Eye toggle button */}
        <button
          onClick={handleToggleClick}
          className={cn(
            'p-1.5 rounded-md transition-all hover:bg-coal-100 dark:hover:bg-gray-600',
            layerVisible && 'bg-primary-50 dark:bg-primary-900/20'
          )}
          title={layerVisible ? 'Ocultar anillos circinados' : 'Mostrar anillos circinados'}
        >
          {layerVisible ? (
            <Eye className="w-4 h-4 text-primary-500 dark:text-primary-400" />
          ) : (
            <EyeOff className="w-4 h-4 text-smoke-400 dark:text-gray-500" />
          )}
        </button>
      </div>

      {/* Expandable content */}
      {isExpanded && (
        <div className="p-3 pt-0 border-t border-coal-100 dark:border-gray-700">
          <CircinateAnalysisContent analysis={circinateAnalysis} />
        </div>
      )}
    </div>
  );
}
