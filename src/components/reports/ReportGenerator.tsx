import React, { useState } from 'react';
import { FileText, Lock, CheckCircle, AlertCircle } from 'lucide-react';
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
import { isDemoPreviewSession } from '@/lib/db/demoPatient';

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
    setReportType(type);
    try {
      const pdfBlob = await generateSessionReport(sessionId, type, evaluatorNotes);

      // Check if a report of the same type already exists for this session
      const existingReport = await db.reports
        .where({ sessionId: sessionId, type: type })
        .first();

      if (existingReport) {
        // Update the existing report instead of creating a duplicate
        await db.reports.update(existingReport.id, {
          pdfBlob: pdfBlob,
          evaluatorNotes: evaluatorNotes,
          generatedAt: new Date(),
        });
      } else {
        // Create a new report
        await db.reports.add({
          sessionId: sessionId,
          type: type,
          reportCategory: 'single',
          pdfBlob: pdfBlob,
          evaluatorNotes: evaluatorNotes,
          areasOfInterest: [], // Initialize empty
          generatedAt: new Date(),
        });
      }

      // Only download final reports automatically, not preview reports
      if (type === 'final') {
        // Download PDF for final reports
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DIRD_Reporte_${type.toUpperCase()}_${sessionId}_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      // If final report, lock session (unless it's the demo preview session)
      if (type === 'final') {
        const isDemoPreview = await isDemoPreviewSession(sessionId);
        if (!isDemoPreview) {
          await db.sessions.update(sessionId, {
            locked: true,
            lockedAt: new Date(),
          });
        }
      }

      setShowDialog(false);
      onReportGenerated?.();
    } catch (error) {
      console.error('Error generating report:', error);
      alert(t('errors.unknown'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Button 
        onClick={() => setShowDialog(true)} 
        className="flex items-center justify-center gap-2 h-auto min-h-[40px] py-2 whitespace-normal text-center leading-tight w-full sm:w-auto"
      >
        <FileText className="w-4 h-4 flex-shrink-0" />
        <span>{t('reports.generate')}</span>
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600" />
              {t('reports.generate')}
            </DialogTitle>
            <DialogDescription>
              Asegúrese de que todos los hallazgos han sido revisados antes de generar el informe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-semibold text-coal-700">
                {t('reports.evaluatorNotes')}
              </Label>
              <Textarea
                id="notes"
                value={evaluatorNotes}
                onChange={(e) => setEvaluatorNotes(e.target.value)}
                placeholder="Escriba aquí las conclusiones clínicas y recomendaciones para el paciente..."
                rows={5}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Preview Report Card */}
              <div className="flex flex-col p-4 rounded-xl border border-coal-200 bg-coal-50/50 hover:border-primary-300 transition-all group">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-white border border-coal-200 group-hover:border-primary-200">
                    <FileText className="w-4 h-4 text-primary-500" />
                  </div>
                  <h4 className="font-bold text-coal-800 text-sm">
                    {t('reports.preview')}
                  </h4>
                </div>
                <p className="text-xs text-smoke-600 mb-4 flex-grow">
                  Genera un borrador para revisión interna. Incluye marca de agua y no bloquea la sesión para futuras ediciones.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-white"
                  onClick={() => handleGenerateReport('preview')}
                  disabled={generating}
                >
                  {generating && reportType === 'preview' ? (
                    t('ui.loading')
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5 mr-2" />
                      Generar Borrador
                    </>
                  )}
                </Button>
              </div>

              {/* Final Report Card */}
              <div className="flex flex-col p-4 rounded-xl border border-accent-100 bg-accent-50/30 hover:border-accent-400 transition-all group">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-white border border-accent-100 group-hover:border-accent-200">
                    <Lock className="w-4 h-4 text-accent-500" />
                  </div>
                  <h4 className="font-bold text-coal-800 text-sm">
                    {t('reports.finalize')}
                  </h4>
                </div>
                <p className="text-xs text-smoke-600 mb-4 flex-grow">
                  Genera el informe clínico oficial. <strong>Bloquea la sesión permanentemente</strong> para garantizar la integridad de los datos.
                </p>
                <Button
                  size="sm"
                  className="w-full bg-accent-500 hover:bg-accent-600 text-white"
                  onClick={() => {
                    if (confirm(t('reports.finalWarning'))) {
                      handleGenerateReport('final');
                    }
                  }}
                  disabled={generating}
                >
                  {generating && reportType === 'final' ? (
                    t('ui.loading')
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 mr-2" />
                      {t('reports.finalize')}
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-800 leading-tight">
                <strong>Importante:</strong> Los informes generados se guardan localmente en la base de datos del navegador. Puede acceder a ellos desde la pestaña "Reporte" de esta sesión en cualquier momento.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReportGeneratorComponent;

