/**
 * MicroaneurysmAnalysisModal
 *
 * Modal that shows detailed microaneurysm analysis
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { MicroaneurysmAnalysis } from '@/lib/analysis/microaneurysm-detector';

interface MicroaneurysmAnalysisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysis: MicroaneurysmAnalysis;
}

export function MicroaneurysmAnalysisModal({
  open,
  onOpenChange,
  analysis,
}: MicroaneurysmAnalysisModalProps) {
  // Distribution labels
  const distributionLabels = {
    scattered: 'Dispersos',
    clustered: 'Agrupados',
    diffuse: 'Difusos'
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Análisis de Microaneurismas</DialogTitle>
          <DialogDescription>
            Detección de microaneurismas retinianos
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Count and Distribution */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-coal-50 dark:bg-gray-900 p-3 rounded">
              <div className="text-xs text-smoke-600 dark:text-gray-400 mb-1">Total Detectados</div>
              <div className="text-2xl font-bold text-coal-800 dark:text-gray-200">
                {analysis.totalCount}
              </div>
            </div>
            <div className="bg-coal-50 dark:bg-gray-900 p-3 rounded">
              <div className="text-xs text-smoke-600 dark:text-gray-400 mb-1">Patrón de Distribución</div>
              <div className="text-sm font-semibold text-coal-800 dark:text-gray-200">
                {distributionLabels[analysis.distribution]}
              </div>
            </div>
          </div>

          {/* Clinical Context */}
          {analysis.totalCount > 0 && (
            <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded text-xs text-blue-700 dark:text-blue-300">
              <div className="font-medium mb-1">ℹ️ Información</div>
              <div>
                Los microaneurismas son uno de los primeros signos de retinopatía diabética.
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
