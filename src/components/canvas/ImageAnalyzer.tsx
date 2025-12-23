import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Layers, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AnnotationCanvas from './AnnotationCanvas';
import AdvancedLayerControls, { type CanvasLayer } from './AdvancedLayerControls';
import ToolPanel, { type CanvasTool } from './ToolPanel';
import { db } from '@/lib/db/schema';
import { cn } from '@/lib/utils';

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
  const { t } = useTranslation();
  const [layers, setLayers] = useState<CanvasLayer[]>(DEFAULT_LAYERS);
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  
  // Mobile UI state
  const [showMobileTools, setShowMobileTools] = useState(false);
  const [showMobileLayers, setShowMobileLayers] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
       const landscape = window.matchMedia("(orientation: landscape)").matches;
       setIsLandscape(landscape);
       // Auto-collapse panels on landscape to prioritize image
       if (landscape) {
         setShowMobileTools(false);
         setShowMobileLayers(false);
       }
    };
    
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

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

  const handleLayerUpdate = (layerId: string, updates: Partial<CanvasLayer>) => {
    setLayers((prev) =>
      prev.map((layer) => (layer.id === layerId ? { ...layer, ...updates } : layer))
    );
  };

  const handleAnnotationAdded = () => {
    // useLiveQuery automáticamente detectará cambios en db.detections
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
    <div className="flex flex-col h-[100vh] relative bg-ice dark:bg-gray-900">
      {/* Header - Visible on Mobile (Portrait & Landscape) and Desktop */}
      <div className={cn(
        "flex items-center justify-between mb-2 flex-shrink-0",
        // Add padding on mobile because MainLayout(fullScreenOnMobile) removes it
        "p-2 lg:p-0 lg:mb-6"
      )}>
        <div className="flex items-center space-x-4 overflow-hidden">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(`/patients/${patientId}/sessions/${sessionId}`)}
            className="flex-shrink-0 w-8 h-8 lg:w-10 lg:h-10"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg lg:text-3xl font-bold text-coal-800 dark:text-gray-100 truncate">{t('analysis.title')}</h1>
            <p className="text-xs lg:text-sm text-smoke-500 dark:text-gray-400 mt-0.5 truncate">{image.filename}</p>
          </div>
        </div>

        {/* Mobile Toolbar Icons */}
        <div className="flex lg:hidden items-center space-x-1 ml-2 flex-shrink-0">
           <Button 
             variant={showMobileTools ? "secondary" : "ghost"}
             size="icon"
             className="w-8 h-8"
             onClick={() => {
               setShowMobileTools(!showMobileTools);
               if (!showMobileTools) setShowMobileLayers(false);
             }}
           >
             <Wrench className="w-4 h-4 text-coal-600 dark:text-gray-300" /> 
           </Button>
           <Button 
             variant={showMobileLayers ? "secondary" : "ghost"}
             size="icon"
             className="w-8 h-8"
             onClick={() => {
               setShowMobileLayers(!showMobileLayers);
               if (!showMobileLayers) setShowMobileTools(false);
             }}
           >
             <Layers className="w-4 h-4 text-coal-600 dark:text-gray-300" /> 
           </Button>
        </div>
      </div>

      {/* Mobile Collapsible Panels */}
      <div className="lg:hidden px-2 flex-shrink-0 relative z-10">
         {showMobileTools && (
           <div className="absolute top-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg p-2 rounded-b-lg border-t border-coal-100 dark:border-gray-700">
              <ToolPanel
                activeTool={activeTool}
                onToolChange={(tool) => {
                  setActiveTool(tool);
                  // Optional: Close panel after selecting tool to save space? 
                  // Let's keep it open for now as per "desplegable" request
                }}
                disabled={session?.locked}
              />
           </div>
         )}

         {showMobileLayers && (
           <div className="absolute top-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg p-2 rounded-b-lg border-t border-coal-100 dark:border-gray-700 max-h-[50vh] overflow-y-auto">
             <AdvancedLayerControls
               layers={layers}
               onLayerUpdate={handleLayerUpdate}
               aiDetections={aiDetections}
               manualDetections={manualDetections}
               onDetectionsUpdate={handleAnnotationAdded}
             />
           </div>
         )}
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-6 flex-grow overflow-hidden relative">
        {/* Canvas Area */}
        <div className="lg:col-span-3 h-full w-full">
          <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm bg-transparent lg:bg-white lg:dark:bg-gray-800 rounded-none lg:rounded-lg">
            <CardContent className="flex-grow p-0 lg:p-6 h-full relative">
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

        {/* Desktop Side Panel */}
        <div className="hidden lg:block space-y-4">
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
