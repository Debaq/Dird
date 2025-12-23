import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, Download, Calendar, Tag, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db } from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ReportsListProps {
  sessionId: number;
  refreshKey?: number;
}

const ReportsList: React.FC<ReportsListProps> = ({ sessionId, refreshKey }) => {
  const { t } = useTranslation();
  
  const reports = useLiveQuery(
    () => db.reports.where('sessionId').equals(sessionId).reverse().sortBy('generatedAt'),
    [sessionId, refreshKey]
  );

  const handleDownload = (pdfBlob: Blob, type: string, date: Date) => {
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DIRD_Reporte_${type.toUpperCase()}_${new Date(date).toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!reports) return <div className="py-8 text-center">{t('ui.loading')}</div>;

  if (reports.length === 0) {
    return (
      <div className="py-12 text-center border-2 border-dashed border-coal-200 rounded-xl bg-coal-50/50">
        <FileText className="w-12 h-12 text-smoke-300 mx-auto mb-4" />
        <p className="text-smoke-600 font-medium">No se han generado informes aún</p>
        <p className="text-smoke-400 text-sm mt-1">
          Utilice el botón "Generar Informe" para crear el primer reporte clínico.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((report) => (
        <div 
          key={report.id}
          className="flex items-center justify-between p-4 bg-white border border-coal-200 rounded-xl hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${
              report.type === 'final' ? 'bg-accent-50 text-accent-600' : 'bg-primary-50 text-primary-600'
            }`}>
              {report.type === 'final' ? <ShieldCheck className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-coal-800">
                  {report.type === 'final' ? t('reports.status.final') : t('reports.status.preliminary')}
                </span>
                <Badge variant={report.type === 'final' ? 'default' : 'secondary'} className="text-[10px] uppercase">
                  {report.type}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-smoke-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(report.generatedAt).toLocaleString()}
                </span>
                {report.evaluatorNotes && (
                  <span className="flex items-center gap-1 truncate max-w-[200px]">
                    <Tag className="w-3.5 h-3.5" />
                    {report.evaluatorNotes}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="hover:bg-primary-50 hover:text-primary-700"
            onClick={() => handleDownload(report.pdfBlob, report.type, report.generatedAt)}
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar PDF
          </Button>
        </div>
      ))}
    </div>
  );
};

export default ReportsList;
