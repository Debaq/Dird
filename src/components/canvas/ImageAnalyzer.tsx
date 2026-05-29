import React, { useState, useEffect } from 'react';
import { useLiveQuery } from '@/lib/db-sql';
import { ArrowLeft, Layers, Wrench, Coffee, Star, Heart, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { AnalysisBadges } from './AnalysisBadges';
import { OpticDiscCupDrawer } from './OpticDiscCupDrawer';
import { ImageProcessingPanel } from './ImageProcessingPanel';
import { db } from '@/lib/db/schema';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvas-store';
import type { HistoryEntry } from '@/types/annotations';
import { detectMacularEdema, findFovea } from '@/lib/analysis/macular-edema-detector';
import { calibrateFromOpticDisc, createFallbackCalibration } from '@/lib/analysis/spatial-calibrator';
import { analyzeHemorrhages } from '@/lib/analysis/hemorrhage-detector';
import { analyzeMicroaneurysms } from '@/lib/analysis/microaneurysm-detector';
import { analyzeOpticDiscCupping } from '@/lib/analysis/optic-disc-cupping-detector';
import { useConfigStore } from '@/stores/config-store';
import { useImageProcessingStore } from '@/stores/image-processing-store';
import { logger } from '@/utils/logger';
import { useAdvancedEditorMode } from '@/hooks/useAdvancedEditorMode';
import { AdvancedEditorLayout, AdvancedEditorDialog } from './advanced-editor';

const DEFAULT_LAYERS: CanvasLayer[] = [
  { id: 'original', name: 'canvas.layers.original', visible: true, opacity: 1, locked: true, zIndex: 0 },
  {
    id: 'detections-ai',
    name: 'canvas.layers.ai_detections',
    visible: true,
    opacity: 1,
    locked: false,
    zIndex: 6,
    showLabels: true,
  },
  {
    id: 'manual-annotations',
    name: 'canvas.layers.manual',
    visible: true,
    opacity: 1,
    locked: false,
    zIndex: 5,
    showLabels: true,
  },
  {
    id: 'measurements',
    name: 'canvas.layers.measurements',
    visible: true,
    opacity: 1,
    locked: false,
    zIndex: 4,
  },
  {
    id: 'quadrants',
    name: 'canvas.layers.quadrants',
    visible: true,
    opacity: 0.5,
    locked: false,
    zIndex: 3,
  },
  {
    id: 'macular-zones',
    name: 'canvas.layers.macular_zones',
    visible: true,
    opacity: 0.7,
    locked: false,
    zIndex: 3,
  },
  {
    id: 'circinate-rings',
    name: 'canvas.layers.circinate_rings',
    visible: false,
    opacity: 0.7,
    locked: false,
    zIndex: 2,
  },
  {
    id: 'segmentations-ai',
    name: 'canvas.layers.ai_segmentations',
    visible: true,
    opacity: 0.6,
    locked: false,
    zIndex: 1,
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
  const { config } = useConfigStore();
  const { showOriginal, comparisonOpacity } = useImageProcessingStore();
  const [layers, setLayers] = useState<CanvasLayer[]>(DEFAULT_LAYERS);
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  const [selectedLandmarkType, setSelectedLandmarkType] = useState<'optic_disc' | 'fovea'>('optic_disc');
  const [processedImageCanvas, setProcessedImageCanvas] = useState<HTMLCanvasElement | null>(null);
  const { selectedAnnotationId, setSelectedAnnotation } = useCanvasStore();
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<number | null>(null);

  // Advanced Editor Mode
  const advancedEditor = useAdvancedEditorMode();
  const [showAdvancedDialog, setShowAdvancedDialog] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.matchMedia('(min-width: 1280px)').matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1280px)');
    const handleChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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
      logger.canvas.error('Error in undo', error);
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
      logger.canvas.error('Error in redo', error);
    }
  };

  // Mobile UI state
  const [showMobileTools, setShowMobileTools] = useState(false);
  const [showMobileLayers, setShowMobileLayers] = useState(false);
  const [showContributionDialog, setShowContributionDialog] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [cupDrawerOpen, setCupDrawerOpen] = useState(false);


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
      } else if (e.key === 'Escape') {
        setActiveTool('select');
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

  // Calculate macular edema result
  const macularEdemaResult = React.useMemo(() => {
    if (!allDetections || allDetections.length === 0) return null;

    try {
      const fovea = findFovea(allDetections);
      if (!fovea) {
        logger.imageProcessing.log('No fovea found in detections');
        return null;
      }

      const opticDisc = allDetections.find(d =>
        d.class && typeof d.class === 'string' &&
        ['optic_disc', 'optic disc'].includes(d.class.toLowerCase().trim())
      );

      const calibration = opticDisc
        ? calibrateFromOpticDisc(opticDisc)
        : createFallbackCalibration();

      const defaultCriteria = {
        enabled: true,
        method: 'EMCS',
        hard_exudates_distance_um: 500,
        min_exudates_for_flag: 1,
        circinate_pattern_detection: true,
        min_angular_dispersion: 0.5,
        visual_zones: {
          show_foveal_zone: true,
          foveal_zone_radius_um: 500,
        },
      };

      const result = detectMacularEdema(allDetections, fovea, calibration, defaultCriteria);
      logger.imageProcessing.log('Macular edema result', {
        result,
        circinateAnalysis: result?.circinateAnalysis
      });
      return result;
    } catch (error) {
      logger.imageProcessing.error('Error calculating macular edema', error);
      return null;
    }
  }, [allDetections]);

  // Analyze hemorrhages (only if enabled)
  const hemorrhageAnalysisResult = React.useMemo(() => {
    if (!config.advancedAnalysis?.hemorrhages) return null;
    if (!allDetections || allDetections.length === 0) return null;

    try {
      const opticDisc = allDetections.find(d =>
        d.class && typeof d.class === 'string' &&
        ['optic_disc', 'optic disc'].includes(d.class.toLowerCase().trim())
      );

      const calibration = opticDisc
        ? calibrateFromOpticDisc(opticDisc)
        : createFallbackCalibration();

      // Get image dimensions (use first detection for reference)
      const imageWidth = image?.width || 1000;
      const imageHeight = image?.height || 1000;

      const result = analyzeHemorrhages(allDetections, calibration, imageWidth, imageHeight);
      logger.imageProcessing.log('Hemorrhage analysis', result);
      return result;
    } catch (error) {
      logger.imageProcessing.error('Error analyzing hemorrhages', error);
      return null;
    }
  }, [allDetections, image, config.advancedAnalysis?.hemorrhages]);

  // Analyze microaneurysms (only if enabled)
  const microaneurysmAnalysisResult = React.useMemo(() => {
    if (!config.advancedAnalysis?.microaneurysms) return null;
    if (!allDetections || allDetections.length === 0) return null;

    try {
      const opticDisc = allDetections.find(d =>
        d.class && typeof d.class === 'string' &&
        ['optic_disc', 'optic disc'].includes(d.class.toLowerCase().trim())
      );

      const calibration = opticDisc
        ? calibrateFromOpticDisc(opticDisc)
        : createFallbackCalibration();

      const result = analyzeMicroaneurysms(allDetections, calibration);
      logger.imageProcessing.log('Microaneurysm analysis', result);
      return result;
    } catch (error) {
      logger.imageProcessing.error('Error analyzing microaneurysms', error);
      return null;
    }
  }, [allDetections, config.advancedAnalysis?.microaneurysms]);

  // Analyze optic disc cupping (only if enabled)
  const opticDiscCuppingResult = React.useMemo(() => {
    if (!config.advancedAnalysis?.opticDiscCupping) return null;
    if (!allDetections || allDetections.length === 0) return null;

    try {
      const opticDisc = allDetections.find(d =>
        d.class && typeof d.class === 'string' &&
        ['optic_disc', 'optic disc'].includes(d.class.toLowerCase().trim())
      );

      const calibration = opticDisc
        ? calibrateFromOpticDisc(opticDisc)
        : createFallbackCalibration();

      const result = analyzeOpticDiscCupping(allDetections, calibration);
      return result;
    } catch (error) {
      logger.imageProcessing.error('Error analyzing optic disc cupping', error);
      return null;
    }
  }, [allDetections, config.advancedAnalysis?.opticDiscCupping]);

  // Separar detecciones por tipo
  const aiDetections = allDetections?.filter((d) => d.type === 'ai') || [];
  const manualDetections = allDetections?.filter((d) => d.type === 'manual') || [];

  // Separar segmentaciones por tipo
  const aiSegmentations = allSegmentations?.filter((s) => s.type === 'ai') || [];
  const manualSegmentations = allSegmentations?.filter((s) => s.type === 'manual') || [];

  // Calculate circinate analysis for display
  const circinateAnalysis = React.useMemo(() => {
    const allDets = [...aiDetections, ...manualDetections];

    if (allDets.length === 0) {
      return null;
    }

    try {
      const fovea = findFovea(allDets);
      if (!fovea) {
        return null;
      }

      const opticDisc = allDets.find(d =>
        d.class && typeof d.class === 'string' &&
        ['optic_disc', 'optic disc'].includes(d.class.toLowerCase().trim())
      );

      const calibration = opticDisc
        ? calibrateFromOpticDisc(opticDisc)
        : createFallbackCalibration();

      const defaultCriteria = {
        enabled: true,
        method: 'EMCS',
        hard_exudates_distance_um: 500,
        min_exudates_for_flag: 1,
        circinate_pattern_detection: true,
        min_angular_dispersion: 0.5,
        visual_zones: {
          show_foveal_zone: true,
          foveal_zone_radius_um: 500,
        },
      };

      const result = detectMacularEdema(allDets, fovea, calibration, defaultCriteria);

      return result.circinateAnalysis || null;
    } catch (error) {
      console.error('Error calculating circinate analysis:', error);
      return null;
    }
  }, [aiDetections, manualDetections]);

  const handleLayerUpdate = (layerId: string, updates: Partial<CanvasLayer>) => {
    setLayers((prev) =>
      prev.map((layer) => (layer.id === layerId ? { ...layer, ...updates } : layer))
    );
  };

  const handleLayerReorder = (oldIndex: number, newIndex: number) => {
    setLayers((prev) => {
      const newLayers = [...prev];
      const [movedLayer] = newLayers.splice(oldIndex, 1);
      newLayers.splice(newIndex, 0, movedLayer);
      return newLayers;
    });
  };

  // Find optic disc for cup drawer
  const opticDiscDetection = allDetections?.find(d =>
    d.class && typeof d.class === 'string' &&
    ['optic_disc', 'optic disc', 'disc', 'disco optico', 'disco óptico'].some(term =>
      d.class!.toLowerCase().trim().includes(term)
    )
  ) || null;

  // Find existing optic cup detection
  const opticCupDetection = allDetections?.find(d =>
    d.class && typeof d.class === 'string' &&
    ['optic_cup', 'optic cup', 'cup', 'copa optica', 'copa óptica'].some(term =>
      d.class!.toLowerCase().trim().includes(term)
    )
  ) || null;

  // Handle cup drawer - open when cup tool is selected
  useEffect(() => {
    if (activeTool === 'cup') {
      setCupDrawerOpen(true);
    }
  }, [activeTool]);

  // Limpiar imagen procesada al cambiar de herramienta
  useEffect(() => {
    if (activeTool !== 'image-processing') {
      setProcessedImageCanvas(null);
    }
  }, [activeTool]);

  const handleSaveCup = async (data: {
    cupBbox: { x: number; y: number; width: number; height: number };
    discPoints?: {
      superior: { x: number; y: number };
      inferior: { x: number; y: number };
      nasal: { x: number; y: number };
      temporal: { x: number; y: number };
    };
    paintedPixels: string[];
  }) => {
    if (!imageId) return;

    try {
      // Save or update cup as manual detection
      if (opticCupDetection?.id) {
        // Update existing cup
        await db.detections.update(opticCupDetection.id, {
          bbox: data.cupBbox,
          metadata: {
            ...opticCupDetection.metadata,
            paintedPixels: data.paintedPixels,
          },
        });
        console.log('✅ Cup updated successfully with', data.paintedPixels.length, 'pixels');
      } else {
        // Create new cup detection
        await db.detections.add({
          imageId: parseInt(imageId),
          class: 'optic_cup',
          bbox: data.cupBbox,
          confidence: 1.0,
          type: 'manual',
          visible: true,
          metadata: {
            paintedPixels: data.paintedPixels,
          },
          createdAt: new Date(),
        });
        console.log('✅ Cup saved successfully with', data.paintedPixels.length, 'pixels');
      }

      // If disc points were provided, update the optic disc detection with the points
      if (data.discPoints && opticDiscDetection?.id) {
        await db.detections.update(opticDiscDetection.id, {
          metadata: {
            ...opticDiscDetection.metadata,
            precisePoints: data.discPoints,
          },
        });

        logger.canvas.log('Disc points saved to optic disc detection');
      }
    } catch (error) {
      logger.canvas.error('Error saving cup', error);
    }
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

  const handleMarkImage = async () => {
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
    toast.success(t('contribution.dialog.imageMarked'));
    setShowContributionDialog(false);
  };

  const handleMarkSession = async () => {
    if (!session) return;

    try {
      // Get all images from this session
      const sessionImages = await db.images.where('sessionId').equals(session.id!).toArray();

      let markedCount = 0;
      for (const img of sessionImages) {
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

      toast.success(t('contribution.dialog.sessionMarked', { count: markedCount }));
      setShowContributionDialog(false);
    } catch (error) {
      toast.error('Error al marcar sesión');
    }
  };

  const handleUnmark = async () => {
    if (!image || !existingContribution) return;
    await db.pendingContributions.delete(existingContribution.id!);
    toast.success(t('contribution.dialog.unmarked'));
    setShowContributionDialog(false);
  };

  const isMarkedForContribution = existingContribution && existingContribution.status === 'pending';
  const showContributionPrompt = manualDetections.length > 0 || isMarkedForContribution;

  // Handle tool change with advanced mode detection
  const handleToolChange = (tool: CanvasTool) => {
    if (tool === 'image-processing') {
      if (isDesktop && !advancedEditor.state.isActive) {
        setShowAdvancedDialog(true);
        return;
      }
      // Dim original layer when processing tool is active
      handleLayerUpdate('original', { opacity: 0.4 });
    } else {
      // Restore original layer opacity when switching away
      const originalLayer = layers.find(l => l.id === 'original');
      if (originalLayer && originalLayer.opacity !== 1) {
        handleLayerUpdate('original', { opacity: 1 });
      }
    }
    setActiveTool(tool);
  };

  // Advanced mode handlers
  const handleAdvancedModeConfirm = () => {
    setShowAdvancedDialog(false);
    advancedEditor.enterAdvancedMode();
    setActiveTool('image-processing');
  };

  const handleAdvancedModeCancel = () => {
    setShowAdvancedDialog(false);
    // Activar la herramienta de procesamiento normal
    setActiveTool('image-processing');
  };

  const handleAdvancedModeExit = () => {
    advancedEditor.exitAdvancedMode();
    setActiveTool('select');
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

  const mainContent = (
    <div className={cn(
      "flex flex-col h-[100vh] xl:h-[calc(100vh-11rem)] relative bg-ice dark:bg-gray-900",
      advancedEditor.state.isActive && "h-full xl:h-full bg-transparent dark:bg-transparent"
    )}>
      {/* Header - Visible on Mobile (Portrait & Landscape) and Desktop */}
      {!advancedEditor.state.isActive && (
        <div className={cn(
          "flex items-center justify-between mb-2 flex-shrink-0",
          // Add padding on mobile because MainLayout(fullScreenOnMobile) removes it
          "p-2 xl:p-0 xl:mb-6"
        )}>
        <div className="flex items-center space-x-4 overflow-hidden">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(`/patients/${patientId}/sessions/${sessionId}`)}
            className="flex-shrink-0 w-8 h-8 xl:w-10 xl:h-10"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg xl:text-3xl font-bold text-coal-800 dark:text-gray-100 truncate">{t('analysis.title')}</h1>
            <p className="text-xs xl:text-sm text-smoke-500 dark:text-gray-400 mt-0.5 truncate">{image.filename}</p>
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
        <div className="flex xl:hidden items-center space-x-1 ml-2 flex-shrink-0">
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
      )}

      {/* Mobile Collapsible Panels */}
      {!advancedEditor.state.isActive && (
      <div className="xl:hidden px-2 flex-shrink-0 relative z-10">
         {showMobileTools && (
           <div className="absolute top-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg p-2 rounded-b-lg border-t border-coal-100 dark:border-gray-700">
              <ToolPanel
                activeTool={activeTool}
                onToolChange={handleToolChange}
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
               selectedAnnotationId={selectedAnnotationId}
               circinateAnalysis={circinateAnalysis}
               selectedMeasurementId={selectedMeasurementId}
               onSelectAnnotation={setSelectedAnnotation}
               onSelectMeasurement={setSelectedMeasurementId}
             />
           </div>
         )}
      </div>
      )}

      {/* Main Content */}
      <div className={cn(
        "flex flex-col xl:grid xl:grid-cols-4 gap-6 flex-grow overflow-hidden relative",
        advancedEditor.state.isActive && "xl:flex xl:gap-0"
      )}>
        {/* Canvas Area */}
        <div className={cn(
          "xl:col-span-3 h-full w-full",
          advancedEditor.state.isActive && "xl:col-span-4"
        )}>
          <Card className={cn(
            "h-full flex flex-col border-0 xl:border shadow-none xl:shadow-sm bg-transparent xl:bg-white xl:dark:bg-gray-800 rounded-none xl:rounded-lg overflow-hidden",
            advancedEditor.state.isActive && "xl:border-0 xl:shadow-none xl:bg-transparent xl:rounded-none"
          )}>
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
                onLayerUpdate={handleLayerUpdate}
                selectedLandmarkType={selectedLandmarkType}
                selectedMeasurementId={selectedMeasurementId}
                onSelectMeasurement={setSelectedMeasurementId}
                onAnnotationAdded={handleAnnotationAdded}
                processedImageCanvas={processedImageCanvas}
                showOriginalOverlay={showOriginal}
                comparisonOpacity={comparisonOpacity}
                history={{
                  entries: detectionHistory,
                  index: historyIndex,
                  onAdd: addToHistory,
                  onUndo: handleUndo,
                  onRedo: handleRedo
                }}
              />

              {/* Analysis Badges - floating over canvas */}
              <AnalysisBadges
                circinateAnalysis={config.advancedAnalysis?.circinatePattern ? macularEdemaResult?.circinateAnalysis : null}
                macularEdemaResult={macularEdemaResult}
                hemorrhageAnalysis={hemorrhageAnalysisResult}
                microaneurysmAnalysis={microaneurysmAnalysisResult}
                opticDiscCuppingAnalysis={opticDiscCuppingResult}
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
        {!advancedEditor.state.isActive && (
          <div className="hidden xl:block h-full overflow-hidden pr-2">
          <div className="flex flex-col h-full space-y-3">
            {/* Fixed Tools Section - Always visible */}
            <div className="flex-shrink-0 space-y-3">
              <ToolPanel
                activeTool={activeTool}
                onToolChange={handleToolChange}
                disabled={session?.locked}
                selectedLandmarkType={selectedLandmarkType}
                onLandmarkTypeChange={setSelectedLandmarkType}
              />
            </div>

            {/* Conditional: Image Processing Panel */}
            {activeTool === 'image-processing' && (
              <div className="flex-shrink-0">
                <ImageProcessingPanel
                  imageBlob={image?.originalBlob || null}
                  onProcessedImage={setProcessedImageCanvas}
                  disabled={session?.locked}
                />
              </div>
            )}

            {/* Scrollable Layers Section */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <AdvancedLayerControls
                layers={layers}
                onLayerUpdate={handleLayerUpdate}
                aiDetections={aiDetections}
                manualDetections={manualDetections}
                measurements={allMeasurements || []}
                onDetectionsUpdate={handleAnnotationAdded}
                onMeasurementsUpdate={handleAnnotationAdded}
                onAddToHistory={addToHistory}
                selectedAnnotationId={selectedAnnotationId}
                selectedMeasurementId={selectedMeasurementId}
                onSelectAnnotation={setSelectedAnnotation}
                onSelectMeasurement={setSelectedMeasurementId}
                circinateAnalysis={circinateAnalysis}
              />
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Optic Disc Cup Drawer Modal */}
      <OpticDiscCupDrawer
        open={cupDrawerOpen}
        onOpenChange={(open) => {
          setCupDrawerOpen(open);
          if (!open) {
            setActiveTool('select'); // Return to select tool when closing
          }
        }}
        opticDisc={opticDiscDetection}
        opticCup={opticCupDetection}
        imageBlob={image?.originalBlob || null}
        onSaveCup={handleSaveCup}
      />

      <Dialog open={showContributionDialog} onOpenChange={setShowContributionDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Star className="w-5 h-5 fill-current" />
              {t('contribution.title')}
            </DialogTitle>
            <DialogDescription className="text-base font-medium text-coal-800 dark:text-gray-100">
              {t('contribution.dialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-smoke-600 dark:text-gray-300">
              {t('contribution.dialog.body1')}
            </p>
            <p className="text-sm text-smoke-600 dark:text-gray-300 italic">
              {t('contribution.dialog.body2')}
            </p>

            {!isMarkedForContribution && (
              <div className="border-t border-smoke-200 dark:border-coal-700 pt-4 space-y-3">
                <p className="text-sm font-medium text-coal-800 dark:text-gray-200">
                  {t('contribution.dialog.selectLevel')}
                </p>

                <div className="space-y-2">
                  <Button
                    className="w-full justify-start gap-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200"
                    onClick={handleMarkImage}
                  >
                    <ImageIcon className="w-4 h-4" />
                    {t('contribution.dialog.markThisImage')}
                  </Button>

                  <Button
                    className="w-full justify-start gap-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200"
                    onClick={handleMarkSession}
                  >
                    <Star className="w-4 h-4" />
                    {t('contribution.dialog.markWholeSession')}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContributionDialog(false)}>
              {t('ui.cancel')}
            </Button>
            {isMarkedForContribution && (
              <Button
                variant="destructive"
                onClick={handleUnmark}
              >
                {t('contribution.dialog.unmark')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <>
      <AdvancedEditorDialog
        isOpen={showAdvancedDialog}
        onConfirm={handleAdvancedModeConfirm}
        onCancel={handleAdvancedModeCancel}
      />

      <AdvancedEditorLayout
        isActive={advancedEditor.state.isActive}
        activeTool={activeTool}
        layers={layers}
        canUndo={historyIndex >= 0}
        canRedo={historyIndex < detectionHistory.length - 1}
        showGrid={advancedEditor.state.showGrid}
        showRulers={advancedEditor.state.showRulers}
        snapEnabled={advancedEditor.state.snapToGrid}
        showMiniMap={advancedEditor.state.showMiniMap}
        showLeftPanel={advancedEditor.state.showLeftPanel}
        showRightPanel={advancedEditor.state.showRightPanel}
        imageUrl={image?.originalBlob ? URL.createObjectURL(image.originalBlob) : undefined}
        onExit={handleAdvancedModeExit}
        onToolChange={handleToolChange}
        onLayerToggle={(layerId) => {
          handleLayerUpdate(layerId, {
            visible: !layers.find(l => l.id === layerId)?.visible
          });
        }}
        onLayerOpacityChange={(layerId, opacity) => {
          handleLayerUpdate(layerId, { opacity });
        }}
        onLayerLockToggle={(layerId) => {
          handleLayerUpdate(layerId, {
            locked: !layers.find(l => l.id === layerId)?.locked
          });
        }}
        onLayerReorder={handleLayerReorder}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onToggleGrid={advancedEditor.toggleGrid}
        onToggleRulers={advancedEditor.toggleRulers}
        onToggleSnap={advancedEditor.toggleSnapToGrid}
        onToggleMiniMap={advancedEditor.toggleMiniMap}
        layerData={{
          'detections-ai': aiDetections,
          'manual-annotations': manualDetections,
          'measurements': allMeasurements || [],
        }}
        onSelectAnnotation={(layerId, id) => {
          if (layerId === 'measurements') {
            setSelectedMeasurementId(id as number);
          } else {
            setSelectedAnnotation(String(id));
          }
        }}
        onDeleteAnnotation={async (layerId, id) => {
          try {
            if (layerId === 'measurements') {
              await db.measurements.delete(id as number);
            } else {
              const detection = allDetections?.find(d => d.id === id);
              if (detection) {
                addToHistory({ type: 'delete', detection });
                await db.detections.delete(Number(id));
              }
            }
          } catch (error) {
            logger.canvas.error('Error deleting item', error);
          }
        }}
        selectedLandmarkType={selectedLandmarkType}
        onLandmarkTypeChange={setSelectedLandmarkType}
        imageBlob={image?.originalBlob || null}
        onProcessedImage={setProcessedImageCanvas}
      >
        {mainContent}
      </AdvancedEditorLayout>
    </>
  );
};

export default ImageAnalyzer;
