import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Play, Lock, ChevronRight, Download, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import ImageDropzone from './ImageDropzone';
import ImageGallery from './ImageGallery';
import ReportGenerator from '../reports/ReportGenerator';
import ReportsList from '../reports/ReportsList';
import AnalysisView from './AnalysisView';
import UploadProgressModal from './UploadProgressModal';
import { db } from '@/lib/db/schema';
import { exportSession, downloadDirdFile } from '@/lib/export/dird-exporter';
import { inferenceService } from '@/lib/ai/inference-service';
import { useImageUploader } from '@/hooks/useImageUploader';
import { usePatientStore } from '@/stores/patient-store';


const CompactUploader: React.FC<{ sessionId: number; onUploadComplete: () => void; onUploadStart: () => void }> = ({ sessionId, onUploadComplete, onUploadStart }) => {
    const {
        selectedEye,
        setSelectedEye,
        uploadingFiles,
        clearUploadState,
        triggerFileDialog,
        getHiddenInput,
    } = useImageUploader({ sessionId, onUploadComplete, onUploadStart });
    const { t } = useTranslation();
    const [isLimitReached, setIsLimitReached] = useState(false);

    // Check image count on component mount and when sessionId changes
    useEffect(() => {
        const fetchImageCount = async () => {
            const count = await db.images.where('sessionId').equals(sessionId).count();
            setIsLimitReached(count >= 20);
        };

        fetchImageCount();
    }, [sessionId]);

    return (
        <>
            <div className="flex items-center gap-2">
                {getHiddenInput()}
                <div className="flex items-center gap-1 bg-coal-100 p-1 rounded-lg">

                    <Button
                        size="sm"
                        variant={selectedEye === 'OD' ? 'default' : 'ghost'}
                        onClick={() => setSelectedEye('OD')}
                        className="text-xs"
                        disabled={isLimitReached}
                    >
                        OD
                    </Button>                    
                    <Button
                        size="sm"
                        variant={selectedEye === 'OI' ? 'default' : 'ghost'}
                        onClick={() => setSelectedEye('OI')}
                        className="text-xs"
                        disabled={isLimitReached}
                    >
                        OI
                    </Button>
                </div>
                <Button size="sm" onClick={triggerFileDialog} disabled={isLimitReached}>
                    <Plus className="w-4 h-4 mr-2" />
                    {isLimitReached ? t('upload.photoLimitExceeded', { limit: 20 }) : t('upload.addImage')}
                </Button>
            </div>
            <UploadProgressModal
                uploadingFiles={uploadingFiles}
                onClose={clearUploadState}
                onComplete={onUploadComplete}
            />
        </>
    );
};

const SessionView: React.FC = () => {
  const { patientId, sessionId } = useParams<{ patientId: string; sessionId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const { sessionViewTab, setSessionViewTab } = usePatientStore();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [isUploading, setIsUploading] = useState(false);

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
      toast.success(t('export.sessionSuccess'));
    } catch (error) {
      toast.error(t('errors.exportSession'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    const confirmed = await confirm({
      title: t('confirmations.deleteImageTitle') || t('upload.deleteImage'),
      description: t('confirmations.deleteImage'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      variant: 'destructive',
    });

    if (confirmed) {
      try {
        await db.transaction('rw', db.images, db.detections, db.segmentations, async () => {
          await db.detections.where('imageId').equals(imageId).delete();
          await db.segmentations.where('imageId').equals(imageId).delete();
          await db.images.delete(imageId);
        });
        setRefreshKey((prev) => prev + 1);
        toast.success(t('upload.deleteImageSuccess'));
      } catch (error) {
        toast.error(t('errors.deleteImage'));
      }
    }
  };

  const handleUploadComplete = () => {
    setIsUploading(false);
    setRefreshKey((prev) => prev + 1);
    setSessionViewTab('images');
  };

  const handleUploadStart = () => {
    setIsUploading(true);
    return isUploading;
  };

  const handleProcessWithAI = async () => {
    if (!images || images.length === 0 || !sessionId) return;

    setIsProcessing(true);
    setProcessingProgress({ current: 0, total: images.length });

    try {
      if (!inferenceService.isDetectionModelLoaded()) {
        // Load model from GitHub (with fallback to local)
        await inferenceService.loadDetectionModel();
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

      let totalDetections = 0;
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
          const detections = await inferenceService.detectObjects(imgElement, image.id);
          totalDetections += detections.length;

        }
        URL.revokeObjectURL(imageUrl);
      }

      await db.sessions.update(parseInt(sessionId), {
        modelVersions: {
          detection: 'DIRDv1r1',
          segmentation: session?.modelVersions?.segmentation,
        },
      });

      setRefreshKey((prev) => prev + 1);

      // Cambiar automáticamente a la pestaña de análisis
      setSessionViewTab('analysis');
    } catch (error) {
      toast.error(t('errors.processingImages', { error: (error as Error).message }));
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

  const showLargeDropzone = !session.locked;

  return (
    <>
      <div className="space-y-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-smoke-600">
          <Link to="/patients" className="hover:text-primary-600 transition-colors whitespace-nowrap">{t('patients.title')}</Link>
          <ChevronRight className="w-4 h-4 flex-shrink-0" />
          <Link to={`/patients/${patientId}`} className="hover:text-primary-600 transition-colors whitespace-nowrap">{patient.name}</Link>
          <ChevronRight className="w-4 h-4 flex-shrink-0" />
          <span className="text-coal-800 font-medium whitespace-nowrap">{session.name || `${t('sessions.session')} ${session.sessionNumber}`}</span>
        </nav>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="icon" onClick={() => navigate(`/patients/${patientId}`)} className="flex-shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-coal-800 truncate">{session.name || `${t('sessions.session')} ${session.sessionNumber}`}</h1>
              <p className="text-smoke-500 mt-1 truncate">{patient.name} - {formatDate(session.date)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExportSession} disabled={isExporting} className="flex-1 md:flex-none">
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? t('export.exporting') : t('export.session')}
            </Button>
            {session.locked && (
              <span className="flex items-center text-sm text-accent-600 bg-accent-50 px-3 py-1 rounded-full whitespace-nowrap">
                <Lock className="w-4 h-4 mr-1" />{t('sessions.locked')}
              </span>
            )}
          </div>
        </div>

        {session.notes && (
          <Card>
            <CardHeader><CardTitle>{t('sessions.notesTitle')}</CardTitle></CardHeader>
            <CardContent><p className="text-smoke-700">{session.notes}</p></CardContent>
          </Card>
        )}


        <Tabs value={sessionViewTab} onValueChange={setSessionViewTab} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide h-auto p-1 gap-1">
            <TabsTrigger value="images" className="flex-shrink-0">{t('sessions.tabs.images', { count: images?.length || 0 })}</TabsTrigger>
            <TabsTrigger value="analysis" className="flex-shrink-0">{t('sessions.tabs.analysis')}</TabsTrigger>
            <TabsTrigger value="report" className="flex-shrink-0">{t('sessions.tabs.report')}</TabsTrigger>
          </TabsList>

          <TabsContent value="images" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle>{t('sessions.galleryTitle')}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">

                      {images.length > 0 && !session.locked && (
                          <CompactUploader
                            sessionId={parseInt(sessionId!)}
                            onUploadComplete={handleUploadComplete}
                            onUploadStart={handleUploadStart}
                          />
                      )}
                      
                      {images.length > 0 && !session.locked && (
                          <Button
                              onClick={handleProcessWithAI}
                              disabled={isProcessing}
                              className="h-auto min-h-[40px] py-2 whitespace-normal text-center leading-tight"
                          >
                              <Play className="w-4 h-4 mr-2 flex-shrink-0" />
                              <span>
                              {isProcessing
                                  ? t('processing.inProgress', { current: processingProgress.current, total: processingProgress.total })
                                  : t('processing.start')}
                              </span>
                          </Button>
                      )}
                  </div>
                </div>

                {showLargeDropzone && images.length < 1 && (
                  <ImageDropzone
                    sessionId={parseInt(sessionId!)}
                    onUploadComplete={handleUploadComplete}
                    onUploadStart={handleUploadStart}
                  />
                )}

              </CardHeader>
              <CardContent>
                <ImageGallery
                  images={images}
                  patientId={patientId!}
                  sessionId={sessionId!}
                  onDelete={!session.locked ? handleDeleteImage : undefined}
                  isLocked={session.locked}
                  refreshKey={refreshKey}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis">
            <AnalysisView
              images={images}
              sessionId={parseInt(sessionId!)}
              patientId={patientId!}
              refreshKey={refreshKey}
            />
          </TabsContent>

          <TabsContent value="report">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{t('sessions.reportHistory.title')}</CardTitle>
                      <p className="text-sm text-smoke-500 mt-1">
                        {t('sessions.reportHistory.description')}
                      </p>
                    </div>
                    {!session.locked && (
                      <ReportGenerator
                        sessionId={parseInt(sessionId!)}
                        onReportGenerated={() => setRefreshKey((prev) => prev + 1)}
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ReportsList sessionId={parseInt(sessionId!)} refreshKey={refreshKey} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal de progreso de procesamiento AI */}
        <Dialog open={isProcessing} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md" onPointerDown={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle className="text-center">{t('processing.title')}</DialogTitle>
              <DialogDescription className="text-center">
                {t('processing.description')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary-600">
                  {processingProgress.current} / {processingProgress.total}
                </p>
                <p className="text-sm text-smoke-500 mt-1">
                  {t('processing.imagesProcessed')}
                </p>
              </div>
              <Progress
                value={(processingProgress.current / processingProgress.total) * 100}
                className="h-2"
              />
              <p className="text-xs text-center text-smoke-500">
                {t('processing.pleaseWait')}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {ConfirmDialogComponent}
    </>
  );
};

export default SessionView;