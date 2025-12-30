/**
 * CircinateAnalysisPanel
 *
 * Displays clinically relevant information about circinate pattern detection
 * Content component used by AnalysisPanel
 */

import { CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import type { CircinatePatternAnalysis } from '@/lib/analysis/macular-edema-detector';

interface CircinateAnalysisContentProps {
  analysis: CircinatePatternAnalysis;
}

/**
 * Content component for circinate pattern analysis
 * Used inside AnalysisPanel
 * Shows clinically relevant information
 */
export function CircinateAnalysisContent({ analysis }: CircinateAnalysisContentProps) {
  // Determine pattern status
  const patternStatus = analysis.isCompleteRing
    ? { label: 'Anillo Completo', icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/20' }
    : analysis.isPartialRing
    ? { label: 'Anillo Parcial', icon: AlertCircle, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950/20' }
    : { label: 'Sin Patrón de Anillo', icon: Circle, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/20' };

  const StatusIcon = patternStatus.icon;

  // Determine clinical recommendation
  let recommendation = '';
  let recommendationColor = 'text-coal-600 dark:text-gray-400';

  if (analysis.isCompleteRing) {
    if (analysis.clinical && analysis.clinical.distanceToFoveaMicrons < 500) {
      recommendation = '⚠️ Amenaza foveal. Requiere tratamiento urgente.';
      recommendationColor = 'text-red-600 dark:text-red-400';
    } else if (analysis.clinical && analysis.clinical.distanceToFoveaMicrons < 1000) {
      recommendation = '⚠️ Cerca de fóvea. Seguimiento estrecho recomendado.';
      recommendationColor = 'text-orange-600 dark:text-orange-400';
    } else {
      recommendation = 'Seguimiento periódico. Vigilar progresión.';
      recommendationColor = 'text-yellow-600 dark:text-yellow-400';
    }
  } else if (analysis.isPartialRing) {
    if (analysis.clinical && analysis.clinical.distanceToFoveaMicrons < 500) {
      recommendation = '⚠️ Cerca de fóvea. Considerar tratamiento.';
      recommendationColor = 'text-orange-600 dark:text-orange-400';
    } else {
      recommendation = 'Vigilar evolución del patrón.';
      recommendationColor = 'text-yellow-600 dark:text-yellow-400';
    }
  } else {
    recommendation = 'Monitoreo de exudados dispersos.';
    recommendationColor = 'text-coal-600 dark:text-gray-400';
  }

  return (
    <div className="space-y-2">
      {/* Pattern Status */}
      <div className={`flex items-center gap-2 p-2 rounded ${patternStatus.bg}`}>
        <StatusIcon className={`w-4 h-4 ${patternStatus.color}`} />
        <span className={`text-sm font-semibold ${patternStatus.color}`}>
          {patternStatus.label}
        </span>
      </div>

      {/* Clinical Information */}
      <div className="space-y-1.5 text-xs">
        {/* Number of exudates in ring */}
        {analysis.clinical && (
          <ClinicalRow
            label="Exudados en anillo"
            value={`${analysis.clinical.exudatesInRing} de ${analysis.clinical.totalExudates}`}
          />
        )}

        {/* Ring radius */}
        {analysis.fittedCircle && (
          <ClinicalRow
            label="Radio del anillo"
            value={`${analysis.fittedCircle.radiusMicrons.toFixed(0)} µm`}
          />
        )}

        {/* Distance to fovea */}
        {analysis.clinical && (
          <ClinicalRow
            label="Distancia a fóvea"
            value={`${analysis.clinical.distanceToFoveaMicrons.toFixed(0)} µm`}
            highlight={analysis.clinical.distanceToFoveaMicrons < 1000}
          />
        )}
      </div>

      {/* Clinical Recommendation */}
      <div className="pt-2 border-t border-coal-100 dark:border-gray-700">
        <div className="text-[10px] text-smoke-500 dark:text-gray-500 mb-1">Recomendación:</div>
        <div className={`text-xs font-medium ${recommendationColor}`}>
          {recommendation}
        </div>
      </div>

      {/* Debug information - collapsible */}
      {analysis.debug && (
        <details className="text-xs">
          <summary className="cursor-pointer text-smoke-500 dark:text-gray-500 hover:text-coal-700 dark:hover:text-gray-300">
            🔍 Información técnica
          </summary>
          <div className="bg-coal-50 dark:bg-gray-900 p-2 rounded mt-1 border border-coal-200 dark:border-gray-700 space-y-0.5 text-smoke-600 dark:text-gray-400">
            <div>
              <span className="text-green-600 dark:text-green-400">●</span> En círculo: <span className="font-medium">{analysis.debug.exudatesOnCircle.filter(Boolean).length}/{analysis.debug.allExudates.length}</span>
              {' '}({(analysis.debug.circleAdherence * 100).toFixed(0)}%)
            </div>
            <div>
              <span className="text-red-600 dark:text-red-400">●</span> Fuera: <span className="font-medium">{analysis.debug.exudatesOnCircle.filter(x => !x).length}</span>
            </div>
            {analysis.debug.excludedFromFit.length > 0 && (
              <div>
                <span className="text-purple-600 dark:text-purple-400">✕</span> Excluidos: <span className="font-medium">{analysis.debug.excludedFromFit.length}</span>
              </div>
            )}
            <div>Tolerancia: <span className="font-medium">{(analysis.debug.radiusTolerance * analysis.fittedCircle!.radiusMicrons / analysis.fittedCircle!.radius).toFixed(0)} µm</span></div>
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * Clinical information row
 */
function ClinicalRow({
  label,
  value,
  highlight = false
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-smoke-600 dark:text-gray-400">{label}:</span>
      <span className={`font-semibold ${highlight ? 'text-orange-600 dark:text-orange-400' : 'text-coal-800 dark:text-gray-200'}`}>
        {value}
      </span>
    </div>
  );
}
