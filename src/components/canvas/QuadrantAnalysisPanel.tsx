import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { QuadrantAnalysis } from '@/lib/analysis/quadrant-calculator';
import { Eye, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface QuadrantAnalysisPanelProps {
  analysis: QuadrantAnalysis | null;
  className?: string;
  eyeType?: 'OD' | 'OI';
}

/**
 * QuadrantAnalysisPanel
 *
 * Displays quadrant analysis results in a structured, visual format
 */
export function QuadrantAnalysisPanel({ analysis, className = '', eyeType = 'OD' }: QuadrantAnalysisPanelProps) {
  if (!analysis) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center gap-2 text-gray-500">
          <Eye className="w-4 h-4" />
          <span className="text-sm">No analysis available</span>
        </div>
      </Card>
    );
  }

  const hasLandmarks = analysis.opticDiscFound && analysis.foveaFound;

  return (
    <Card className={`p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Quadrant Analysis
        </h3>
        {hasLandmarks ? (
          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Anatomical
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Fallback
          </Badge>
        )}
      </div>

      {/* Landmark Status */}
      <div className="flex gap-2 mb-3 text-xs">
        <div className={`flex items-center gap-1 ${analysis.opticDiscFound ? 'text-green-600' : 'text-gray-400'}`}>
          {analysis.opticDiscFound ? '✓' : '✗'} Optic Disc
        </div>
        <div className={`flex items-center gap-1 ${analysis.foveaFound ? 'text-green-600' : 'text-gray-400'}`}>
          {analysis.foveaFound ? '✓' : '✗'} Fovea
        </div>
      </div>

      {/* Quadrant Grid Visualization */}
      <div className="mb-3">
        <QuadrantGrid analysis={analysis} eyeType={eyeType} />
      </div>

      {/* Total */}
      <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm font-semibold">
        <span>Total Lesions</span>
        <span className="text-lg">{analysis.total}</span>
      </div>

      {/* Warning if using fallback */}
      {analysis.usedFallback && (
        <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
          <AlertTriangle className="w-3 h-3 inline mr-1" />
          Using center-based division. Place landmarks for accurate anatomical reference.
        </div>
      )}
    </Card>
  );
}

/**
 * Visual grid showing quadrant distribution
 */
function QuadrantGrid({ analysis, eyeType = 'OD' }: { analysis: QuadrantAnalysis; eyeType?: 'OD' | 'OI' }) {
  const maxCount = Math.max(
    analysis['superior-temporal'],
    analysis['inferior-temporal'],
    analysis['superior-nasal'],
    analysis['inferior-nasal'],
    1
  );

  const getIntensity = (count: number) => {
    if (count === 0) return 0.1;
    return 0.3 + (count / maxCount) * 0.7;
  };

  const stIntensity = getIntensity(analysis['superior-temporal']);
  const itIntensity = getIntensity(analysis['inferior-temporal']);
  const snIntensity = getIntensity(analysis['superior-nasal']);
  const inIntensity = getIntensity(analysis['inferior-nasal']);

  // For OD (Right Eye): ST-IT on left, SN-IN on right
  // For OI (Left Eye): SN-IN on left, ST-IT on right (mirrored)
  if (eyeType === 'OD') {
    return (
      <div className="grid grid-cols-2 gap-1 aspect-square max-w-[200px] mx-auto">
        {/* Superior Temporal */}
        <div
          className="border-2 border-gray-300 rounded-tl flex items-center justify-center font-bold"
          style={{
            backgroundColor: `rgba(239, 68, 68, ${stIntensity})`,
          }}
        >
          <div className="text-center">
            <div className="text-xs text-gray-600">ST</div>
            <div className="text-lg">{analysis['superior-temporal']}</div>
          </div>
        </div>

        {/* Superior Nasal */}
        <div
          className="border-2 border-gray-300 rounded-tr flex items-center justify-center font-bold"
          style={{
            backgroundColor: `rgba(34, 197, 94, ${snIntensity})`,
          }}
        >
          <div className="text-center">
            <div className="text-xs text-gray-600">SN</div>
            <div className="text-lg">{analysis['superior-nasal']}</div>
          </div>
        </div>

        {/* Inferior Temporal */}
        <div
          className="border-2 border-gray-300 rounded-bl flex items-center justify-center font-bold"
          style={{
            backgroundColor: `rgba(249, 115, 22, ${itIntensity})`,
          }}
        >
          <div className="text-center">
            <div className="text-xs text-gray-600">IT</div>
            <div className="text-lg">{analysis['inferior-temporal']}</div>
          </div>
        </div>

        {/* Inferior Nasal */}
        <div
          className="border-2 border-gray-300 rounded-br flex items-center justify-center font-bold"
          style={{
            backgroundColor: `rgba(59, 130, 246, ${inIntensity})`,
          }}
        >
          <div className="text-center">
            <div className="text-xs text-gray-600">IN</div>
            <div className="text-lg">{analysis['inferior-nasal']}</div>
          </div>
        </div>
      </div>
    );
  } else {
    // OI (Left Eye) - Mirrored layout
    return (
      <div className="grid grid-cols-2 gap-1 aspect-square max-w-[200px] mx-auto">
        {/* Superior Nasal */}
        <div
          className="border-2 border-gray-300 rounded-tl flex items-center justify-center font-bold"
          style={{
            backgroundColor: `rgba(34, 197, 94, ${snIntensity})`,
          }}
        >
          <div className="text-center">
            <div className="text-xs text-gray-600">SN</div>
            <div className="text-lg">{analysis['superior-nasal']}</div>
          </div>
        </div>

        {/* Superior Temporal */}
        <div
          className="border-2 border-gray-300 rounded-tr flex items-center justify-center font-bold"
          style={{
            backgroundColor: `rgba(239, 68, 68, ${stIntensity})`,
          }}
        >
          <div className="text-center">
            <div className="text-xs text-gray-600">ST</div>
            <div className="text-lg">{analysis['superior-temporal']}</div>
          </div>
        </div>

        {/* Inferior Nasal */}
        <div
          className="border-2 border-gray-300 rounded-bl flex items-center justify-center font-bold"
          style={{
            backgroundColor: `rgba(59, 130, 246, ${inIntensity})`,
          }}
        >
          <div className="text-center">
            <div className="text-xs text-gray-600">IN</div>
            <div className="text-lg">{analysis['inferior-nasal']}</div>
          </div>
        </div>

        {/* Inferior Temporal */}
        <div
          className="border-2 border-gray-300 rounded-br flex items-center justify-center font-bold"
          style={{
            backgroundColor: `rgba(249, 115, 22, ${itIntensity})`,
          }}
        >
          <div className="text-center">
            <div className="text-xs text-gray-600">IT</div>
            <div className="text-lg">{analysis['inferior-temporal']}</div>
          </div>
        </div>
      </div>
    );
  }
}

