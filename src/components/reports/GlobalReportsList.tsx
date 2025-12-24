import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, Download, Calendar, Tag, ShieldCheck, Eye, Search, FileSearch, ArrowRight, User, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { db, Report } from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PDFViewerModal from './PDFViewerModal';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { regenerateSessionReportBlob } from '@/lib/pdf/report-generator';
import { generateSessionReport, ReportGenerator, type ReportType } from '@/lib/pdf/report-generator';

interface ReportItemProps {
  report: Report;
  onView: (blob: Blob, type: string, date: Date, sessionId: number, notes?: string) => void;
  onDownload: (blob: Blob, type: string, date: Date, sessionId: number, notes?: string) => void;
}

const ReportItem: React.FC<ReportItemProps> = ({ report, onView, onDownload }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isFinalizing, setIsFinalizing] = useState(false);

  const session = useLiveQuery(() => db.sessions.get(report.sessionId));
  const patient = useLiveQuery(() => session ? db.patients.get(session.patientId) : undefined, [session]);

  if (!session || !patient) return null;

  const handleFinalizeReport = async () => {
    if (!report.id) return;

    if (!confirm('¿Está seguro de que desea finalizar este informe? Esta acción convertirá este informe en final y bloqueará la sesión permanentemente.')) {
      return;
    }

    setIsFinalizing(true);
    try {
      // Get the session and patient data for the report
      const session = await db.sessions.get(report.sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const patient = await db.patients.get(session.patientId);
      if (!patient) {
        throw new Error('Patient not found');
      }

      const images = await db.images.where('sessionId').equals(report.sessionId).toArray();
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
        evaluatorNotes: report.evaluatorNotes,
      };

      const generator = new ReportGenerator();
      const finalPdfBlob = await generator.generateReport(reportData, 'final');

      // Update the existing report to be final (this will overwrite the PDF blob)
      await db.reports.update(report.id, {
        type: 'final',
        pdfBlob: finalPdfBlob,
        generatedAt: new Date(),
      });

      // Lock the session
      await db.sessions.update(report.sessionId, {
        locked: true,
        lockedAt: new Date(),
      });

      // Download the final report automatically
      const url = URL.createObjectURL(finalPdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DIRD_Reporte_FINAL_${report.sessionId}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('Informe finalizado y descargado correctamente. La sesión ha sido bloqueada.');
    } catch (error) {
      console.error('Error finalizing report:', error);
      alert('Error al finalizar el informe');
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-coal-200 rounded-xl hover:shadow-md transition-all group">
      <div className="flex-1 mb-3 sm:mb-0">
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg ${
            report.type === 'final' ? 'bg-accent-50 text-accent-600' : 'bg-primary-50 text-primary-600'
          }`}>
            {report.type === 'final' ? <ShieldCheck className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-bold text-coal-800 flex items-center gap-2">
                <User className="w-4 h-4 text-coal-400" />
                {patient.name}
              </span>
              <Badge variant={report.type === 'final' ? 'default' : 'secondary'} className="text-[10px] uppercase">
                {report.type === 'final' ? t('reports.status.final') : t('reports.status.preliminary')}
              </Badge>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-smoke-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(session.date).toLocaleDateString()}
              </span>
              <span className="hidden sm:inline">•</span>
              <span>
                Sesión #{session.sessionNumber}
              </span>
              {report.evaluatorNotes && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span className="flex items-center gap-1 truncate max-w-[200px] sm:max-w-none" title={report.evaluatorNotes}>
                    <Tag className="w-3.5 h-3.5" />
                    {report.evaluatorNotes}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap sm:flex-nowrap">
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto hover:bg-coal-50 hover:text-coal-900 border-coal-200"
          onClick={() => navigate(`/patients/${patient.id}/sessions/${session.id}`)}
        >
          <ArrowRight className="w-4 h-4 mr-2" />
          Ir a Análisis
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="hover:bg-primary-50 hover:text-primary-700 w-full sm:w-auto"
          onClick={() => onView(report.pdfBlob, report.type, report.generatedAt, report.sessionId, report.evaluatorNotes)}
        >
          <Eye className="w-4 h-4 mr-2" />
          Ver PDF
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="hover:bg-primary-50 hover:text-primary-700 w-full sm:w-auto"
          onClick={() => onDownload(report.pdfBlob, report.type, report.generatedAt, report.sessionId, report.evaluatorNotes)}
        >
          <Download className="w-4 h-4 mr-2" />
          Descargar
        </Button>
        {report.type === 'preview' && !session.locked && (
          <Button
            variant="default"
            size="sm"
            className="hover:bg-accent-600 hover:text-white w-full sm:w-auto bg-accent-500 text-white"
            onClick={handleFinalizeReport}
            disabled={isFinalizing}
          >
            {isFinalizing ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2 animate-spin" />
                Finalizando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Finalizar
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

interface GlobalReportsListProps {}

const GlobalReportsList: React.FC<GlobalReportsListProps> = () => {
  const { t } = useTranslation();
  const [selectedReport, setSelectedReport] = useState<{ blob: Blob; title: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'single' | 'combined'>('all');
  const [showPreliminary, setShowPreliminary] = useState(false);

  const allReports = useLiveQuery(() => 
    db.reports.orderBy('generatedAt').reverse().toArray()
  );

  const filteredReports = allReports?.filter(report => {
    const matchesSearch = report.evaluatorNotes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          report.type.toLowerCase().includes(searchTerm.toLowerCase());

    // Handle type filtering (Drafts vs Finals)
    const matchesStatus = showPreliminary ? true : report.type === 'final';

    // Handle category filtering (Single vs Combined)
    const matchesCategory = filterCategory === 'all' ? true : report.reportCategory === filterCategory;

    const matchesDate = !filterDate ||
      new Date(report.generatedAt).toDateString() === new Date(filterDate).toDateString();

    return matchesSearch && matchesStatus && matchesCategory && matchesDate;
  });

  const handleViewPDF = async (pdfBlob: Blob, type: string, date: Date, sessionId: number, notes?: string) => {
    let blobToUse = pdfBlob;
    if (type === 'preview') {
      try {
        blobToUse = await regenerateSessionReportBlob(sessionId, notes);
      } catch (error) {
        console.error("Error regenerating preview report", error);
      }
    }
    const title = `DIRD_Reporte_${type.toUpperCase()}_Sesion_${sessionId}_${new Date(date).toISOString().split('T')[0]}.pdf`;
    setSelectedReport({ blob: blobToUse, title });
  };

  const handleDownload = async (pdfBlob: Blob, type: string, date: Date, sessionId: number, notes?: string) => {
    let blobToUse = pdfBlob;
    if (type === 'preview') {
      try {
        blobToUse = await regenerateSessionReportBlob(sessionId, notes);
      } catch (error) {
         console.error("Error regenerating preview report", error);
      }
    }
    const url = URL.createObjectURL(blobToUse);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DIRD_Reporte_${type.toUpperCase()}_Sesion_${sessionId}_${new Date(date).toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCloseModal = () => {
    setSelectedReport(null);
  };

  if (!allReports) {
    return <div className="py-8 text-center">{t('ui.loading')}</div>;
  }

  if (allReports.length === 0) {
    return (
      <div className="py-12 text-center border-2 border-dashed border-coal-200 rounded-xl bg-coal-50/50">
        <FileSearch className="w-12 h-12 text-smoke-300 mx-auto mb-4" />
        <p className="text-smoke-600 font-medium">No se han generado informes aún</p>
        <p className="text-smoke-400 text-sm mt-1">
          Los informes generados aparecerán aquí para su revisión.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="relative flex-1 w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-smoke-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Buscar en conclusiones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as 'all' | 'single' | 'combined')}
              className="border border-coal-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="all">Todas las categorías</option>
              <option value="single">Sesiones únicas</option>
              <option value="combined">Sesiones combinadas</option>
            </select>

            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="border border-coal-200 rounded-lg px-3 py-2 text-sm bg-white"
            />
          </div>
        </div>

        {/* Preliminary Reports Toggle */}
        <div className="flex items-center gap-2 p-3 bg-coal-50 rounded-lg">
          <Switch
            id="show-preliminary"
            checked={showPreliminary}
            onCheckedChange={setShowPreliminary}
          />
          <label htmlFor="show-preliminary" className="text-sm font-medium text-coal-700">
            Mostrar informes preliminares
          </label>
        </div>
      </div>

      {/* Reports Count */}
      <div className="text-smoke-600 text-sm">
        {filteredReports?.length} informe{filteredReports?.length !== 1 ? 's' : ''} encontrado{filteredReports?.length !== 1 ? 's' : ''}
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {filteredReports?.map((report) => (
          <ReportItem 
            key={report.id} 
            report={report} 
            onView={handleViewPDF}
            onDownload={handleDownload}
          />
        ))}
      </div>

      {/* PDF Viewer Modal */}
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
    </div>
  );
};

export default GlobalReportsList;