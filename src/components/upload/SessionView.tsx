import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Play, Lock, ChevronRight, Download, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ImageDropzone from './ImageDropzone';
import ImageGallery from './ImageGallery';
import ReportGenerator from '../reports/ReportGenerator';
import { db } from '@/lib/db/schema';
import { exportSession, downloadDirdFile } from '@/lib/export/dird-exporter';
import { inferenceService } from '@/lib/ai/inference-service';
import { useImageUploader } from '@/hooks/useImageUploader';


const CompactUploader: React.FC<{ sessionId: number; onUploadComplete: () => void }> = ({ sessionId, onUploadComplete }) => {
    const {
        selectedEye,
        setSelectedEye,
        triggerFileDialog,
        getHiddenInput,
    } = useImageUploader({ sessionId, onUploadComplete });
    const { t } = useTranslation();

    return (
        <div className="flex items-center gap-2">
            {getHiddenInput()}
            <div className="flex items-center gap-1 bg-coal-100 p-1 rounded-lg">
                <Button size="sm" variant={selectedEye === 'OI' ? 'default' : 'ghost'} onClick={() => setSelectedEye('OI')} className="text-xs">OI</Button>
                <Button size="sm" variant={selectedEye === 'OD' ? 'default' : 'ghost'} onClick={() => setSelectedEye('OD')} className="text-xs">OD</Button>
            </div>
            <Button size="sm" onClick={triggerFileDialog}>
                <Plus className="w-4 h-4 mr-2" />
                {t('upload.addImage')}
            </Button>
        </div>
    );
};

const SessionView: React.FC = () => {
  const { patientId, sessionId } = useParams<{ patientId: string; sessionId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('images');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });

  const session = useLiveQuery(
    () => (sessionId ? db.sessions.get(parseInt(sessionId)) : undefined),
    [sessionId]
  );

  const patient = useLiveQuery(
    () => (patientId ? db.patients.get(parseInt(patientId)) : undefined),
    [patientId]
  );

  const images = useLiveQuery(
    () => (sessionId ? db.images.where('sessionId').equals(parseInt(sessionId)).toArray() : []),
    [sessionId, refreshKey]
  );

  const handleExportSession = async () => {
    if (!sessionId) return;
    setIsExporting(true);
    try {
      const blob = await exportSession(parseInt(sessionId));
      const sessionName = session?.name?.replace(/ /g, '_') || session?.sessionNumber;
      downloadDirdFile(blob, `dird_export_${patient?.patientId}_session_${sessionName}`);
    } catch (error) {
      console.error('Error exporting session:', error);
      alert(t('errors.exportSession'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    if (confirm(t('confirmations.deleteImage'))) {
      try {
        await db.transaction('rw', db.images, db.detections, db.segmentations, async () => {
          await db.detections.where('imageId').equals(imageId).delete();
          await db.segmentations.where('imageId').equals(imageId).delete();
          await db.images.delete(imageId);
        });
        setRefreshKey((prev) => prev + 1);
      } catch (error) {
        console.error('Error deleting image:', error);
        alert(t('errors.deleteImage'));
      }
    }
  };

  const handleUploadComplete = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleProcessWithAI = async () => {
    if (!images || images.length === 0 || !sessionId) return;

    setIsProcessing(true);
    setProcessingProgress({ current: 0, total: images.length });

    try {
      if (!inferenceService.isDetectionModelLoaded()) {
        console.log('Loading detection model from GitHub...');
        // Load model from GitHub (with fallback to local)
        await inferenceService.loadDetectionModel();
        console.log('Model loaded successfully');
      }

      const imageIds = images.map(img => img.id).filter(id => id !== undefined) as number[];
      for (const imageId of imageIds) {
        const existingDetections = await db.detections
          .where('imageId')
          .equals(imageId)
          .and(d => d.type === 'ai')
          .toArray();

        for (const det of existingDetections) {
          if (det.id) await db.detections.delete(det.id);
        }
      }

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        setProcessingProgress({ current: i + 1, total: images.length });
        const imageUrl = URL.createObjectURL(image.originalBlob);
        const imgElement = new Image();
        await new Promise((resolve, reject) => {
          imgElement.onload = resolve;
          imgElement.onerror = reject;
          imgElement.src = imageUrl;
        });

        if (image.id) {
          await inferenceService.detectObjects(imgElement, image.id);
        }
        URL.revokeObjectURL(imageUrl);
      }

      await db.sessions.update(parseInt(sessionId), {
        modelVersions: {
          detection: 'DIRDv1r1',
          segmentation: session?.modelVersions?.segmentation,
        },
      });

      alert(t('processing.complete'));
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('Error processing images:', error);
      alert(t('errors.processingImages', { error: (error as Error).message }));
    } finally {
      setIsProcessing(false);
      setProcessingProgress({ current: 0, total: 0 });
    }
  };

  if (!session || !patient || !images) {
    return <div>{t('ui.loading')}</div>;
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const showLargeDropzone = images.length === 0 && !session.locked;

  return (
    <div className="space-y-6">
      <nav className="flex items-center space-x-2 text-sm text-smoke-600">
        <Link to="/patients" className="hover:text-primary-600 transition-colors">{t('patients.title')}</Link>
        <ChevronRight className="w-4 h-4" />
        <Link to={`/patients/${patientId}`} className="hover:text-primary-600 transition-colors">{patient.name}</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-coal-800 font-medium">{session.name || `${t('sessions.session')} ${session.sessionNumber}`}</span>
      </nav>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={() => navigate(`/patients/${patientId}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-coal-800">{session.name || `${t('sessions.session')} ${session.sessionNumber}`}</h1>
            <p className="text-smoke-500 mt-1">{patient.name} - {formatDate(session.date)}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleExportSession} disabled={isExporting}>
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? t('export.exporting') : t('export.session')}
          </Button>
          {session.locked ? (
            <span className="flex items-center text-sm text-accent-600 bg-accent-50 px-3 py-1 rounded-full">
              <Lock className="w-4 h-4 mr-1" />{t('sessions.locked')}
            </span>
          ) : (
            <ReportGenerator sessionId={parseInt(sessionId!)} onReportGenerated={() => setRefreshKey((prev) => prev + 1)} />
          )}
        </div>
      </div>

      {session.notes && (
        <Card>
          <CardHeader><CardTitle>{t('sessions.notesTitle')}</CardTitle></CardHeader>
          <CardContent><p className="text-smoke-700">{session.notes}</p></CardContent>
        </Card>
      )}

      {showLargeDropzone && (
          <ImageDropzone sessionId={parseInt(sessionId!)} onUploadComplete={handleUploadComplete} />
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="images">{t('sessions.tabs.images', { count: images?.length || 0 })}</TabsTrigger>
          <TabsTrigger value="analysis">{t('sessions.tabs.analysis')}</TabsTrigger>
          <TabsTrigger value="report">{t('sessions.tabs.report')}</TabsTrigger>
        </TabsList>

        <TabsContent value="images" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('sessions.galleryTitle')}</CardTitle>
                <div className="flex items-center gap-4">
                    {images.length > 0 && !session.locked && (
                        <CompactUploader sessionId={parseInt(sessionId!)} onUploadComplete={handleUploadComplete} />
                    )}
                    {images.length > 0 && !session.locked && (
                        <Button
                            onClick={handleProcessWithAI}
                            disabled={isProcessing}
                        >
                            <Play className="w-4 h-4 mr-2" />
                            <span>
                            {isProcessing
                                ? t('processing.inProgress', { current: processingProgress.current, total: processingProgress.total })
                                : t('processing.start')}
                            </span>
                        </Button>
                    )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ImageGallery
                images={images}
                patientId={patientId!}
                sessionId={sessionId!}
                onDelete={!session.locked ? handleDeleteImage : undefined}
                isLocked={session.locked}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis">
          <Card><CardContent className="py-12 text-center"><p className="text-smoke-500">{t('ui.comingSoon.analysis')}</p></CardContent></Card>
        </TabsContent>

        <TabsContent value="report">
          <Card><CardContent className="py-12 text-center"><p className="text-smoke-500">{t('ui.comingSoon.reports')}</p></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SessionView;