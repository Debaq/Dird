/**
 * HemorrhageAnalysisModal
 *
 * Modal that shows detailed hemorrhage analysis
 */

import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('canvas.hemorrhage.title')}</DialogTitle>
          <DialogDescription>
            {t('canvas.hemorrhage.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Total Count */}
          <div className="bg-coal-50 dark:bg-gray-900 p-3 rounded">
            <div className="text-xs text-smoke-600 dark:text-gray-400 mb-1">{t('canvas.hemorrhage.totalDetected')}</div>
            <div className="text-2xl font-bold text-coal-800 dark:text-gray-200">
              {analysis.totalCount}
            </div>
          </div>

          {/* Distribution by Quadrant */}
          {analysis.totalCount > 0 && (
            <div>
              <div className="text-sm font-medium text-coal-800 dark:text-gray-200 mb-2">
                {t('canvas.hemorrhage.distributionByQuadrant')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <QuadrantInfo label={t('canvas.hemorrhage.superior')} count={analysis.byQuadrant.superior} />
                <QuadrantInfo label={t('canvas.hemorrhage.temporal')} count={analysis.byQuadrant.temporal} />
                <QuadrantInfo label={t('canvas.hemorrhage.nasal')} count={analysis.byQuadrant.nasal} />
                <QuadrantInfo label={t('canvas.hemorrhage.inferior')} count={analysis.byQuadrant.inferior} />
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
