/**
 * AnalysisPanel
 *
 * Universal analysis panel that can show different types of analysis
 * Always visible to maintain consistent layout
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import type { CircinatePatternAnalysis, MacularEdemaResult } from '@/lib/analysis/macular-edema-detector';
import { CircinateAnalysisContent } from './CircinateAnalysisPanel';

interface AnalysisPanelProps {
  // Circinate pattern analysis
  circinateAnalysis?: CircinatePatternAnalysis | null;
  circinateVisible?: boolean;

  // Macular edema detection
  macularEdemaResult?: MacularEdemaResult | null;

  // Future analysis types can be added here:
  // quadrantAnalysis?: QuadrantAnalysis;
  // vesselAnalysis?: VesselDensityAnalysis;
  // drusenAnalysis?: DrusenAnalysis;
}

export function AnalysisPanel({
  circinateAnalysis,
  circinateVisible = true,
  macularEdemaResult,
}: AnalysisPanelProps) {
  const { t } = useTranslation();

  // Debug logging
  React.useEffect(() => {
    console.log('📊 AnalysisPanel - circinateAnalysis:', circinateAnalysis);
    console.log('📊 AnalysisPanel - circinateVisible:', circinateVisible);
    console.log('📊 AnalysisPanel - macularEdemaResult:', macularEdemaResult);
  }, [circinateAnalysis, circinateVisible, macularEdemaResult]);

  // Determine what to show
  const hasCircinateAnalysis = circinateAnalysis && circinateVisible;
  const hasMacularEdemaDetection = macularEdemaResult?.detected;
  const hasAnyAnalysis = hasCircinateAnalysis || hasMacularEdemaDetection;

  return (
    <Card className="bg-white dark:bg-gray-800 border-coal-200 dark:border-gray-700">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm font-semibold text-coal-800 dark:text-gray-100 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          {t('analysis.panel.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {/* Macular edema detection alert */}
        {hasMacularEdemaDetection && (
          <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              ⚠️ {macularEdemaResult.exudatesInZone.length} exudados cerca de fóvea. Verificar edema y anillos circinados.
            </p>
          </div>
        )}

        {/* Circinate analysis */}
        {hasCircinateAnalysis && (
          <CircinateAnalysisContent analysis={circinateAnalysis} />
        )}

        {/* Empty state - only show if no analysis is available */}
        {!hasAnyAnalysis && <EmptyAnalysisState />}

        {/* Future analysis types can be added here with conditional rendering */}
        {/* {hasQuadrantAnalysis && <QuadrantAnalysisContent />} */}
      </CardContent>
    </Card>
  );
}

/**
 * Empty state when no analysis is available
 */
function EmptyAnalysisState() {
  const { t } = useTranslation();

  return (
    <div className="text-center py-4 text-smoke-500 dark:text-gray-400">
      <p className="text-xs">
        {t('analysis.panel.noAnalysisAvailable')}
      </p>
      <p className="text-[10px] mt-1 text-smoke-400 dark:text-gray-500">
        {t('analysis.panel.hint')}
      </p>
    </div>
  );
}
