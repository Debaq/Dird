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
  const [detectionStats, setDetectionStats] = useState<Record<string, number>>({});
  const [totalDetections, setTotalDetections] = useState(0);





  useEffect(() => {
    const loadData = async () => {
      const data: ImageWithDetections[] = [];
      const stats: Record<string, number> = {};
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

        // Count by class
        detections.forEach(det => {
          stats[det.class] = (stats[det.class] || 0) + 1;
          total++;
        });
      }

      setImagesWithDetections(data);
      setDetectionStats(stats);
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

      {/* Detection Classes */}
      {Object.keys(detectionStats).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('analysis.view.detectionsPerClass')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Object.entries(detectionStats)
                .sort(([, a], [, b]) => b - a)
                .map(([className, count]) => (
                  <div
                    key={className}
                    className="p-4 rounded-lg border-2 transition-all hover:shadow-md"
                    style={{ borderColor: getClassColor(className) }}
                  >
                    <div
                      className="w-4 h-4 rounded-full mb-2"
                      style={{ backgroundColor: getClassColor(className) }}
                    />
                    <p className="text-sm font-medium text-coal-800">{getClassName(className, i18n.language)}</p>
                    <p className="text-2xl font-bold text-coal-900">{count}</p>
                    <p className="text-xs text-smoke-500">
                      {((count / totalDetections) * 100).toFixed(1)}%
                    </p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Images Grid */}
      <Card>
        <CardHeader>
          <CardTitle>{t('analysis.view.analyzedImages')}</CardTitle>
        </CardHeader>
        <CardContent>
          {totalDetections === 0 ? (
            <div className="text-center py-12">
              <p className="text-smoke-500">
                {t('analysis.view.noDetections')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {imagesWithDetections.map(({ image, detections, thumbnail, quadrantAnalysis }) => (
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
                       <QuadrantAnalysisPanel analysis={quadrantAnalysis} className="border-0 shadow-none p-0" />
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
  );
};

export default AnalysisView;
