import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db, type Image, type Detection } from '@/lib/db/schema';
import { getClassColor } from '@/lib/ai/model-metadata';
import { getClassName } from '@/lib/ai/class-translations';
import i18n from '@/i18n/config';
import { QuadrantAnalysisPanel } from '@/components/canvas/QuadrantAnalysisPanel';
import { quadrantCalculator, type QuadrantAnalysis } from '@/lib/analysis/quadrant-calculator';
import { DRClassificationCard } from '@/components/analysis/DRClassificationCard';

interface AnalysisViewProps {
  images: Image[];
  sessionId: number;
  patientId: string;
  refreshKey?: number;
}

interface ImageWithDetections {
  image: Image;
  detections: Detection[];
  thumbnail: string;
  quadrantAnalysis: QuadrantAnalysis;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ images, sessionId, patientId, refreshKey }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [imagesWithDetections, setImagesWithDetections] = useState<ImageWithDetections[]>([]);
  const [totalDetections, setTotalDetections] = useState(0);





  useEffect(() => {
    const loadData = async () => {
      const data: ImageWithDetections[] = [];
      let total = 0;

      for (const image of images) {
        if (!image.id) continue;

        const detections = await db.detections
          .where('imageId')
          .equals(image.id)
          .toArray();

        const thumbnail = URL.createObjectURL(image.originalBlob);

        // Calculate quadrant analysis
        const quadrantAnalysis = quadrantCalculator.analyzeQuadrants(
          detections,
          image.width,
          image.height
        );

        data.push({ image, detections, thumbnail, quadrantAnalysis });

        // Count total detections
        total += detections.length;
      }

      setImagesWithDetections(data);
      setTotalDetections(total);
    };

    loadData();

    return () => {
      imagesWithDetections.forEach(item => URL.revokeObjectURL(item.thumbnail));
    };
  }, [images, refreshKey]);

  if (images.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-smoke-500">{t('analysis.view.noImages')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-smoke-500">{t('analysis.view.stats.totalImages')}</p>
                <p className="text-3xl font-bold text-coal-800">{images.length}</p>
              </div>
              <Eye className="w-8 h-8 text-primary-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-smoke-500">{t('analysis.view.stats.totalDetections')}</p>
                <p className="text-3xl font-bold text-coal-800">{totalDetections}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-accent-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-smoke-500">{t('analysis.view.stats.avgPerImage')}</p>
              <p className="text-3xl font-bold text-coal-800">
                {images.length > 0 ? (totalDetections / images.length).toFixed(1) : 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-smoke-500">{t('analysis.view.stats.processedImages')}</p>
              <p className="text-3xl font-bold text-coal-800">
                {imagesWithDetections.filter(i => i.detections.length > 0).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DR Classification */}
      <DRClassificationCard sessionId={sessionId} refreshKey={refreshKey} />

      {/* Images Grid - Separated by Eye (OD left, OI right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* OJO DERECHO (OD) - Left side */}
        <Card>
          <CardHeader className="bg-primary-50">
            <CardTitle className="text-center">
              {t('analysis.view.rightEye')} (OD)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {imagesWithDetections.filter(item => item.image.eyeType === 'OD').length === 0 ? (
              <div className="text-center py-12">
                <p className="text-smoke-500">{t('analysis.view.noImagesForEye')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {imagesWithDetections.filter(item => item.image.eyeType === 'OD').map(({ image, detections, thumbnail, quadrantAnalysis }) => (
                <div
                  key={image.id}
                  className="group relative bg-white rounded-lg border border-coal-200 overflow-hidden hover:shadow-strong transition-all cursor-pointer flex flex-col h-full"
                  onClick={() => navigate(`/patients/${patientId}/sessions/${sessionId}/images/${image.id}`)}
                >
                  <div className="aspect-video overflow-hidden bg-coal-50 relative flex-shrink-0">
                    <img
                      src={thumbnail}
                      alt={image.filename}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full px-4 py-2 shadow-lg">
                        <p className="text-sm font-bold text-primary-600">{t('analysis.view.viewDetails')}</p>
                      </div>
                    </div>
                    {detections.length > 0 && (
                      <div className="absolute top-2 right-2 bg-primary-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                        {detections.length} {t('analysis.view.detectionsCount')}
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex-grow flex flex-col gap-4">
                    <div>
                      <p className="text-sm font-medium text-coal-800 truncate mb-2">
                        {image.filename}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(
                          detections.reduce((acc, det) => {
                            acc[det.class] = (acc[det.class] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>)
                        ).map(([className, count]) => (
                          <span
                            key={className}
                            className="text-xs px-2 py-1 rounded-full text-white font-medium"
                            style={{ backgroundColor: getClassColor(className) }}
                          >
                            {getClassName(className, i18n.language)}: {count}
                          </span>
                        ))}
                      </div>
                      {detections.length === 0 && (
                        <p className="text-xs text-smoke-400">{t('analysis.view.noDetectionsLabel')}</p>
                      )}
                    </div>

                    {/* Quadrant Analysis Panel */}
                    <div className="mt-auto pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                       <QuadrantAnalysisPanel analysis={quadrantAnalysis} className="border-0 shadow-none p-0" eyeType="OD" />
                    </div>
                  </div>
                  <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="bg-white hover:bg-coal-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/patients/${patientId}/sessions/${sessionId}/images/${image.id}`);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* OJO IZQUIERDO (OI) - Right side */}
        <Card>
          <CardHeader className="bg-accent-50">
            <CardTitle className="text-center">
              {t('analysis.view.leftEye')} (OI)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {imagesWithDetections.filter(item => item.image.eyeType === 'OI').length === 0 ? (
              <div className="text-center py-12">
                <p className="text-smoke-500">{t('analysis.view.noImagesForEye')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {imagesWithDetections.filter(item => item.image.eyeType === 'OI').map(({ image, detections, thumbnail, quadrantAnalysis }) => (
                <div
                  key={image.id}
                  className="group relative bg-white rounded-lg border border-coal-200 overflow-hidden hover:shadow-strong transition-all cursor-pointer flex flex-col h-full"
                  onClick={() => navigate(`/patients/${patientId}/sessions/${sessionId}/images/${image.id}`)}
                >
                  <div className="aspect-video overflow-hidden bg-coal-50 relative flex-shrink-0">
                    <img
                      src={thumbnail}
                      alt={image.filename}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full px-4 py-2 shadow-lg">
                        <p className="text-sm font-bold text-primary-600">{t('analysis.view.viewDetails')}</p>
                      </div>
                    </div>
                    {detections.length > 0 && (
                      <div className="absolute top-2 right-2 bg-primary-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                        {detections.length} {t('analysis.view.detectionsCount')}
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex-grow flex flex-col gap-4">
                    <div>
                      <p className="text-sm font-medium text-coal-800 truncate mb-2">
                        {image.filename}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(
                          detections.reduce((acc, det) => {
                            acc[det.class] = (acc[det.class] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>)
                        ).map(([className, count]) => (
                          <span
                            key={className}
                            className="text-xs px-2 py-1 rounded-full text-white font-medium"
                            style={{ backgroundColor: getClassColor(className) }}
                          >
                            {getClassName(className, i18n.language)}: {count}
                          </span>
                        ))}
                      </div>
                      {detections.length === 0 && (
                        <p className="text-xs text-smoke-400">{t('analysis.view.noDetectionsLabel')}</p>
                      )}
                    </div>

                    {/* Quadrant Analysis Panel */}
                    <div className="mt-auto pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                       <QuadrantAnalysisPanel analysis={quadrantAnalysis} className="border-0 shadow-none p-0" eyeType="OI" />
                    </div>
                  </div>
                  <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="bg-white hover:bg-coal-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/patients/${patientId}/sessions/${sessionId}/images/${image.id}`);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalysisView;
