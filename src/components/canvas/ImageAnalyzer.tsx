import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // Added this line
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AnnotationCanvas from './AnnotationCanvas';
import AdvancedLayerControls, { type CanvasLayer } from './AdvancedLayerControls';
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
    showLabels: true,
  },
  {
    id: 'manual-annotations',
    name: 'Anotaciones Manuales',
    visible: true,
    opacity: 1,
    locked: false,
    zIndex: 3,
    showLabels: true,
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

  const allDetections = useLiveQuery(
    () => (imageId ? db.detections.where('imageId').equals(parseInt(imageId)).toArray() : []),
    [imageId]
  );

  // Separar detecciones por tipo
  const aiDetections = allDetections?.filter((d) => d.type === 'ai') || [];
  const manualDetections = allDetections?.filter((d) => d.type === 'manual') || [];

  React.useEffect(() => {
    // Component mounted, no debug logs
  }, [allDetections, imageId, patientId, sessionId, aiDetections.length, manualDetections.length]);

  const handleLayerUpdate = (layerId: string, updates: Partial<CanvasLayer>) => {
    setLayers((prev) =>
      prev.map((layer) => (layer.id === layerId ? { ...layer, ...updates } : layer))
    );
  };

  const handleAnnotationAdded = () => {
    // useLiveQuery automáticamente detectará cambios en db.detections
    // Este callback está aquí por si necesitamos hacer algo adicional en el futuro
  };

  if (!image) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-smoke-500">{t('ui.loadingImage')}</p>
          <p className="text-xs text-smoke-400 mt-2">Image ID: {imageId}</p>
        </div>
      </div>
    );
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
                detections={aiDetections.filter((d) => d.visible)}
                manualAnnotations={manualDetections.filter((d) => d.visible)}
                activeTool={activeTool}
                layers={layers}
                onAnnotationAdded={handleAnnotationAdded}
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

          <AdvancedLayerControls
            layers={layers}
            onLayerUpdate={handleLayerUpdate}
            aiDetections={aiDetections}
            manualDetections={manualDetections}
            onDetectionsUpdate={handleAnnotationAdded}
          />
        </div>
      </div>
    </div>
  );
};

export default ImageAnalyzer;
