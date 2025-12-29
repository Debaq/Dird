/**
 * CircinateAnalysisPanel
 *
 * Displays detailed metrics about circinate pattern detection
 * Content component used by AnalysisPanel
 */

import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import type { CircinatePatternAnalysis } from '@/lib/analysis/macular-edema-detector';

interface CircinateAnalysisContentProps {
  analysis: CircinatePatternAnalysis;
}

/**
 * Content component for circinate pattern analysis
 * Used inside AnalysisPanel
 */
export function CircinateAnalysisContent({ analysis }: CircinateAnalysisContentProps) {
  const { t } = useTranslation();

  // Determine pattern status
  const patternStatus = analysis.isCompleteRing
    ? { label: t('analysis.circinate.completeRing'), icon: CheckCircle2, color: 'text-green-600 dark:text-green-400' }
    : analysis.isPartialRing
    ? { label: t('analysis.circinate.partialRing'), icon: AlertCircle, color: 'text-yellow-600 dark:text-yellow-400' }
    : { label: t('analysis.circinate.noRing'), icon: Circle, color: 'text-blue-500 dark:text-blue-400' };

  const StatusIcon = patternStatus.icon;

  return (
    <div className="space-y-2">
      {/* Pattern Status */}
      <div className="flex items-center gap-2 pb-2 border-b border-coal-100 dark:border-gray-700">
        <StatusIcon className={`w-4 h-4 ${patternStatus.color}`} />
        <span className={`text-xs font-medium ${patternStatus.color}`}>
          {patternStatus.label}
        </span>
      </div>

      {/* Overall Score */}
      <MetricRow
        label={t('analysis.circinate.overallScore')}
        value={`${(analysis.overallScore * 100).toFixed(0)}%`}
        percentage={analysis.overallScore}
      />

      {/* Individual Metrics */}
      <div className="space-y-1 pt-1">
        <MetricBar
          label={t('analysis.circinate.angularDispersion')}
          value={analysis.angularDispersion}
          color="bg-blue-500"
        />
        <MetricBar
          label={t('analysis.circinate.radialConcentration')}
          value={analysis.radialConcentration}
          color="bg-purple-500"
        />
        <MetricBar
          label={t('analysis.circinate.completeness')}
          value={analysis.completeness}
          color="bg-green-500"
        />
        <MetricBar
          label={t('analysis.circinate.circleFit')}
          value={analysis.circleFitQuality}
          color="bg-orange-500"
        />
      </div>

      {/* Additional Info */}
      {analysis.maxAngularGapDegrees > 0 && (
        <div className="text-xs text-smoke-600 dark:text-gray-400 pt-1 border-t border-coal-100 dark:border-gray-700">
          {t('analysis.circinate.maxGap')}: <span className="font-medium">{analysis.maxAngularGapDegrees.toFixed(0)}°</span>
        </div>
      )}

      {analysis.fittedCircle && (
        <div className="text-xs text-smoke-600 dark:text-gray-400">
          {t('analysis.circinate.fittedRadius')}: <span className="font-medium">{analysis.fittedCircle.radiusMicrons.toFixed(0)} µm</span>
        </div>
      )}

      {analysis.radialStats && (
        <div className="text-xs text-smoke-600 dark:text-gray-400">
          {t('analysis.circinate.meanDistance')}: <span className="font-medium">{analysis.radialStats.mean.toFixed(0)} µm</span>
          {' '}(CV: {(analysis.radialStats.coefficientOfVariation * 100).toFixed(1)}%)
        </div>
      )}
    </div>
  );
}

/**
 * Simple metric row with label and value
 */
function MetricRow({ label, value, percentage }: { label: string; value: string; percentage: number }) {
  const color = percentage >= 0.7 ? 'text-green-600 dark:text-green-400'
    : percentage >= 0.4 ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-smoke-600 dark:text-gray-400">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}

/**
 * Visual metric bar
 */
function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-center text-[10px]">
        <span className="text-smoke-600 dark:text-gray-400">{label}</span>
        <span className="font-medium text-coal-700 dark:text-gray-300">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="w-full bg-coal-100 dark:bg-gray-700 rounded-full h-1.5">
        <div
          className={`${color} h-1.5 rounded-full transition-all duration-300`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}
