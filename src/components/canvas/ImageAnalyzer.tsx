import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Layers, Wrench, Coffee, Star, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
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
import type { HistoryEntry } from '@/types/annotations';

const DEFAULT_LAYERS: CanvasLayer[] = [
  { id: 'original', name: 'canvas.layers.original', visible: true, opacity: 1, locked: true, zIndex: 0 },
  {
    id: 'detections-ai',
    name: 'canvas.layers.ai_detections',
    visible: true,
    opacity: 1,
    locked: false,
    zIndex: 1,
    showLabels: true,
  },
  {
    id: 'manual-annotations',
    name: 'canvas.layers.manual',
    visible: true,
    opacity: 1,
    locked: false,
    zIndex: 2,
    showLabels: true,
  },
  {
    id: 'measurements',
    name: 'canvas.layers.measurements',
    visible: true,
    opacity: 1,
    locked: false,
    zIndex: 3,
  },
  {
    id: 'quadrants',
    name: 'canvas.layers.quadrants',
    visible: true,
    opacity: 0.5,
    locked: false,
    zIndex: 4,
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
  const [selectedLandmarkType, setSelectedLandmarkType] = useState<'optic_disc' | 'fovea'>('optic_disc');

  // History State
  const [detectionHistory, setDetectionHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const addToHistory = (entry: HistoryEntry) => {
    const newHistory = detectionHistory.slice(0, historyIndex + 1);
    newHistory.push(entry);
    setDetectionHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = async () => {
    if (historyIndex < 0) return;

    const entry = detectionHistory[historyIndex];

    try {
      if (entry.type === 'add') {
        if (entry.detection.id) {
          await db.detections.delete(entry.detection.id);
        }
      } else if (entry.type === 'delete') {
        await db.detections.add(entry.detection);
      } else if (entry.type === 'update') {
        await db.detections.put(entry.before);
      }
      setHistoryIndex(prev => prev - 1);
    } catch (error) {
      console.error('Error in undo:', error);
    }
  };

  const handleRedo = async () => {
    if (historyIndex >= detectionHistory.length - 1) return;

    const entry = detectionHistory[historyIndex + 1];

    try {
      if (entry.type === 'add') {
        await db.detections.add(entry.detection);
      } else if (entry.type === 'delete') {
        if (entry.detection.id) {
          await db.detections.delete(entry.detection.id);
        }
      } else if (entry.type === 'update') {
        await db.detections.put(entry.after);
      }
      setHistoryIndex(prev => prev + 1);
    } catch (error) {
      console.error('Error in redo:', error);
    }
  };

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

  const sessionImages = useLiveQuery(
    () => (sessionId ? db.images.where('sessionId').equals(parseInt(sessionId)).toArray() : []),
    [sessionId]
  );

  const currentImageIdInt = imageId ? parseInt(imageId) : -1;
  const sortedImages = sessionImages ? sessionImages.sort((a, b) => a.id! - b.id!) : [];
  const currentIndex = sortedImages.findIndex(img => img.id === currentImageIdInt);

  const handleNavigation = (targetId: number) => {
    navigate(`/patients/${patientId}/sessions/${sessionId}/images/${targetId}`);
  };

  const handlePrevImage = () => {
    if (sortedImages.length <= 1) return;
    const prevIndex = (currentIndex - 1 + sortedImages.length) % sortedImages.length;
    const prevId = sortedImages[prevIndex].id;
    if (prevId) handleNavigation(prevId);
  };

  const handleNextImage = () => {
    if (sortedImages.length <= 1) return;
    const nextIndex = (currentIndex + 1) % sortedImages.length;
    const nextId = sortedImages[nextIndex].id;
    if (nextId) handleNavigation(nextId);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PageUp') {
        e.preventDefault();
        handlePrevImage();
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        handleNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevImage, handleNextImage]);

  const allDetections = useLiveQuery(
    () => (imageId ? db.detections.where('imageId').equals(parseInt(imageId)).toArray() : []),
    [imageId]
  );

  const allSegmentations = useLiveQuery(
    () => (imageId ? db.segmentations.where('imageId').equals(parseInt(imageId)).toArray() : []),
    [imageId]
  );

  const allMeasurements = useLiveQuery(
    () => (imageId ? db.measurements.where('imageId').equals(parseInt(imageId)).and(m => m.visible === true).toArray() : []),
    [imageId]
  );

  // Separar detecciones por tipo
  const aiDetections = allDetections?.filter((d) => d.type === 'ai') || [];
  const manualDetections = allDetections?.filter((d) => d.type === 'manual') || [];

  // Separar segmentaciones por tipo
  const aiSegmentations = allSegmentations?.filter((s) => s.type === 'ai') || [];
  const manualSegmentations = allSegmentations?.filter((s) => s.type === 'manual') || [];

  const handleLayerUpdate = (layerId: string, updates: Partial<CanvasLayer>) => {
    setLayers((prev) =>
      prev.map((layer) => (layer.id === layerId ? { ...layer, ...updates } : layer))
    );
  };

  const handleAnnotationAdded = () => {
    // useLiveQuery automáticamente detectará cambios en db.detections
  };

  // Check if image is already marked for contribution
  const existingContribution = useLiveQuery(
    () => image?.id ? db.pendingContributions
      .where({ type: 'image', referenceId: image.id })
      .first() : undefined,
    [image?.id]
  );

  const handleMark = async () => {
    if (!image) return;

    // Check if already exists
    if (existingContribution) {
      setShowContributionDialog(false);
      return;
    }

    // Add to pending contributions
    await db.pendingContributions.add({
      type: 'image',
      referenceId: image.id!,
      status: 'pending',
      createdAt: new Date(),
    });
    setShowContributionDialog(false);
  };

  const handleUnmark = async () => {
    if (!image || !existingContribution) return;
    await db.pendingContributions.delete(existingContribution.id!);
    setShowContributionDialog(false);
  };

  const isMarkedForContribution = existingContribution && existingContribution.status === 'pending';
  const showContributionPrompt = manualDetections.length > 0 || isMarkedForContribution;

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
    <div className="flex flex-col h-[100vh] lg:h-[calc(100vh-11rem)] relative bg-ice dark:bg-gray-900">
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
              isMarkedForContribution
                ? "text-amber-500 hover:text-red-500 hover:bg-red-50"
                : "hover:bg-purple-50 dark:hover:bg-purple-950/20"
            )}
            title={isMarkedForContribution ? t('contribution.dialog.manage') : t('contribution.dialog.markToContribute')}
            onClick={() => setShowContributionDialog(true)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="flex items-center gap-1.5">
              {isMarkedForContribution ? (
                isHovered ? (
                  <Heart className="w-6 h-6 fill-current animate-pulse" />
                ) : (
                  <Star className="w-6 h-6 fill-current animate-pulse" />
                )
              ) : (
                <>
                  <Star className="w-5 h-5 animate-contribute-pulse" />
                  <Coffee className="w-5 h-5 animate-contribute-pulse" />
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
                selectedLandmarkType={selectedLandmarkType}
                onLandmarkTypeChange={setSelectedLandmarkType}
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
               measurements={allMeasurements || []}
               onDetectionsUpdate={handleAnnotationAdded}
               onMeasurementsUpdate={handleAnnotationAdded}
               onAddToHistory={addToHistory}
             />
           </div>
         )}
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-6 flex-grow overflow-hidden relative">
        {/* Canvas Area */}
        <div className="lg:col-span-3 h-full w-full">
          <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm bg-transparent lg:bg-white lg:dark:bg-gray-800 rounded-none lg:rounded-lg overflow-hidden">
            <CardContent className="flex-grow p-0 h-full relative group">
              <AnnotationCanvas
                image={image}
                detections={aiDetections.filter((d) => d.visible)}
                manualAnnotations={manualDetections.filter((d) => d.visible)}
                segmentations={aiSegmentations.filter((s) => s.visible)}
                manualSegmentations={manualSegmentations.filter((s) => s.visible)}
                measurements={allMeasurements || []}
                activeTool={activeTool}
                layers={layers}
                selectedLandmarkType={selectedLandmarkType}
                onAnnotationAdded={handleAnnotationAdded}
                history={{
                  entries: detectionHistory,
                  index: historyIndex,
                  onAdd: addToHistory,
                  onUndo: handleUndo,
                  onRedo: handleRedo
                }}
              />

              {sortedImages.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/50 dark:bg-black/50 hover:bg-white/80 dark:hover:bg-black/80 rounded-full w-10 h-10 backdrop-blur-sm z-10 shadow-sm border border-black/5 dark:border-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    onClick={handlePrevImage}
                    title={t('analysis.tools.prevImage')}
                  >
                    <ChevronLeft className="w-6 h-6 text-coal-800 dark:text-white" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/50 dark:bg-black/50 hover:bg-white/80 dark:hover:bg-black/80 rounded-full w-10 h-10 backdrop-blur-sm z-10 shadow-sm border border-black/5 dark:border-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    onClick={handleNextImage}
                    title={t('analysis.tools.nextImage')}
                  >
                    <ChevronRight className="w-6 h-6 text-coal-800 dark:text-white" />
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Desktop Side Panel */}
        <div className="hidden lg:block space-y-4 h-full overflow-y-auto pr-2">
          <ToolPanel
            activeTool={activeTool}
            onToolChange={setActiveTool}
            disabled={session?.locked}
            selectedLandmarkType={selectedLandmarkType}
            onLandmarkTypeChange={setSelectedLandmarkType}
          />

          <AdvancedLayerControls
            layers={layers}
            onLayerUpdate={handleLayerUpdate}
            aiDetections={aiDetections}
            manualDetections={manualDetections}
            measurements={allMeasurements || []}
            onDetectionsUpdate={handleAnnotationAdded}
            onMeasurementsUpdate={handleAnnotationAdded}
            onAddToHistory={addToHistory}
          />
        </div>
      </div>

      <Dialog open={showContributionDialog} onOpenChange={setShowContributionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Star className="w-5 h-5 fill-current" />
              {t('contribution.title')}
            </DialogTitle>
            <DialogDescription className="text-base font-medium text-coal-800 dark:text-gray-100">
              {t('contribution.dialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-smoke-600 dark:text-gray-300">
              {t('contribution.dialog.body1')}
            </p>
            <p className="text-sm text-smoke-600 dark:text-gray-300 italic">
              {t('contribution.dialog.body2')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContributionDialog(false)}>
              {t('ui.cancel')}
            </Button>
            {isMarkedForContribution ? (
              <Button
                variant="destructive"
                onClick={handleUnmark}
              >
                {t('contribution.dialog.unmark')}
              </Button>
            ) : (
              <Button 
                className="bg-amber-500 hover:bg-amber-600 text-white"
                onClick={handleMark}
              >
                {t('contribution.dialog.mark')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImageAnalyzer;
