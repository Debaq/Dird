import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, Download, Calendar, ShieldCheck, Eye, Trash2, Edit3, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db } from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PDFViewerModal from './PDFViewerModal';
import { regenerateSessionReportBlob } from '@/lib/pdf/report-generator';
import { ReportGenerator } from '@/lib/pdf/report-generator';
import { isDemoPreviewSession } from '@/lib/db/demoPatient';

interface ReportsListProps {
  sessionId: number;
  refreshKey?: number;
}

const ReportsList: React.FC<ReportsListProps> = ({ sessionId, refreshKey }) => {
  const { t } = useTranslation();
  const [selectedReport, setSelectedReport] = useState<{ blob: Blob; title: string } | null>(null);

  const reports = useLiveQuery(
    () => db.reports.where('sessionId').equals(sessionId).reverse().sortBy('generatedAt'),
    [sessionId, refreshKey]
  );

  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);

  const handleDownload = async (pdfBlob: Blob, type: string, date: Date, reportSessionId: number, notes?: string) => {
    let blobToUse = pdfBlob;
    if (type === 'preview') {
      try {
        blobToUse = await regenerateSessionReportBlob(reportSessionId, notes);
      } catch (error) {
        console.error("Error regenerating preview report", error);
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

  const handleViewPDF = async (pdfBlob: Blob, type: string, date: Date, reportSessionId: number, notes?: string) => {
    let blobToUse = pdfBlob;
    if (type === 'preview') {
      try {
        blobToUse = await regenerateSessionReportBlob(reportSessionId, notes);
      } catch (error) {
        console.error("Error regenerating preview report", error);
      }
    }
    const title = `DIRD_Reporte_${type.toUpperCase()}_${new Date(date).toISOString().split('T')[0]}.pdf`;
    setSelectedReport({ blob: blobToUse, title });
  };

  const handleCloseModal = () => {
    setSelectedReport(null);
  };

  const [editingReport, setEditingReport] = useState<{id: number, notes: string} | null>(null);
  const [finalizingReport, setFinalizingReport] = useState<number | null>(null);

  const handleDeleteReport = async (reportId: number, type: string) => {
    if (type === 'final') {
      alert(t('reports.list.deleteFinalError'));
      return;
    }

    if (confirm(t('reports.list.deleteConfirm'))) {
      try {
        await db.reports.delete(reportId);
      } catch (error) {
        console.error('Error deleting report:', error);
        alert(t('errors.unknown'));
      }
    }
  };

  const handleFinalizeReport = async (reportId: number, sessionId: number, notes: string) => {
    if (!reportId) return;

    if (!confirm(t('reports.list.finalizeConfirm'))) {
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

      // Generate the final report PDF
      const reportData = {
        patient,
        session,
        images,
        detections,
        segmentations,
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

      // Lock the session (unless it's the demo preview session)
      const isDemoPreview = await isDemoPreviewSession(sessionId);
      if (!isDemoPreview) {
        await db.sessions.update(sessionId, {
          locked: true,
          lockedAt: new Date(),
        });
      }

      // Download the final report automatically
      const url = URL.createObjectURL(finalPdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DIRD_Reporte_FINAL_${sessionId}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const message = isDemoPreview
        ? t('reports.list.finalizeSuccessDemo')
        : t('reports.list.finalizeSuccess');
      alert(message);
    } catch (error) {
      console.error('Error finalizing report:', error);
      alert(t('errors.unknown'));
    } finally {
      setFinalizingReport(null);
    }
  };

  const startEditing = (reportId: number, currentNotes: string) => {
    setEditingReport({id: reportId, notes: currentNotes});
  };

  const saveEditedNotes = async () => {
    if (!editingReport) return;

    try {
      // Update only the notes in the database without regenerating the PDF
      await db.reports.update(editingReport.id, {
        evaluatorNotes: editingReport.notes,
        generatedAt: new Date(), // Update the timestamp when notes are edited
      });

      setEditingReport(null);
    } catch (error) {
      console.error('Error updating report notes:', error);
      alert('Error al actualizar las conclusiones');
    }
  };

  const cancelEditing = () => {
    setEditingReport(null);
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
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-bold text-coal-800">
                  {report.type === 'final' ? t('reports.status.final') : t('reports.status.preliminary')}
                </span>
                <Badge variant={report.type === 'final' ? 'default' : 'secondary'} className="text-[10px] uppercase">
                  {report.type}
                </Badge>
              </div>
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
              onClick={() => handleViewPDF(report.pdfBlob, report.type, report.generatedAt, report.sessionId, report.evaluatorNotes)}
            >
              <Eye className="w-4 h-4 mr-2" />
              {t('reports.list.viewPDF')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-primary-50 hover:text-primary-700 w-full sm:w-auto justify-center"
              onClick={() => handleDownload(report.pdfBlob, report.type, report.generatedAt, report.sessionId, report.evaluatorNotes)}
            >
              <Download className="w-4 h-4 mr-2" />
              {t('reports.list.downloadPDF')}
            </Button>
            {report.type === 'preview' && (
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-amber-50 hover:text-amber-700 w-full sm:w-auto justify-center"
                onClick={() => report.id && startEditing(report.id, report.evaluatorNotes || '')}
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
              <Button
                variant="default"
                size="sm"
                className="hover:bg-accent-600 hover:text-white w-full sm:w-auto bg-accent-500 text-white"
                onClick={() => report.id && handleFinalizeReport(report.id, report.sessionId, report.evaluatorNotes || '')}
                disabled={finalizingReport === report.id}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">{t('reports.list.editModalTitle')}</h3>
            <textarea
              value={editingReport.notes}
              onChange={(e) => setEditingReport({...editingReport, notes: e.target.value})}
              className="w-full h-32 p-3 border border-coal-200 rounded-lg resize-none"
              placeholder={t('reports.list.editModalPlaceholder')}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={cancelEditing}
              >
                {t('ui.cancel')}
              </Button>
              <Button
                onClick={saveEditedNotes}
              >
                {t('ui.save')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsList;
