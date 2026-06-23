/**
 * MicroaneurysmAnalysisModal
 *
 * Modal that shows detailed microaneurysm analysis
 */

import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  // Distribution labels
  const distributionLabels = {
    scattered: t('canvas.microaneurysm.scattered'),
    clustered: t('canvas.microaneurysm.clustered'),
    diffuse: t('canvas.microaneurysm.diffuse')
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('canvas.microaneurysm.title')}</DialogTitle>
          <DialogDescription>
            {t('canvas.microaneurysm.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Count and Distribution */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-coal-50 dark:bg-gray-900 p-3 rounded">
              <div className="text-xs text-smoke-600 dark:text-gray-400 mb-1">{t('canvas.microaneurysm.totalDetected')}</div>
              <div className="text-2xl font-bold text-coal-800 dark:text-gray-200">
                {analysis.totalCount}
              </div>
            </div>
            <div className="bg-coal-50 dark:bg-gray-900 p-3 rounded">
              <div className="text-xs text-smoke-600 dark:text-gray-400 mb-1">{t('canvas.microaneurysm.distributionPattern')}</div>
              <div className="text-sm font-semibold text-coal-800 dark:text-gray-200">
                {distributionLabels[analysis.distribution]}
              </div>
            </div>
          </div>

          {/* Clinical Context */}
          {analysis.totalCount > 0 && (
            <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded text-xs text-blue-700 dark:text-blue-300">
              <div className="font-medium mb-1">{t('canvas.microaneurysm.infoTitle')}</div>
              <div>
                {t('canvas.microaneurysm.infoText')}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
