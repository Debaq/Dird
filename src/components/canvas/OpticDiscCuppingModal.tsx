/**
 * OpticDiscCuppingModal
 *
 * Modal that shows optic disc cupping analysis
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { OpticDiscCuppingAnalysis } from '@/lib/analysis/optic-disc-cupping-detector';

interface OpticDiscCuppingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysis: OpticDiscCuppingAnalysis;
}

export function OpticDiscCuppingModal({
  open,
  onOpenChange,
  analysis,
}: OpticDiscCuppingModalProps) {
  const hasData = analysis.cupDiscRatioAverage !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Excavación del Disco Óptico</DialogTitle>
          <DialogDescription>
            Análisis de la relación copa/disco
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {!hasData ? (
            <div className="text-sm text-smoke-600 dark:text-gray-400 text-center py-4">
              No se detectaron disco óptico y copa para realizar el análisis.
            </div>
          ) : (
            <>
              {/* Cup/Disc Ratios */}
              <div>
                <div className="text-sm font-medium text-coal-800 dark:text-gray-200 mb-2">
                  Relación Copa/Disco (C/D)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-coal-50 dark:bg-gray-900 p-3 rounded">
                    <div className="text-xs text-smoke-600 dark:text-gray-400 mb-1">Vertical</div>
                    <div className="text-lg font-bold text-coal-800 dark:text-gray-200">
                      {analysis.cupDiscRatioVertical?.toFixed(2) || '—'}
                    </div>
                  </div>
                  <div className="bg-coal-50 dark:bg-gray-900 p-3 rounded">
                    <div className="text-xs text-smoke-600 dark:text-gray-400 mb-1">Horizontal</div>
                    <div className="text-lg font-bold text-coal-800 dark:text-gray-200">
                      {analysis.cupDiscRatioHorizontal?.toFixed(2) || '—'}
                    </div>
                  </div>
                  <div className="bg-coal-50 dark:bg-gray-900 p-3 rounded">
                    <div className="text-xs text-smoke-600 dark:text-gray-400 mb-1">Promedio</div>
                    <div className="text-lg font-bold text-coal-800 dark:text-gray-200">
                      {analysis.cupDiscRatioAverage?.toFixed(2) || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rim Distances */}
              <div>
                <div className="text-sm font-medium text-coal-800 dark:text-gray-200 mb-2">
                  Distancias del Anillo Neuroretiniano (μm)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-coal-50 dark:bg-gray-900 p-2 rounded text-xs">
                    <div className="text-smoke-600 dark:text-gray-400">Superior</div>
                    <div className="text-lg font-bold text-coal-800 dark:text-gray-200">
                      {analysis.rimDistancesMicrometers.superior?.toFixed(0) || '—'}
                    </div>
                  </div>
                  <div className="bg-coal-50 dark:bg-gray-900 p-2 rounded text-xs">
                    <div className="text-smoke-600 dark:text-gray-400">Inferior</div>
                    <div className="text-lg font-bold text-coal-800 dark:text-gray-200">
                      {analysis.rimDistancesMicrometers.inferior?.toFixed(0) || '—'}
                    </div>
                  </div>
                  <div className="bg-coal-50 dark:bg-gray-900 p-2 rounded text-xs">
                    <div className="text-smoke-600 dark:text-gray-400">Nasal</div>
                    <div className="text-lg font-bold text-coal-800 dark:text-gray-200">
                      {analysis.rimDistancesMicrometers.nasal?.toFixed(0) || '—'}
                    </div>
                  </div>
                  <div className="bg-coal-50 dark:bg-gray-900 p-2 rounded text-xs">
                    <div className="text-smoke-600 dark:text-gray-400">Temporal</div>
                    <div className="text-lg font-bold text-coal-800 dark:text-gray-200">
                      {analysis.rimDistancesMicrometers.temporal?.toFixed(0) || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Clinical Context */}
              {analysis.cupDiscRatioAverage !== null && analysis.cupDiscRatioAverage > 0.6 && (
                <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded text-xs text-yellow-700 dark:text-yellow-300">
                  <div className="font-medium mb-1">⚠️ Nota</div>
                  <div>
                    C/D ratio {'>'} 0.6 puede requerir evaluación adicional para glaucoma.
                  </div>
                </div>
              )}

              {/* Important Disclaimer */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 rounded text-xs">
                <div className="font-medium text-blue-800 dark:text-blue-300 mb-1">ℹ️ Información importante</div>
                <div className="text-blue-700 dark:text-blue-400">
                  Las mediciones en micrómetros (μm) asumen que el disco óptico tiene un diámetro estándar de <strong>1500 μm</strong>.
                  El diámetro real puede variar entre individuos, lo que puede afectar la precisión de estas mediciones.
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
