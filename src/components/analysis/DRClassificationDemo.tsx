/**
 * Demo component for DR Classification
 * This can be used for testing and will be integrated into the main UI later
 */

import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { useDRClassification } from '../../hooks/useDRClassification';
import { Loader2, FileText, AlertCircle } from 'lucide-react';

interface DRClassificationDemoProps {
  sessionId?: number;
  patientId?: number;
}

export function DRClassificationDemo({ sessionId, patientId }: DRClassificationDemoProps) {
  const {
    classification,
    isLoading,
    error,
    classifySession,
    classifyPatient
  } = useDRClassification();

  const handleClassify = async () => {
    if (sessionId) {
      await classifySession(sessionId);
    } else if (patientId) {
      await classifyPatient(patientId);
    }
  };

  const severityLabels: Record<string, string> = {
    'no_dr': 'Sin Retinopatía Diabética',
    'mild_npdr': 'RD No Proliferativa Leve',
    'moderate_npdr': 'RD No Proliferativa Moderada',
    'severe_npdr': 'RD No Proliferativa Severa',
    'pdr': 'RD Proliferativa'
  };

  const severityColors: Record<string, string> = {
    'no_dr': 'text-green-600 bg-green-50',
    'mild_npdr': 'text-yellow-600 bg-yellow-50',
    'moderate_npdr': 'text-orange-600 bg-orange-50',
    'severe_npdr': 'text-red-600 bg-red-50',
    'pdr': 'text-red-700 bg-red-100'
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Clasificación de Retinopatía Diabética</h3>
          <Button
            onClick={handleClassify}
            disabled={isLoading || (!sessionId && !patientId)}
            size="sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Clasificando...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generar Clasificación
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {classification && (
          <div className="space-y-4">
            {/* Overall Severity */}
            <div>
              <div className="text-sm text-gray-600 mb-1">Severidad Global:</div>
              <div className={`inline-block px-3 py-1 rounded-full font-medium ${severityColors[classification.overallSeverity]}`}>
                {severityLabels[classification.overallSeverity]}
              </div>
            </div>

            {/* Eye Classifications */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classification.rightEye && (
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium mb-2">Ojo Derecho (OD)</h4>
                  <div className={`text-sm px-2 py-1 rounded mb-2 ${severityColors[classification.rightEye.severity]}`}>
                    {severityLabels[classification.rightEye.severity]}
                  </div>
                  <div className="text-xs text-gray-600">
                    <div className="font-medium mb-1">Lesiones detectadas:</div>
                    <ul className="space-y-1">
                      {classification.rightEye.lesions.microaneurysms > 0 && (
                        <li>Microaneurismas: {classification.rightEye.lesions.microaneurysms}</li>
                      )}
                      {classification.rightEye.lesions.hemorrhages > 0 && (
                        <li>Hemorragias: {classification.rightEye.lesions.hemorrhages}</li>
                      )}
                      {classification.rightEye.lesions.hardExudates > 0 && (
                        <li>Exudados duros: {classification.rightEye.lesions.hardExudates}</li>
                      )}
                      {classification.rightEye.lesions.softExudates > 0 && (
                        <li>Exudados blandos: {classification.rightEye.lesions.softExudates}</li>
                      )}
                      {classification.rightEye.lesions.neovascularization > 0 && (
                        <li className="text-red-600 font-medium">
                          Neovascularización: {classification.rightEye.lesions.neovascularization}
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {classification.leftEye && (
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium mb-2">Ojo Izquierdo (OI)</h4>
                  <div className={`text-sm px-2 py-1 rounded mb-2 ${severityColors[classification.leftEye.severity]}`}>
                    {severityLabels[classification.leftEye.severity]}
                  </div>
                  <div className="text-xs text-gray-600">
                    <div className="font-medium mb-1">Lesiones detectadas:</div>
                    <ul className="space-y-1">
                      {classification.leftEye.lesions.microaneurysms > 0 && (
                        <li>Microaneurismas: {classification.leftEye.lesions.microaneurysms}</li>
                      )}
                      {classification.leftEye.lesions.hemorrhages > 0 && (
                        <li>Hemorragias: {classification.leftEye.lesions.hemorrhages}</li>
                      )}
                      {classification.leftEye.lesions.hardExudates > 0 && (
                        <li>Exudados duros: {classification.leftEye.lesions.hardExudates}</li>
                      )}
                      {classification.leftEye.lesions.softExudates > 0 && (
                        <li>Exudados blandos: {classification.leftEye.lesions.softExudates}</li>
                      )}
                      {classification.leftEye.lesions.neovascularization > 0 && (
                        <li className="text-red-600 font-medium">
                          Neovascularización: {classification.leftEye.lesions.neovascularization}
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Recommendations */}
            {classification.recommendations.length > 0 && (
              <div className="border-t pt-3">
                <h4 className="font-medium mb-2 text-sm">Recomendaciones:</h4>
                <ul className="text-xs text-gray-700 space-y-1">
                  {classification.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {classification.warnings.length > 0 && (
              <div className="border-t pt-3">
                <h4 className="font-medium mb-2 text-sm text-amber-700">Advertencias:</h4>
                <ul className="text-xs text-amber-600 space-y-1">
                  {classification.warnings.map((warning, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Console Log Note */}
            <div className="border-t pt-3">
              <div className="text-xs text-gray-500 italic">
                ℹ️ Ver la consola del navegador para el JSON completo de datos
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
