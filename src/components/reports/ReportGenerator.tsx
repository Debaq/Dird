import React, { useState } from 'react';
import { FileText, Download, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { generateSessionReport } from '@/lib/pdf/report-generator';
import type { ReportType } from '@/lib/pdf/report-generator';
import { db } from '@/lib/db/schema';

interface ReportGeneratorProps {
  sessionId: number;
  onReportGenerated?: () => void;
}

const ReportGeneratorComponent: React.FC<ReportGeneratorProps> = ({
  sessionId,
  onReportGenerated,
}) => {
  const { t } = useTranslation();
  const [showDialog, setShowDialog] = useState(false);
  const [evaluatorNotes, setEvaluatorNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('preview');

  const handleGenerateReport = async (type: ReportType) => {
    setGenerating(true);
    try {
      const pdfBlob = await generateSessionReport(sessionId, type, evaluatorNotes);

      // Download PDF
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-${type}-${sessionId}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // If final report, lock session
      if (type === 'final') {
        await db.sessions.update(sessionId, {
          locked: true,
          lockedAt: new Date(),
        });
      }

      setShowDialog(false);
      onReportGenerated?.();
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error al generar el reporte');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Button onClick={() => setShowDialog(true)} className="flex items-center space-x-2">
        <FileText className="w-4 h-4" />
        <span>{t('reports.generate')}</span>
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('reports.generate')}</DialogTitle>
            <DialogDescription>
              Configura las opciones del reporte antes de generarlo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <Label htmlFor="notes">{t('reports.evaluatorNotes')}</Label>
              <Textarea
                id="notes"
                value={evaluatorNotes}
                onChange={(e) => setEvaluatorNotes(e.target.value)}
                placeholder="Agrega tus observaciones sobre el análisis..."
                rows={6}
                className="mt-2"
              />
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold text-coal-800 mb-3">Tipo de Reporte</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Preview Report */}
                <div className="p-4 border-2 border-coal-200 rounded-lg hover:border-primary-400 transition-colors">
                  <h4 className="font-semibold text-coal-800 mb-2">
                    {t('reports.status.preliminary')}
                  </h4>
                  <p className="text-sm text-smoke-600 mb-4">
                    Reporte preliminar con marca de agua. No bloquea la sesión.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleGenerateReport('preview')}
                    disabled={generating}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {generating && reportType === 'preview'
                      ? 'Generando...'
                      : 'Descargar Vista Previa'}
                  </Button>
                </div>

                {/* Final Report */}
                <div className="p-4 border-2 border-accent-200 rounded-lg hover:border-accent-400 transition-colors">
                  <h4 className="font-semibold text-coal-800 mb-2">
                    {t('reports.status.final')}
                  </h4>
                  <p className="text-sm text-smoke-600 mb-4">
                    Reporte final. Bloquea la sesión y previene ediciones futuras.
                  </p>
                  <Button
                    className="w-full bg-accent-500 hover:bg-accent-600"
                    onClick={() => {
                      if (
                        confirm(
                          '¿Estás seguro? El reporte final bloqueará la sesión permanentemente.'
                        )
                      ) {
                        setReportType('final');
                        handleGenerateReport('final');
                      }
                    }}
                    disabled={generating}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    {generating && reportType === 'final'
                      ? 'Generando...'
                      : t('reports.finalize')}
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-coal-50 p-3 rounded-lg">
              <p className="text-xs text-smoke-600">
                <strong>Nota:</strong> El reporte final bloqueará la sesión y no se podrán
                realizar más cambios. Asegúrate de revisar toda la información antes de
                finalizar.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReportGeneratorComponent;
