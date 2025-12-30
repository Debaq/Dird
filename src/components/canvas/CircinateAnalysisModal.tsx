/**
 * CircinateAnalysisModal
 *
 * Modal that shows detailed circinate ring analysis
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CircinatePatternAnalysis, MacularEdemaResult } from '@/lib/analysis/macular-edema-detector';
import { CircinateAnalysisContent } from './CircinateAnalysisPanel';

interface CircinateAnalysisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysis: CircinatePatternAnalysis;
  macularEdemaResult?: MacularEdemaResult | null;
}

export function CircinateAnalysisModal({
  open,
  onOpenChange,
  analysis,
  macularEdemaResult,
}: CircinateAnalysisModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Análisis de Anillos Circinados</DialogTitle>
          <DialogDescription>
            Detección de patrones de exudados duros formando anillos alrededor de la fóvea
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <CircinateAnalysisContent analysis={analysis} />
        </div>

        {macularEdemaResult && (
          <div className="mt-4 pt-4 border-t border-coal-200 dark:border-gray-700">
            <div className="text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-smoke-600 dark:text-gray-400">Método:</span>
                <span className="font-medium text-coal-800 dark:text-gray-200">
                  {macularEdemaResult.method.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-smoke-600 dark:text-gray-400">Exudados en zona macular:</span>
                <span className="font-medium text-coal-800 dark:text-gray-200">
                  {macularEdemaResult.exudatesInZone.length}
                </span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
