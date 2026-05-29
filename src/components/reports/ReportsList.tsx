import React, { useState } from 'react';
import { useLiveQuery } from '@/lib/db-sql';
import { FileText, Download, Calendar, ShieldCheck, Eye, Trash2, Edit3, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';
import { useTranslation } from 'react-i18next';
import { db, type Report } from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PDFViewerModal from './PDFViewerModal';
import { regenerateSessionReportBlob } from '@/lib/pdf/report-generator';
import { ReportGenerator } from '@/lib/pdf/report-generator';
interface ReportsListProps {
  sessionId: number;
  refreshKey?: number;
}

const ReportsList: React.FC<ReportsListProps> = ({ sessionId, refreshKey }) => {
  const { t } = useTranslation();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [selectedReport, setSelectedReport] = useState<{ blob: Blob; title: string } | null>(null);

  const reports = useLiveQuery(
    () => db.reports.where('sessionId').equals(sessionId).reverse().sortBy('generatedAt'),
    [sessionId, refreshKey]
  );

  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);

  const handleDownload = async (pdfBlob: Blob, type: string, date: Date, reportSessionId: number, notes?: string, reportId?: number) => {
    let blobToUse = pdfBlob;
    if (type === 'preview') {
      try {
        blobToUse = await regenerateSessionReportBlob(reportSessionId, notes);
      } catch (error) {
        console.error("Error regenerating preview report", error);
      }

      // Marcar el preview como descargado
      if (reportId) {
        try {
          await db.reports.update(reportId, { previewDownloaded: true });
        } catch (error) {
          console.error("Error updating preview downloaded status", error);
        }
      }
    }
    const url = URL.createObjectURL(blobToUse);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DIRD_Reporte_${type.toUpperCase()}_${new Date(date).toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleViewPDF = async (pdfBlob: Blob, type: string, date: Date, reportSessionId: number, notes?: string, reportId?: number) => {
    let blobToUse = pdfBlob;
    if (type === 'preview') {
      try {
        blobToUse = await regenerateSessionReportBlob(reportSessionId, notes);
      } catch (error) {
        console.error("Error regenerating preview report", error);
      }

      // Marcar el preview como visualizado
      if (reportId) {
        try {
          await db.reports.update(reportId, { previewViewed: true });
        } catch (error) {
          console.error("Error updating preview viewed status", error);
        }
      }
    }
    const title = `DIRD_Reporte_${type.toUpperCase()}_${new Date(date).toISOString().split('T')[0]}.pdf`;
    setSelectedReport({ blob: blobToUse, title });
  };

  const handleCloseModal = () => {
    setSelectedReport(null);
  };

  const [editingReport, setEditingReport] = useState<{id: number, notes: string, originalNotes?: string} | null>(null);
  const [finalizingReport, setFinalizingReport] = useState<number | null>(null);

  const handleDeleteReport = async (reportId: number, type: string) => {
    if (type === 'final') {
      toast.error(t('reports.list.deleteFinalError'));
      return;
    }

    const confirmed = await confirm({
      title: t('confirmations.deleteReportTitle') || t('reports.list.delete'),
      description: t('reports.list.deleteConfirm'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      variant: 'destructive',
    });

    if (confirmed) {
      try {
        await db.reports.delete(reportId);
        toast.success(t('reports.list.deleteSuccess'));
      } catch (error) {
        console.error('Error deleting report:', error);
        toast.error(t('errors.unknown'));
      }
    }
  };

  const handleFinalizeReport = async (reportId: number, sessionId: number, notes: string) => {
    if (!reportId) return;

    const confirmed = await confirm({
      title: t('confirmations.finalizeReportTitle') || t('reports.list.finalize'),
      description: t('reports.list.finalizeConfirm'),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
      variant: 'warning',
    });

    if (!confirmed) {
      return;
    }

    setFinalizingReport(reportId);
    try {
      // Get the session and patient data for the report
      const session = await db.sessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const patient = await db.patients.get(session.patientId);
      if (!patient) {
        throw new Error('Patient not found');
      }

      const images = await db.images.where('sessionId').equals(sessionId).toArray();
      const allDetections = await Promise.all(
        images.map((img) => db.detections.where('imageId').equals(img.id!).toArray())
      );
      const detections = allDetections.flat();

      const allSegmentations = await Promise.all(
        images.map((img) => db.segmentations.where('imageId').equals(img.id!).toArray())
      );
      const segmentations = allSegmentations.flat();

      const allMeasurements = await Promise.all(
        images.map((img) => db.measurements.where('imageId').equals(img.id!).toArray())
      );
      const measurements = allMeasurements.flat();

      // Generate the final report PDF
      const reportData = {
        patient,
        session,
        images,
        detections,
        segmentations,
        measurements,
        evaluatorNotes: notes,
      };

      const generator = new ReportGenerator();
      const finalPdfBlob = await generator.generateReport(reportData, 'final');

      // Update the existing report to be final (this will overwrite the PDF blob)
      await db.reports.update(reportId, {
        type: 'final',
        pdfBlob: finalPdfBlob,
        generatedAt: new Date(),
      });

      // Lock the session
      await db.sessions.update(sessionId, {
        locked: true,
        lockedAt: new Date(),
      });

      // Download the final report automatically
      const url = URL.createObjectURL(finalPdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DIRD_Reporte_FINAL_${sessionId}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(t('reports.list.finalizeSuccess'));
    } catch (error) {
      console.error('Error finalizing report:', error);
      toast.error(t('errors.unknown'));
    } finally {
      setFinalizingReport(null);
    }
  };

  const startEditing = (reportId: number, currentNotes: string, originalNotes?: string) => {
    setEditingReport({id: reportId, notes: currentNotes, originalNotes});
  };

  const saveEditedNotes = async () => {
    if (!editingReport) return;

    try {
      // Update only the notes in the database without regenerating the PDF
      await db.reports.update(editingReport.id, {
        evaluatorNotes: editingReport.notes,
        conclusionEdited: true, // Marcar que se editó la conclusión
        generatedAt: new Date(), // Update the timestamp when notes are edited
      });

      setEditingReport(null);
      toast.success(t('reports.list.updateSuccess') || 'Conclusión actualizada');
    } catch (error) {
      console.error('Error updating report notes:', error);
      toast.error(t('reports.list.updateError'));
    }
  };

  const cancelEditing = () => {
    setEditingReport(null);
  };

  // Verifica si el usuario ha interactuado con el preview
  const hasInteractedWithPreview = (report: Report) => {
    return report.previewViewed || report.previewDownloaded || report.conclusionEdited;
  };

  if (!reports) return <div className="py-8 text-center">{t('ui.loading')}</div>;

  if (reports.length === 0) {
    return (
      <div className="py-12 text-center border-2 border-dashed border-coal-200 rounded-xl bg-coal-50/50">
        <FileText className="w-12 h-12 text-smoke-300 mx-auto mb-4" />
        <p className="text-smoke-600 font-medium">{t('reports.list.noReports')}</p>
        <p className="text-smoke-400 text-sm mt-1">
          {t('reports.list.addFirst')}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {reports.map((report) => (
          <div
            key={report.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-coal-200 rounded-xl hover:shadow-md transition-all group gap-4"
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg flex-shrink-0 ${
                report.type === 'final' ? 'bg-accent-50 text-accent-600' : 'bg-primary-50 text-primary-600'
              }`}>
                {report.type === 'final' ? <ShieldCheck className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
              </div>
              <div className="min-w-0">
                {report.type !== 'final' && (
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-bold text-coal-800">
                      {t('reports.status.preliminary')}
                    </span>
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {report.type}
                    </Badge>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-smoke-500">
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(report.generatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-primary-50 hover:text-primary-700 w-full sm:w-auto justify-center"
                onClick={() => handleViewPDF(report.pdfBlob, report.type, report.generatedAt, report.sessionId, report.evaluatorNotes, report.id)}
              >
                <Eye className="w-4 h-4 mr-2" />
                {t('reports.list.viewPDF')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-primary-50 hover:text-primary-700 w-full sm:w-auto justify-center"
                onClick={() => handleDownload(report.pdfBlob, report.type, report.generatedAt, report.sessionId, report.evaluatorNotes, report.id)}
              >
                <Download className="w-4 h-4 mr-2" />
                {t('reports.list.downloadPDF')}
              </Button>
              {report.type === 'preview' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:bg-amber-50 hover:text-amber-700 w-full sm:w-auto justify-center"
                  onClick={() => report.id && startEditing(report.id, report.evaluatorNotes || '', report.originalNotes)}
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  {t('reports.list.edit')}
                </Button>
              )}
              {report.type === 'preview' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:bg-red-50 hover:text-red-700 w-full sm:w-auto justify-center"
                  onClick={() => report.id && handleDeleteReport(report.id, report.type)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('reports.list.delete')}
                </Button>
              )}
              {report.type === 'preview' && session && !session.locked && (
                <div className="relative w-full sm:w-auto group/tooltip">
                  <Button
                    variant="default"
                    size="sm"
                    className="hover:bg-accent-600 hover:text-white w-full sm:w-auto bg-accent-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => report.id && handleFinalizeReport(report.id, report.sessionId, report.evaluatorNotes || '')}
                    disabled={finalizingReport === report.id || !hasInteractedWithPreview(report)}
                    title={!hasInteractedWithPreview(report) ? t('reports.list.mustInteractFirst', { defaultValue: 'Debe visualizar, descargar o editar el preview primero' }) : ''}
                  >
                    {finalizingReport === report.id ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2 animate-spin" />
                        {t('reports.list.finalizing')}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {t('reports.list.finalize')}
                      </>
                    )}
                  </Button>
                  {!hasInteractedWithPreview(report) && (
                    <div className="hidden group-hover/tooltip:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-coal-900 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg">
                      {t('reports.list.mustInteractFirst', { defaultValue: 'Debe visualizar, descargar o editar el preview primero' })}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-coal-900"></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {selectedReport && (
          <PDFViewerModal
            isOpen={!!selectedReport}
            onClose={handleCloseModal}
            pdfBlob={selectedReport.blob}
            title={selectedReport.title}
            onDownload={() => {
              const url = URL.createObjectURL(selectedReport.blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = selectedReport.title;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
          />
        )}

        {editingReport && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-dark-surface rounded-xl w-full max-w-2xl p-6 shadow-2xl">
              <h3 className="text-lg font-semibold mb-2 text-coal-800 dark:text-dark-text">
                {t('reports.list.editModalTitle')}
              </h3>
              
              {editingReport.originalNotes && (
                <div className="mb-4">
                  <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded-md mb-3 border border-amber-100 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    {t('reports.list.editModalInfo')}
                  </div>
                  <div className="flex gap-2">
                     <Button
                        variant={editingReport.notes !== editingReport.originalNotes ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          // Note: Swapping logic could be improved here
                        }}
                        className="pointer-events-none" 
                      >
                        {t('reports.list.aiVersion')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingReport({...editingReport, notes: editingReport.originalNotes!})}
                        disabled={editingReport.notes === editingReport.originalNotes}
                      >
                        {t('reports.list.restoreDraft')}
                      </Button>
                  </div>
                </div>
              )}

              <textarea
                value={editingReport.notes}
                onChange={(e) => setEditingReport({...editingReport, notes: e.target.value})}
                className="w-full h-64 p-4 border border-coal-200 dark:border-coal-600 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-50 dark:bg-coal-800 text-sm leading-relaxed"
                placeholder={t('reports.list.editModalPlaceholder')}
              />
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-coal-100 dark:border-coal-700">
                <Button
                  variant="outline"
                  onClick={cancelEditing}
                >
                  {t('ui.cancel')}
                </Button>
                <Button
                  onClick={saveEditedNotes}
                  className="min-w-[100px]"
                >
                  {t('ui.save')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      {ConfirmDialogComponent}
    </>
  );
};

export default ReportsList;
