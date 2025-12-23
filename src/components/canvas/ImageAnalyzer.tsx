import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // Added this line
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AnnotationCanvas from './AnnotationCanvas';
import LayerControls, { type CanvasLayer } from './LayerControls';
import ToolPanel, { type CanvasTool } from './ToolPanel';
import { db } from '@/lib/db/schema';

const DEFAULT_LAYERS: CanvasLayer[] = [
  { id: 'original', name: 'Imagen Original', visible: true, opacity: 1, locked: true, zIndex: 0 },
  {
    id: 'segmentations-ai',
    name: 'Segmentaciones IA',
    visible: true,
    opacity: 0.6,
    locked: false,
    zIndex: 1,
  },
  {
    id: 'detections-ai',
    name: 'Detecciones IA',
    visible: true,
    opacity: 1,
    locked: false,
    zIndex: 2,
  },
  {
    id: 'manual-annotations',
    name: 'Anotaciones Manuales',
    visible: true,
    opacity: 1,
    locked: false,
    zIndex: 3,
  },
];

const ImageAnalyzer: React.FC = () => {
  const { patientId, sessionId, imageId } = useParams<{
    patientId: string;
    sessionId: string;
    imageId: string;
  }>();
  const navigate = useNavigate();
  const { t } = useTranslation(); // Added this line
  const [layers, setLayers] = useState<CanvasLayer[]>(DEFAULT_LAYERS);
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');

  const image = useLiveQuery(
    () => (imageId ? db.images.get(parseInt(imageId)) : undefined),
    [imageId]
  );

  const session = useLiveQuery(
    () => (sessionId ? db.sessions.get(parseInt(sessionId)) : undefined),
    [sessionId]
  );

  const detections = useLiveQuery(
    () => (imageId ? db.detections.where('imageId').equals(parseInt(imageId)).toArray() : []),
    [imageId]
  );

  const handleLayerUpdate = (layerId: string, updates: Partial<CanvasLayer>) => {
    setLayers((prev) =>
      prev.map((layer) => (layer.id === layerId ? { ...layer, ...updates } : layer))
    );
  };

  if (!image) {
    return <div>{t('ui.loadingImage')}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(`/patients/${patientId}/sessions/${sessionId}`)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-coal-800">{t('analysis.title')}</h1>
            <p className="text-smoke-500 mt-1">{image.filename}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Canvas Area */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-6">
              <AnnotationCanvas
                image={image}
                detections={detections?.filter((d) => d.visible) || []}
              />
            </CardContent>
          </Card>
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          <ToolPanel
            activeTool={activeTool}
            onToolChange={setActiveTool}
            disabled={session?.locked}
          />

          <LayerControls layers={layers} onLayerUpdate={handleLayerUpdate} />

          {detections && detections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('analysis.detections')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {detections.map((det) => (
                    <div
                      key={det.id}
                      className="p-2 bg-coal-50 rounded text-xs flex items-center justify-between"
                    >
                      <span className="font-medium">{det.class}</span>
                      {det.confidence && (
                        <span className="text-smoke-500">
                          {Math.round(det.confidence * 100)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageAnalyzer;
