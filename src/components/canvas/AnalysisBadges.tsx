/**
 * AnalysisBadges
 *
 * Floating badges that appear on canvas when significant findings are detected
 * Clicking a badge opens a modal with detailed analysis
 */

import { useState } from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Circle, Eye } from 'lucide-react';
import type { CircinatePatternAnalysis, MacularEdemaResult } from '@/lib/analysis/macular-edema-detector';
import type { HemorrhageAnalysis } from '@/lib/analysis/hemorrhage-detector';
import type { MicroaneurysmAnalysis } from '@/lib/analysis/microaneurysm-detector';
import type { OpticDiscCuppingAnalysis } from '@/lib/analysis/optic-disc-cupping-detector';
import { CircinateAnalysisModal } from './CircinateAnalysisModal';
import { HemorrhageAnalysisModal } from './HemorrhageAnalysisModal';
import { MicroaneurysmAnalysisModal } from './MicroaneurysmAnalysisModal';
import { OpticDiscCuppingModal } from './OpticDiscCuppingModal';

interface AnalysisBadgesProps {
  circinateAnalysis?: CircinatePatternAnalysis | null;
  macularEdemaResult?: MacularEdemaResult | null;
  hemorrhageAnalysis?: HemorrhageAnalysis | null;
  microaneurysmAnalysis?: MicroaneurysmAnalysis | null;
  opticDiscCuppingAnalysis?: OpticDiscCuppingAnalysis | null;
}

export function AnalysisBadges({
  circinateAnalysis,
  macularEdemaResult,
  hemorrhageAnalysis,
  microaneurysmAnalysis,
  opticDiscCuppingAnalysis,
}: AnalysisBadgesProps) {
  const [circinateModalOpen, setCircinateModalOpen] = useState(false);
  const [hemorrhageModalOpen, setHemorrhageModalOpen] = useState(false);
  const [microaneurysmModalOpen, setMicroaneurysmModalOpen] = useState(false);
  const [opticDiscCuppingModalOpen, setOpticDiscCuppingModalOpen] = useState(false);

  const badges = [];

  // Circinate pattern badge
  if (circinateAnalysis && (circinateAnalysis.isCompleteRing || circinateAnalysis.isPartialRing)) {
    let badge;
    if (circinateAnalysis.isCompleteRing) {
      badge = {
        id: 'circinate',
        icon: CheckCircle2,
        label: 'Anillo Completo',
        color: 'bg-green-500 hover:bg-green-600',
        textColor: 'text-white',
        urgent: (circinateAnalysis.clinical?.distanceToFoveaMicrons ?? Infinity) < 500,
        onClick: () => setCircinateModalOpen(true),
      };
    } else {
      badge = {
        id: 'circinate',
        icon: AlertCircle,
        label: 'Anillo Parcial',
        color: 'bg-yellow-500 hover:bg-yellow-600',
        textColor: 'text-white',
        urgent: (circinateAnalysis.clinical?.distanceToFoveaMicrons ?? Infinity) < 500,
        onClick: () => setCircinateModalOpen(true),
      };
    }
    badges.push(badge);
  }

  // Hemorrhage badge
  if (hemorrhageAnalysis && hemorrhageAnalysis.totalCount > 0) {
    badges.push({
      id: 'hemorrhage',
      icon: AlertTriangle,
      label: `${hemorrhageAnalysis.totalCount} Hemorragia${hemorrhageAnalysis.totalCount > 1 ? 's' : ''}`,
      color: 'bg-orange-500 hover:bg-orange-600',
      textColor: 'text-white',
      urgent: false,
      onClick: () => setHemorrhageModalOpen(true),
    });
  }

  // Microaneurysm badge
  if (microaneurysmAnalysis && microaneurysmAnalysis.totalCount > 0) {
    badges.push({
      id: 'microaneurysm',
      icon: Circle,
      label: `${microaneurysmAnalysis.totalCount} Microaneurisma${microaneurysmAnalysis.totalCount > 1 ? 's' : ''}`,
      color: 'bg-purple-500 hover:bg-purple-600',
      textColor: 'text-white',
      urgent: false,
      onClick: () => setMicroaneurysmModalOpen(true),
    });
  }

  // Optic disc cupping badge
  if (opticDiscCuppingAnalysis && opticDiscCuppingAnalysis.cupDiscRatioAverage !== null) {
    const ratio = opticDiscCuppingAnalysis.cupDiscRatioAverage;
    const isElevated = ratio > 0.6;

    badges.push({
      id: 'optic-disc-cupping',
      icon: Eye,
      label: `C/D: ${ratio.toFixed(2)}`,
      color: isElevated ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-500 hover:bg-blue-600',
      textColor: 'text-white',
      urgent: isElevated,
      onClick: () => setOpticDiscCuppingModalOpen(true),
    });
  }

  if (badges.length === 0) {
    return null;
  }

  return (
    <>
      {/* Floating Badges */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        {badges.map((badge) => {
          const Icon = badge.icon;
          return (
            <button
              key={badge.id}
              onClick={badge.onClick}
              className={`
                ${badge.color} ${badge.textColor}
                px-3 py-2 rounded-lg shadow-lg
                flex items-center gap-2
                transition-all duration-200
                hover:scale-105 hover:shadow-xl
                ${badge.urgent ? 'animate-pulse' : ''}
              `}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-semibold">{badge.label}</span>
              {badge.urgent && (
                <span className="ml-1 text-xs">⚠️</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Modals */}
      {circinateAnalysis && (
        <CircinateAnalysisModal
          open={circinateModalOpen}
          onOpenChange={setCircinateModalOpen}
          analysis={circinateAnalysis}
          macularEdemaResult={macularEdemaResult}
        />
      )}

      {hemorrhageAnalysis && (
        <HemorrhageAnalysisModal
          open={hemorrhageModalOpen}
          onOpenChange={setHemorrhageModalOpen}
          analysis={hemorrhageAnalysis}
        />
      )}

      {microaneurysmAnalysis && (
        <MicroaneurysmAnalysisModal
          open={microaneurysmModalOpen}
          onOpenChange={setMicroaneurysmModalOpen}
          analysis={microaneurysmAnalysis}
        />
      )}

      {opticDiscCuppingAnalysis && (
        <OpticDiscCuppingModal
          open={opticDiscCuppingModalOpen}
          onOpenChange={setOpticDiscCuppingModalOpen}
          analysis={opticDiscCuppingAnalysis}
        />
      )}
    </>
  );
}
