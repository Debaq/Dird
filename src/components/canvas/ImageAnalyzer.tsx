import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Layers, Wrench, Coffee, Star, Heart } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const [showContributionDialog, setShowContributionDialog] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
       const landscape = window.matchMedia("(orientation: landscape)").matches;
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

  const handleMark = async () => {
    if (!image) return;
    await db.images.update(image.id!, { contributionStatus: 'pending' });
    setShowContributionDialog(false);
  };

  const handleUnmark = async () => {
    if (!image) return;
    await db.images.update(image.id!, { contributionStatus: 'none' });
    setShowContributionDialog(false);
  };

  const showContributionPrompt = (manualDetections.length > 0 || image?.contributionStatus === 'pending') && image?.contributionStatus !== 'submitted';

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

        {/* Contribute Button in Header */}
        {showContributionPrompt && (
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "ml-auto mr-2 flex-shrink-0 transition-all hover:scale-110",
              image.contributionStatus === 'pending' 
                ? "text-amber-500 hover:text-red-500 hover:bg-red-50" 
                : "text-smoke-600 hover:text-amber-500 hover:bg-amber-50"
            )}
            title={image.contributionStatus === 'pending' ? 'Gestionar contribución' : 'Marcar para contribuir'}
            onClick={() => setShowContributionDialog(true)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="flex items-center gap-1.5">
              {image.contributionStatus === 'pending' ? (
                isHovered ? (
                  <Heart className="w-6 h-6 fill-current animate-pulse" />
                ) : (
                  <Star className="w-6 h-6 fill-current animate-pulse" />
                )
              ) : (
                <>
                  <Star className="w-5 h-5 animate-pulse" />
                  <Coffee className="w-5 h-5 animate-pulse" />
                </>
              )}
            </div>
          </Button>
        )}

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
             className="w-8 h-8 relative"
             onClick={() => {
               setShowMobileLayers(!showMobileLayers);
               if (!showMobileLayers) setShowMobileTools(false);
             }}
           >
             <Layers className="w-4 h-4 text-coal-600 dark:text-gray-300" />
             {showContributionPrompt && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
             )}
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
                }}
                disabled={session?.locked}
              />
           </div>
         )}

         {showMobileLayers && (
           <div className="absolute top-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg p-2 rounded-b-lg border-t border-coal-100 dark:border-gray-700 max-h-[70vh] overflow-y-auto pb-20">
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
          <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm bg-transparent lg:bg-white lg:dark:bg-gray-800 rounded-none lg:rounded-lg overflow-hidden">
            <CardContent className="flex-grow p-0 h-full relative">
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

      <Dialog open={showContributionDialog} onOpenChange={setShowContributionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Star className="w-5 h-5 fill-current" />
              {t('contribution.title', 'Contribuir')}
            </DialogTitle>
            <DialogDescription className="text-base font-medium text-coal-800 dark:text-gray-100">
              Contribuye con tu imagen y tus marcas para mejorar el modelo.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-smoke-600 dark:text-gray-300">
              La contribución incluye la <strong>imagen original</strong> más las <strong>marcas de IA y manuales</strong>, con sus coordenadas diferenciadas y sus clases correspondientes.
            </p>
            <p className="text-sm text-smoke-600 dark:text-gray-300 italic">
              Tus datos serán anonimizados (incluyendo la serialización del nombre de la imagen) antes del envío para garantizar la privacidad. Ve a la sección de "Contribuir" en el menú principal para finalizar el envío y aceptar los términos.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContributionDialog(false)}>
              Cancelar
            </Button>
            {image?.contributionStatus === 'pending' ? (
              <Button 
                variant="destructive"
                onClick={handleUnmark}
              >
                No contribuir
              </Button>
            ) : (
              <Button 
                className="bg-amber-500 hover:bg-amber-600 text-white"
                onClick={handleMark}
              >
                Marcar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImageAnalyzer;
