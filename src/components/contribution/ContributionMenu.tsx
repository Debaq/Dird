import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Github, Coffee, Send, Image as ImageIcon, MessageSquare, BookOpen, BrainCircuit, AlertTriangle, Star } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { db, type Image, type PendingContribution, type ImageClassification } from '@/lib/db/schema';
import { API_ENDPOINTS } from '@/config/api';
import { getInstallationToken } from '@/lib/utils/installation';
import { paintedPixelsToMask } from '@/lib/utils/segmentation-converter';

const ImageThumbnail: React.FC<{ image: Image }> = ({ image }) => {
  const [src, setSrc] = useState<string>('');

  useEffect(() => {
    const url = URL.createObjectURL(image.originalBlob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  if (!src) return <div className="w-full h-full bg-gray-200 animate-pulse" />;

  return (
    <img src={src} alt={image.filename} className="w-full h-full object-cover" />
  );
};

const ContributionMenu: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [comment, setComment] = useState('');
  const [selectedComponent, setSelectedComponent] = useState<'dird' | 'dird-models'>('dird');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Query pending contributions
  const pendingContributions = useLiveQuery(
    () => db.pendingContributions.where('status').equals('pending').toArray()
  );

  // Group by type
  const imageContributions = pendingContributions?.filter(c => c.type === 'image') || [];
  const guidelineContributions = pendingContributions?.filter(c => c.type === 'guideline') || [];
  const conclusionContributions = pendingContributions?.filter(c => c.type === 'conclusion') || [];

  const totalContributions = imageContributions.length + guidelineContributions.length + conclusionContributions.length;

  const handleNavigateToImage = async (imageId: number) => {
    try {
      const image = await db.images.get(imageId);
      if (!image) return;
      const session = await db.sessions.get(image.sessionId);
      if (!session) return;
      navigate(`/patients/${session.patientId}/sessions/${session.id}/images/${image.id}`);
    } catch (error) {
      // Error handling without logging
    }
  };

  const handleNavigateToGuideline = () => {
    // Navigate to settings where guidelines can be edited
    navigate('/settings?tab=guidelines');
  };

  const handleNavigateToConclusion = async (classificationId: number) => {
    try {
      const classification = await db.imageClassifications.get(classificationId);
      if (!classification) return;
      const image = await db.images.get(classification.imageId);
      if (!image) return;
      const session = await db.sessions.get(image.sessionId);
      if (!session) return;
      navigate(`/patients/${session.patientId}/sessions/${session.id}/images/${image.id}`);
    } catch (error) {
      // Error handling without logging
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Logic for submitting comments
    toast.success(t('contribution.feedback.success'));
    setComment('');
  };

  const handleMarkAllModified = async () => {
    try {
      // Get all images
      const allImages = await db.images.toArray();

      let markedCount = 0;
      for (const img of allImages) {
        // Check if image has manual detections or manual segmentations
        const manualDetections = await db.detections
          .where({ imageId: img.id!, type: 'manual' })
          .count();

        const manualSegmentations = await db.segmentations
          .where({ imageId: img.id!, type: 'manual' })
          .count();

        const hasManualAnnotations = manualDetections > 0 || manualSegmentations > 0;

        if (hasManualAnnotations) {
          // Check if already marked
          const existing = await db.pendingContributions
            .where({ type: 'image', referenceId: img.id! })
            .first();

          if (!existing) {
            await db.pendingContributions.add({
              type: 'image',
              referenceId: img.id!,
              status: 'pending',
              createdAt: new Date(),
            });
            markedCount++;
          }
        }
      }

      if (markedCount > 0) {
        toast.success(`${markedCount} imágenes modificadas marcadas para contribuir`);
      } else {
        toast.info('No se encontraron imágenes con modificaciones manuales');
      }
    } catch (error) {
      toast.error('Error al marcar imágenes');
    }
  };

  const handleSubmitContributions = async () => {
    if (!acceptedTerms) return;
    if (totalContributions === 0) return;

    setIsSubmitting(true);
    setUploadProgress(0);

    const installationToken = getInstallationToken();
    let successCount = 0;
    let errorCount = 0;
    let currentProgress = 0;

    try {
      // 1. Submit images
      for (const contrib of imageContributions) {
        try {
          const img = await db.images.get(contrib.referenceId);
          if (!img) throw new Error('Image not found');

          // Get session info for metadata
          const session = await db.sessions.get(img.sessionId);

          // Gather all annotations for this image
          const detections = await db.detections.where('imageId').equals(img.id!).toArray();
          const segmentations = await db.segmentations.where('imageId').equals(img.id!).toArray();
          const measurements = await db.measurements.where('imageId').equals(img.id!).toArray();
          const classification = await db.imageClassifications.where('imageId').equals(img.id!).first();

          // Convert painted pixels from detections to segmentations
          const paintedSegmentations: any[] = [];
          for (const detection of detections) {
            if (detection.metadata?.paintedPixels && Array.isArray(detection.metadata.paintedPixels)) {
              const maskData = paintedPixelsToMask(
                detection.metadata.paintedPixels,
                img.width,
                img.height
              );

              if (maskData) {
                paintedSegmentations.push({
                  type: 'manual',
                  class: detection.class, // optic_disc or optic_cup
                  maskData: maskData,
                  confidence: null,
                  customLabel: `Painted ${detection.class}`,
                  source: 'painted_pixels'
                });
              }
            }
          }

          // Build complete annotation data
          const annotationData = {
            image: {
              filename: img.filename,
              eyeType: img.eyeType,
              width: img.width,
              height: img.height,
              uploadedAt: img.uploadedAt
            },
            detections: detections.map(d => ({
              type: d.type,
              bbox: d.bbox,
              class: d.class,
              confidence: d.confidence,
              customLabel: d.customLabel,
              metadata: d.metadata
            })),
            segmentations: [
              ...segmentations.map(s => ({
                type: s.type,
                class: s.class,
                maskData: s.maskData,
                confidence: s.confidence,
                customLabel: s.customLabel
              })),
              ...paintedSegmentations
            ],
            measurements: measurements.map(m => ({
              originX: m.originX,
              originY: m.originY,
              destinationX: m.destinationX,
              destinationY: m.destinationY,
              distancePixels: m.distancePixels,
              distanceDD: m.distanceDD
            })),
            classification: classification ? {
              eyeType: classification.eyeType,
              severity: classification.severity,
              confidence: classification.confidence,
              lesions: classification.lesions,
              guideline: classification.guideline,
              guidelineName: classification.guidelineName,
              guidelineVersion: classification.guidelineVersion,
              treatments: classification.treatments,
              followupDays: classification.followupDays,
              urgency: classification.urgency,
              manuallyModified: classification.manuallyModified
            } : null
          };

          const formData = new FormData();
          formData.append('type', 'image');
          formData.append('installation_token', installationToken);

          // Add session metadata
          if (session) {
            formData.append('session_id', session.id!.toString());
            formData.append('session_name', session.name || `Session ${session.sessionNumber}`);
            formData.append('session_date', session.date.toString());
            console.log(session.date.toString());
          }

          formData.append('image', img.originalBlob, img.filename);

          const jsonBlob = new Blob([JSON.stringify(annotationData, null, 2)], { type: 'application/json' });
          formData.append('json', jsonBlob, `${img.filename.split('.')[0]}.json`);

          const response = await fetch(API_ENDPOINTS.CONTRIBUTE, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) throw new Error(`Failed to upload ${img.filename}`);

          await db.pendingContributions.update(contrib.id!, { status: 'submitted' });
          successCount++;
        } catch (err) {
          console.log(err);
          errorCount++;
        }

        currentProgress++;
        setUploadProgress(Math.round((currentProgress / totalContributions) * 100));
      }

      // 2. Submit guidelines
      for (const contrib of guidelineContributions) {
        try {
          const formData = new FormData();
          formData.append('type', 'guideline');
          formData.append('installation_token', installationToken);

          // Guidelines are stored in metadata as JSON
          const guidelineData = contrib.metadata || {};
          const jsonBlob = new Blob([JSON.stringify(guidelineData, null, 2)], { type: 'application/json' });
          formData.append('json', jsonBlob, `guideline_${contrib.id}.json`);

          const response = await fetch(API_ENDPOINTS.CONTRIBUTE, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) throw new Error('Failed to upload guideline');

          await db.pendingContributions.update(contrib.id!, { status: 'submitted' });
          successCount++;
        } catch (err) {
          console.log(err);
          errorCount++;
        }

        currentProgress++;
        setUploadProgress(Math.round((currentProgress / totalContributions) * 100));
      }

      // 4. Submit conclusions
      for (const contrib of conclusionContributions) {
        try {
          const classification = await db.imageClassifications.get(contrib.referenceId);
          if (!classification) throw new Error('Classification not found');

          const formData = new FormData();
          formData.append('type', 'conclusion');
          formData.append('installation_token', installationToken);

          const jsonBlob = new Blob([JSON.stringify(classification, null, 2)], { type: 'application/json' });
          formData.append('json', jsonBlob, `conclusion_${contrib.id}.json`);

          const response = await fetch(API_ENDPOINTS.CONTRIBUTE, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) throw new Error('Failed to upload conclusion');

          await db.pendingContributions.update(contrib.id!, { status: 'submitted' });
          successCount++;
        } catch (err) {
          errorCount++;
          console.log(err);
        }

        currentProgress++;
        setUploadProgress(Math.round((currentProgress / totalContributions) * 100));
      }

      // Small delay to let the user see the 100% bar
      await new Promise(resolve => setTimeout(resolve, 500));

      if (successCount > 0) {
        const message = errorCount > 0
          ? `¡Gracias! Se enviaron ${successCount} contribuciones exitosamente (${errorCount} fallaron).`
          : `¡Gracias! Se enviaron ${successCount} contribuciones exitosamente.`;
        toast.success(message);
        setAcceptedTerms(false);
      } else if (errorCount > 0) {
        toast.error('Hubo errores al enviar las contribuciones.');
      }

    } catch (error) {
      toast.error('Error general al enviar las contribuciones');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl dark:text-gray-100">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-coal-800 dark:text-gray-100 flex items-center gap-3">
          <Coffee className="h-8 w-8 text-amber-500" />
          {t('contribution.title')}
        </h1>
        <p className="text-smoke-600 dark:text-gray-400 mt-2">
          {t('contribution.description')}
        </p>
      </div>

      {/* GitHub Links Section */}
      <Card className="p-6 mb-8 dark:bg-dark-surface dark:border-coal-700">
        <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4 flex items-center gap-2">
          <Github className="h-5 w-5" />
          {t('contribution.github.title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="https://github.com/debaq/dird"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 border border-coal-200 rounded-lg hover:bg-ice dark:border-coal-600 dark:hover:bg-dark-background transition-colors"
          >
            <div>
              <h3 className="font-medium text-coal-800 dark:text-dark-text">Dird App</h3>
              <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
                {t('contribution.github.appDescription')}
              </p>
            </div>
            <Github className="h-5 w-5 text-gray-500" />
          </a>
          <a
            href="https://github.com/Debaq/dird_models"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 border border-coal-200 rounded-lg hover:bg-ice dark:border-coal-600 dark:hover:bg-dark-background transition-colors"
          >
            <div>
              <h3 className="font-medium text-coal-800 dark:text-dark-text">Dird Models</h3>
              <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
                {t('contribution.github.modelsDescription')}
              </p>
            </div>
            <Github className="h-5 w-5 text-gray-500" />
          </a>
        </div>
      </Card>

      {/* Coffee Donation Section */}
      <Card className="p-6 mb-8 dark:bg-dark-surface dark:border-coal-700">
        <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4 flex items-center gap-2">
          <Coffee className="h-5 w-5 text-amber-500" />
          {t('contribution.donation.title')}
        </h2>
        <p className="text-smoke-600 dark:text-dark-textSecondary mb-4">
          {t('contribution.donation.description')}
        </p>
        <a
          href="https://ko-fi.com/tecmedhub"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button className="bg-amber-500 hover:bg-amber-600 text-white">
            <Coffee className="h-4 w-4 mr-2" />
            {t('contribution.donation.button')}
          </Button>
        </a>
      </Card>

      {/* Quick Action: Mark All Modified */}
      <Card className="p-6 mb-8 dark:bg-dark-surface dark:border-coal-700 border-l-4 border-l-blue-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-coal-800 dark:text-dark-text mb-2 flex items-center gap-2">
              <Star className="h-5 w-5 text-blue-600" />
              Marcar Todas las Modificadas
            </h2>
            <p className="text-sm text-smoke-600 dark:text-gray-400">
              Marca automáticamente todas las imágenes que tienen anotaciones manuales (detecciones, segmentaciones pintadas o modificaciones).
            </p>
          </div>
          <Button
            onClick={handleMarkAllModified}
            className="bg-blue-500 hover:bg-blue-600 text-white ml-4"
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            Marcar Todas
          </Button>
        </div>
      </Card>

      {/* Pending Contributions Section */}
      {totalContributions > 0 && (
        <Card className="p-6 mb-8 dark:bg-dark-surface dark:border-coal-700 border-l-4 border-l-amber-500">
          <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4 flex items-center gap-2">
            <Send className="h-5 w-5 text-amber-600" />
            {t('contribution.all.pendingContributions')}
          </h2>

          {/* Images */}
          {imageContributions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-coal-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                {t('contribution.images.title')} ({imageContributions.length})
              </h3>
              <p className="text-sm text-smoke-600 dark:text-gray-400 mb-4">
                {t('contribution.images.pendingMessage', { count: imageContributions.length })}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {imageContributions.map((contrib) => (
                  <ImageContributionCard
                    key={contrib.id}
                    contribution={contrib}
                    onClick={() => handleNavigateToImage(contrib.referenceId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Guidelines */}
          {guidelineContributions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-coal-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                {t('contribution.guidelines.title')} ({guidelineContributions.length})
              </h3>
              <p className="text-sm text-smoke-600 dark:text-gray-400 mb-4">
                {t('contribution.guidelines.pendingMessage', { count: guidelineContributions.length })}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {guidelineContributions.map((contrib) => (
                  <div
                    key={contrib.id}
                    className="p-4 border border-coal-200 dark:border-coal-600 rounded-lg hover:bg-ice dark:hover:bg-coal-900 cursor-pointer transition-colors"
                    onClick={handleNavigateToGuideline}
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                        <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-coal-800 dark:text-gray-200">
                          {contrib.metadata?.name || 'Guía Clínica'}
                        </p>
                        <p className="text-xs text-smoke-500 dark:text-gray-500">
                          Versión {contrib.metadata?.version || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conclusions */}
          {conclusionContributions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-coal-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <BrainCircuit className="h-4 w-4" />
                {t('contribution.conclusions.title')} ({conclusionContributions.length})
              </h3>
              <p className="text-sm text-smoke-600 dark:text-gray-400 mb-4">
                {t('contribution.conclusions.pendingMessage', { count: conclusionContributions.length })}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {conclusionContributions.map((contrib) => (
                  <ConclusionContributionCard
                    key={contrib.id}
                    contribution={contrib}
                    onClick={() => handleNavigateToConclusion(contrib.referenceId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Privacy Warning and Terms */}
          <div className="border-t border-coal-200 dark:border-coal-700 pt-4 mt-4 space-y-4">
            {/* Privacy Warning */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                    {t('contribution.all.privacyWarning')}
                  </h4>
                  <ul className="text-xs text-red-700 dark:text-red-400 space-y-1">
                    <li>• {t('contribution.all.privacyList.item1')}</li>
                    <li>• {t('contribution.all.privacyList.item2')}</li>
                    <li>• {t('contribution.all.privacyList.item3')}</li>
                    <li>• {t('contribution.all.privacyList.item4')}</li>
                  </ul>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-3 italic">
                    {t('contribution.all.privacyNote')}
                  </p>
                </div>
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start space-x-2 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-800/30">
              <input
                type="checkbox"
                id="terms"
                className="mt-1 w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                checked={acceptedTerms}
                onChange={e => setAcceptedTerms(e.target.checked)}
                disabled={isSubmitting}
              />
              <Label htmlFor="terms" className="text-sm cursor-pointer leading-tight text-coal-700 dark:text-gray-300">
                {t('contribution.all.terms')}
              </Label>
            </div>

            {isSubmitting && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-smoke-500 mb-1">
                  <span>{t('contribution.all.sending')}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            <Button
              onClick={handleSubmitContributions}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white"
              disabled={!acceptedTerms || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  {t('contribution.all.sending')}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar {totalContributions} Contribuciones
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Feedback Section */}
      <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
        <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {t('contribution.feedback.title')}
        </h2>
        <form onSubmit={handleCommentSubmit} className="space-y-6">
          <div>
            <Label htmlFor="component" className="dark:text-dark-text">
              {t('contribution.feedback.component')}
            </Label>
            <Select
              value={selectedComponent}
              onValueChange={(value) => setSelectedComponent(value as 'dird' | 'dird-models')}
              options={[
                { value: 'dird', label: t('contribution.feedback.dirdApp') },
                { value: 'dird-models', label: t('contribution.feedback.dirdModels') }
              ]}
              placeholder={t('contribution.feedback.selectComponent')}
            />
          </div>

          <div>
            <Label htmlFor="comment" className="dark:text-dark-text">
              {t('contribution.feedback.comment')}
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('contribution.feedback.placeholder')}
              className="mt-2 min-h-[120px] dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            variant="secondary"
          >
            <Send className="h-4 w-4 mr-2" />
            {t('contribution.feedback.submit')}
          </Button>
        </form>
      </Card>
    </div>
  );
};

// Helper component for image contributions
const ImageContributionCard: React.FC<{ contribution: PendingContribution; onClick: () => void }> = ({ contribution, onClick }) => {
  const [image, setImage] = useState<Image | null>(null);

  useEffect(() => {
    db.images.get(contribution.referenceId).then(img => setImage(img || null));
  }, [contribution.referenceId]);

  if (!image) return null;

  return (
    <div
      className="group relative aspect-square bg-gray-200 rounded-lg overflow-hidden border border-gray-300 dark:border-coal-600 shadow-sm cursor-pointer hover:ring-2 hover:ring-amber-500 transition-all"
      onClick={onClick}
    >
      <ImageThumbnail image={image} />
      <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1">
        <p className="text-[10px] text-white truncate text-center">{image.filename}</p>
      </div>
      <div className="absolute top-1 right-1 bg-amber-500 rounded-full p-1 shadow-md">
        <ImageIcon className="w-3 h-3 text-white" />
      </div>
    </div>
  );
};

// Helper component for conclusion contributions
const ConclusionContributionCard: React.FC<{ contribution: PendingContribution; onClick: () => void }> = ({ contribution, onClick }) => {
  const [classification, setClassification] = useState<ImageClassification | null>(null);

  useEffect(() => {
    db.imageClassifications.get(contribution.referenceId).then(cls => setClassification(cls || null));
  }, [contribution.referenceId]);

  if (!classification) return null;

  return (
    <div
      className="p-4 border border-coal-200 dark:border-coal-600 rounded-lg hover:bg-ice dark:hover:bg-coal-900 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
          <BrainCircuit className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-coal-800 dark:text-gray-200">
            {classification.severity}
          </p>
          <p className="text-xs text-smoke-500 dark:text-gray-500">
            {classification.guidelineName || 'Conclusión modificada'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContributionMenu;
