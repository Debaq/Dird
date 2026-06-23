/**
 * OpticDiscCuppingModal
 *
 * Modal that shows optic disc cupping analysis
 */

import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const hasData = analysis.cupDiscRatioAverage !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('canvas.opticDiscCupping.title')}</DialogTitle>
          <DialogDescription>
            {t('canvas.opticDiscCupping.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {!hasData ? (
            <div className="text-sm text-smoke-600 dark:text-gray-400 text-center py-4">
              {t('canvas.opticDiscCupping.noData')}
            </div>
          ) : (
            <>
              {/* Cup/Disc Ratios */}
              <div>
                <div className="text-sm font-medium text-coal-800 dark:text-gray-200 mb-2">
                  {t('canvas.opticDiscCupping.cupDiscRatio')}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-coal-50 dark:bg-gray-900 p-3 rounded">
                    <div className="text-xs text-smoke-600 dark:text-gray-400 mb-1">{t('canvas.opticDiscCupping.vertical')}</div>
                    <div className="text-lg font-bold text-coal-800 dark:text-gray-200">
                      {analysis.cupDiscRatioVertical?.toFixed(2) || '—'}
                    </div>
                  </div>
                  <div className="bg-coal-50 dark:bg-gray-900 p-3 rounded">
                    <div className="text-xs text-smoke-600 dark:text-gray-400 mb-1">{t('canvas.opticDiscCupping.horizontal')}</div>
                    <div className="text-lg font-bold text-coal-800 dark:text-gray-200">
                      {analysis.cupDiscRatioHorizontal?.toFixed(2) || '—'}
                    </div>
                  </div>
                  <div className="bg-coal-50 dark:bg-gray-900 p-3 rounded">
                    <div className="text-xs text-smoke-600 dark:text-gray-400 mb-1">{t('canvas.opticDiscCupping.average')}</div>
                    <div className="text-lg font-bold text-coal-800 dark:text-gray-200">
                      {analysis.cupDiscRatioAverage?.toFixed(2) || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rim Distances */}
              <div>
                <div className="text-sm font-medium text-coal-800 dark:text-gray-200 mb-2">
                  {t('canvas.opticDiscCupping.rimDistances')}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-coal-50 dark:bg-gray-900 p-2 rounded text-xs">
                    <div className="text-smoke-600 dark:text-gray-400">{t('canvas.opticDiscCupping.superior')}</div>
                    <div className="text-lg font-bold text-coal-800 dark:text-gray-200">
                      {analysis.rimDistancesMicrometers.superior?.toFixed(0) || '—'}
                    </div>
                  </div>
                  <div className="bg-coal-50 dark:bg-gray-900 p-2 rounded text-xs">
                    <div className="text-smoke-600 dark:text-gray-400">{t('canvas.opticDiscCupping.inferior')}</div>
                    <div className="text-lg font-bold text-coal-800 dark:text-gray-200">
                      {analysis.rimDistancesMicrometers.inferior?.toFixed(0) || '—'}
                    </div>
                  </div>
                  <div className="bg-coal-50 dark:bg-gray-900 p-2 rounded text-xs">
                    <div className="text-smoke-600 dark:text-gray-400">{t('canvas.opticDiscCupping.nasal')}</div>
                    <div className="text-lg font-bold text-coal-800 dark:text-gray-200">
                      {analysis.rimDistancesMicrometers.nasal?.toFixed(0) || '—'}
                    </div>
                  </div>
                  <div className="bg-coal-50 dark:bg-gray-900 p-2 rounded text-xs">
                    <div className="text-smoke-600 dark:text-gray-400">{t('canvas.opticDiscCupping.temporal')}</div>
                    <div className="text-lg font-bold text-coal-800 dark:text-gray-200">
                      {analysis.rimDistancesMicrometers.temporal?.toFixed(0) || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Clinical Context */}
              {analysis.cupDiscRatioAverage !== null && analysis.cupDiscRatioAverage > 0.6 && (
                <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded text-xs text-yellow-700 dark:text-yellow-300">
                  <div className="font-medium mb-1">{t('canvas.opticDiscCupping.noteTitle')}</div>
                  <div>
                    {t('canvas.opticDiscCupping.glaucomaNote')}
                  </div>
                </div>
              )}

              {/* Important Disclaimer */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 rounded text-xs">
                <div className="font-medium text-blue-800 dark:text-blue-300 mb-1">{t('canvas.opticDiscCupping.importantInfoTitle')}</div>
                <div className="text-blue-700 dark:text-blue-400">
                  {t('canvas.opticDiscCupping.disclaimerPart1')} <strong>{t('canvas.opticDiscCupping.standardDiameter')}</strong>{t('canvas.opticDiscCupping.disclaimerPart2')}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
