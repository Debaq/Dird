import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { db, Session, Image, Detection } from '@/lib/db/schema';
import { generateCombinedReport } from '@/lib/pdf/report-generator';
import PDFViewerModal from '@/components/reports/PDFViewerModal';

interface SessionData {
  session: Session;
  images: Image[];
  detections: Detection[];
}

const SessionImage: React.FC<{ blob: Blob; alt: string }> = ({ blob, alt }) => {
  const [src, setSrc] = useState<string>('');

  useEffect(() => {
    const url = URL.createObjectURL(blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  if (!src) return <div className="w-full h-full bg-smoke-100 animate-pulse" />;

  return (
    <img 
        src={src} 
        alt={alt}
        className="w-full h-full object-contain"
    />
  );
};

const SessionComparison: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [sessionsData, setSessionsData] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReportPreview, setShowReportPreview] = useState(false);
  const [previewPdfBlob, setPreviewPdfBlob] = useState<Blob | null>(null);
  const [evaluatorNotes, setEvaluatorNotes] = useState('');

  const sessionIds = searchParams.get('sessions')?.split(',').map(Number) || [];

  const patient = useLiveQuery(
    () => (patientId ? db.patients.get(parseInt(patientId)) : undefined),
    [patientId]
  );

  useEffect(() => {
    const fetchData = async () => {
      if (sessionIds.length === 0) return;
      
      try {
        const data = await Promise.all(
          sessionIds.map(async (id) => {
            const session = await db.sessions.get(id);
            if (!session) return null;
            
            const images = await db.images.where('sessionId').equals(id).toArray();
            const detections = await Promise.all(
                images.map(img => db.detections.where('imageId').equals(img.id!).toArray())
            );
            
            return {
              session,
              images,
              detections: detections.flat()
            };
          })
        );
        
        const validData = data.filter((d): d is SessionData => d !== null);
        // Sort by date
        validData.sort((a, b) => new Date(a.session.date).getTime() - new Date(b.session.date).getTime());
        
        setSessionsData(validData);
      } catch (e) {
        console.error("Error fetching comparison data", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [searchParams]);

  const handleGenerateReport = async () => {
    if (sessionsData.length === 0) return;
    try {
        const blob = await generateCombinedReport(
            sessionsData.map(d => d.session.id!), 
            'preview',
            evaluatorNotes
        );
        setPreviewPdfBlob(blob);
        setShowReportPreview(true);
    } catch (e) {
        console.error("Error generating report", e);
        alert(t('errors.imageProcessing'));
    }
  };

  const handleDownloadFinalReport = async () => {
     if (sessionsData.length === 0) return;
     try {
         const blob = await generateCombinedReport(
             sessionsData.map(d => d.session.id!),
             'final',
             evaluatorNotes
         );
         
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         const filename = `Reporte_Evolutivo_${patient?.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
         a.download = filename;
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         URL.revokeObjectURL(url);
         
         setShowReportPreview(false);
     } catch (e) {
         console.error("Error downloading final report", e);
         alert(t('errors.imageProcessing'));
     }
  };

  if (loading || !patient) {
    return <div className="p-8 text-center">{t('ui.loading')}</div>;
  }

  // Render Logic
  const eyeTypes = ['OI', 'OD'] as const;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={() => navigate(`/patients/${patientId}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-coal-800">
              {t('sessions.compareTitle')}
            </h1>
            <p className="text-smoke-500">{patient.name}</p>
          </div>
        </div>
        <Button onClick={handleGenerateReport}>
            <FileText className="w-4 h-4 mr-2" />
            {t('reports.generate')}
        </Button>
      </div>

      {/* Comparison Grid */}
      <div className="space-y-8">
        {eyeTypes.map(eyeType => (
            <div key={eyeType} className="space-y-4">
                <h3 className="text-lg font-bold text-accent-600 border-b border-accent-100 pb-2">
                    {eyeType === 'OI' ? t('upload.eye.left') : t('upload.eye.right')}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-x-auto pb-4">
                    {sessionsData.map((data) => {
                        const img = data.images.find(i => i.eyeType === eyeType);
                        return (
                            <Card key={data.session.id} className="min-w-[250px]">
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="font-medium text-coal-800">
                                            {new Date(data.session.date).toLocaleDateString()}
                                        </span>
                                        <span className="text-smoke-500 text-xs">
                                            Sesión {data.session.sessionNumber}
                                        </span>
                                    </div>
                                    
                                    <div className="aspect-[4/3] bg-smoke-100 rounded-md overflow-hidden relative border border-smoke-200">
                                        {img ? (
                                            <SessionImage 
                                                blob={img.originalBlob} 
                                                alt={`${eyeType} - ${data.session.date}`} 
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-smoke-400 text-sm italic">
                                                {t('upload.noImage')}
                                            </div>
                                        )}
                                    </div>

                                    {/* Stats / Detections Summary */}
                                    {img && (
                                        <div className="text-xs text-smoke-600">
                                            {(() => {
                                                const dets = data.detections.filter(d => d.imageId === img.id && d.visible);
                                                return dets.length > 0 
                                                    ? t('analysis.findingsFound', { count: dets.length })
                                                    : t('analysis.noFindings');
                                            })()}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        ))}
      </div>

      {/* Notes Section for Report */}
      <Card>
          <CardContent className="p-6">
              <label className="block text-sm font-medium text-coal-800 mb-2">
                  {t('reports.evaluatorNotes')}
              </label>
              <textarea
                  className="w-full min-h-[100px] p-3 border border-smoke-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-y"
                  placeholder={t('reports.evaluatorNotesPlaceholder')}
                  value={evaluatorNotes}
                  onChange={(e) => setEvaluatorNotes(e.target.value)}
              />
          </CardContent>
      </Card>

      {/* PDF Viewer Modal */}
      <PDFViewerModal 
        open={showReportPreview}
        onOpenChange={setShowReportPreview}
        pdfBlob={previewPdfBlob}
        onDownload={handleDownloadFinalReport}
      />
    </div>
  );
};

export default SessionComparison;
