import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, Download, Calendar, Tag, ShieldCheck, Eye, Search, Filter, FileSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db } from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PDFViewerModal from './PDFViewerModal';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface GlobalReportsListProps {}

const GlobalReportsList: React.FC<GlobalReportsListProps> = () => {
  const { t } = useTranslation();
  const [selectedReport, setSelectedReport] = useState<{ blob: Blob; title: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'preview' | 'final'>('final'); // Changed default to 'final'
  const [filterDate, setFilterDate] = useState<string>('');
  const [showPreliminary, setShowPreliminary] = useState(false); // New state for preliminary reports toggle

  const allReports = useLiveQuery(() => 
    db.reports.orderBy('generatedAt').reverse().toArray()
  );

  const filteredReports = allReports?.filter(report => {
    const matchesSearch = report.evaluatorNotes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          report.type.toLowerCase().includes(searchTerm.toLowerCase());

    // Handle type filtering considering the preliminary reports toggle
    let matchesType = false;

    if (filterType === 'all') {
      // If showing all types, check if preliminary reports should be shown
      matchesType = showPreliminary ? true : report.type !== 'preview';
    } else if (filterType === 'final') {
      // If filtering for final reports only
      matchesType = report.type === 'final';
    } else if (filterType === 'preview') {
      // If filtering for preview reports only, check if preliminary reports should be shown
      matchesType = showPreliminary && report.type === 'preview';
    }

    const matchesDate = !filterDate ||
      new Date(report.generatedAt).toDateString() === new Date(filterDate).toDateString();

    return matchesSearch && matchesType && matchesDate;
  });

  const handleViewPDF = (pdfBlob: Blob, type: string, date: Date, sessionId: number) => {
    const title = `DIRD_Reporte_${type.toUpperCase()}_Sesion_${sessionId}_${new Date(date).toISOString().split('T')[0]}.pdf`;
    setSelectedReport({ blob: pdfBlob, title });
  };

  const handleDownload = (pdfBlob: Blob, type: string, date: Date, sessionId: number) => {
    const url = URL.createObjectURL(pdfBlob);
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
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'preview' | 'final')}
              className="border border-coal-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="all">Todos los tipos</option>
              <option value="preview">Borradores</option>
              <option value="final">Finales</option>
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
          <div
            key={report.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-coal-200 rounded-xl hover:shadow-md transition-all group"
          >
            <div className="flex-1 mb-3 sm:mb-0">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${
                  report.type === 'final' ? 'bg-accent-50 text-accent-600' : 'bg-primary-50 text-primary-600'
                }`}>
                  {report.type === 'final' ? <ShieldCheck className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-coal-800">
                      {report.type === 'final' ? t('reports.status.final') : t('reports.status.preliminary')}
                    </span>
                    <Badge variant={report.type === 'final' ? 'default' : 'secondary'} className="text-[10px] uppercase">
                      {report.type}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      Sesión #{report.sessionId}
                    </Badge>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-smoke-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(report.generatedAt).toLocaleString()}
                    </span>
                    {report.evaluatorNotes && (
                      <span className="flex items-center gap-1 truncate max-w-[200px] sm:max-w-none">
                        <Tag className="w-3.5 h-3.5" />
                        {report.evaluatorNotes}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-primary-50 hover:text-primary-700 w-full sm:w-auto"
                onClick={() => handleViewPDF(report.pdfBlob, report.type, report.generatedAt, report.sessionId)}
              >
                <Eye className="w-4 h-4 mr-2" />
                Ver PDF
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-primary-50 hover:text-primary-700 w-full sm:w-auto"
                onClick={() => handleDownload(report.pdfBlob, report.type, report.generatedAt, report.sessionId)}
              >
                <Download className="w-4 h-4 mr-2" />
                Descargar
              </Button>
            </div>
          </div>
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
            // Extract type and session from title (e.g., "DIRD_Reporte_FINAL_Sesion_123_2025-01-01.pdf")
            const parts = selectedReport.title.split('_');
            const type = parts[2].replace('.pdf', '').toLowerCase();
            const sessionId = parseInt(parts[4]); // Assuming format is "Sesion_123"
            handleDownload(selectedReport.blob, type, new Date(), sessionId);
          }}
        />
      )}
    </div>
  );
};

export default GlobalReportsList;