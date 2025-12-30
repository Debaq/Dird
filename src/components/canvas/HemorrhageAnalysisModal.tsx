/**
 * HemorrhageAnalysisModal
 *
 * Modal that shows detailed hemorrhage analysis
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { HemorrhageAnalysis } from '@/lib/analysis/hemorrhage-detector';

interface HemorrhageAnalysisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysis: HemorrhageAnalysis;
}

export function HemorrhageAnalysisModal({
  open,
  onOpenChange,
  analysis,
}: HemorrhageAnalysisModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Análisis de Hemorragias Retinianas</DialogTitle>
          <DialogDescription>
            Detección de hemorragias en la retina
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Total Count */}
          <div className="bg-coal-50 dark:bg-gray-900 p-3 rounded">
            <div className="text-xs text-smoke-600 dark:text-gray-400 mb-1">Total Detectadas</div>
            <div className="text-2xl font-bold text-coal-800 dark:text-gray-200">
              {analysis.totalCount}
            </div>
          </div>

          {/* Distribution by Quadrant */}
          {analysis.totalCount > 0 && (
            <div>
              <div className="text-sm font-medium text-coal-800 dark:text-gray-200 mb-2">
                Distribución por Cuadrante
              </div>
              <div className="grid grid-cols-2 gap-2">
                <QuadrantInfo label="Superior" count={analysis.byQuadrant.superior} />
                <QuadrantInfo label="Temporal" count={analysis.byQuadrant.temporal} />
                <QuadrantInfo label="Nasal" count={analysis.byQuadrant.nasal} />
                <QuadrantInfo label="Inferior" count={analysis.byQuadrant.inferior} />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuadrantInfo({ label, count }: { label: string; count: number }) {
  return (
    <div className="bg-coal-50 dark:bg-gray-900 p-2 rounded text-xs">
      <div className="text-smoke-600 dark:text-gray-400">{label}</div>
      <div className="text-lg font-bold text-coal-800 dark:text-gray-200">{count}</div>
    </div>
  );
}
