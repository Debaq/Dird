import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, Brain, GripVertical, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Image as ImageType } from '@/lib/db/schema';
import { updateImageEyeType } from '@/lib/db/actions';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { inferenceService } from '@/lib/ai/inference-service';
import { db } from '@/lib/db/schema';

interface ImageGalleryProps {
  images: ImageType[];
  patientId: string;
  sessionId: string;
  onDelete?: (imageId: number) => void;
  isLocked?: boolean;
  refreshKey?: number;
}

interface DraggableImageCardProps {
  image: ImageType;
  thumbnail: string | undefined;
  patientId: string;
  sessionId: string;
  onDelete?: (imageId: number) => void;
  onMove?: (imageId: number, targetEye: 'OI' | 'OD') => void;
  isLocked?: boolean;
  isDragging?: boolean;
  style?: React.CSSProperties;
  listeners?: ReturnType<typeof useSortable>['listeners'];
  attributes?: ReturnType<typeof useSortable>['attributes'];
  refreshKey?: number;
}

const DraggableImageCard = React.forwardRef<HTMLDivElement, DraggableImageCardProps>(
  (
    { image, thumbnail, patientId, sessionId, onDelete, onMove, isLocked, isDragging, style, listeners, attributes, refreshKey, ...props },
    ref
  ) => {
    const navigate = useNavigate();
    const [detectionCount, setDetectionCount] = React.useState(0);
    const [isReprocessing, setIsReprocessing] = React.useState(false);
    const { t } = useTranslation();

    React.useEffect(() => {
      if (image.id) {
        db.detections.where('imageId').equals(image.id!).count().then(setDetectionCount);
      }
    }, [image.id, refreshKey, isReprocessing]);

    const handleViewImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(`/patients/${patientId}/sessions/${sessionId}/images/${image.id}`);
    };

    const handleReprocessAI = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!image.id || isLocked || isReprocessing) return;

      setIsReprocessing(true);
      try {
        // 1. Cargar el modelo si no está listo
        if (!inferenceService.isDetectionModelLoaded()) {
          await inferenceService.loadDetectionModel();
        }

        // 2. Eliminar SOLO detecciones de tipo 'ai'
        await db.detections
          .where('imageId')
          .equals(image.id)
          .and(d => d.type === 'ai')
          .delete();

        // 3. Crear elemento de imagen para el procesamiento
        const imgElement = new Image();
        const imageUrl = URL.createObjectURL(image.originalBlob);
        
        await new Promise((resolve, reject) => {
          imgElement.onload = resolve;
          imgElement.onerror = reject;
          imgElement.src = imageUrl;
        });

        // 4. Ejecutar detección
        await inferenceService.detectObjects(imgElement, image.id);
        
        URL.revokeObjectURL(imageUrl);
      } catch (error) {
        console.error('Error reprocessing AI:', error);
        alert(t('errors.processingImages', { error: (error as Error).message }));
      } finally {
        setIsReprocessing(false);
      }
    };

    const cardStyle = {
      ...style,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div
        ref={ref}
        style={cardStyle}
        {...attributes}
        {...props}
        className="group relative bg-white rounded-lg border border-coal-200 overflow-hidden hover:shadow-strong transition-shadow"
      >
        <div
          className="aspect-square overflow-hidden bg-coal-50 cursor-pointer relative"
          onClick={handleViewImage}
        >
          {thumbnail && <img src={thumbnail} alt={image.filename} className="w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full px-4 py-2 shadow-lg text-center">
              <p className="text-sm font-bold text-primary-600">
                {detectionCount > 0 ? t('upload.gallery.viewDetections', { count: detectionCount }) : t('upload.gallery.viewImage')}
              </p>
            </div>
          </div>
          {isReprocessing && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-20">
              <div className="flex flex-col items-center">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin mb-2" />
                <span className="text-xs font-semibold text-primary-700">{t('upload.gallery.processingAI')}</span>
              </div>
            </div>
          )}
        </div>
        <div className="p-3">
          <p className="text-sm font-medium text-coal-800 truncate">{image.filename}</p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-smoke-500">{`${image.width} × ${image.height}`}</p>
            {detectionCount > 0 && (
              <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                {detectionCount} {t('upload.gallery.detectedCount')}
              </span>
            )}
          </div>
        </div>

        {/* Floating Controls */}
        <div className="absolute top-2 right-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex flex-col space-y-1 z-10">
          {onDelete && !isLocked && (
            <Button
              size="icon"
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                image.id && onDelete(image.id);
              }}
              className="w-8 h-8 bg-white hover:bg-red-500 text-red-500 hover:text-white shadow-sm"
              title={t('upload.gallery.deleteImage')}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          {!isLocked && (
            <Button
              size="icon"
              variant="secondary"
              onClick={handleReprocessAI}
              disabled={isReprocessing}
              className={cn(
                "w-8 h-8 bg-white hover:bg-primary-50 text-primary-600 shadow-sm transition-transform",
                detectionCount === 0 && !isReprocessing && "animate-pulse-soft"
              )}
              title={t('upload.gallery.reprocessAI')}
            >
              {isReprocessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            </Button>
          )}
        </div>

        {/* Move Buttons (User suggestion) */}
        {!isLocked && onMove && (
          <div className="absolute bottom-16 right-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="secondary"
              className="h-8 px-2 bg-white/90 backdrop-blur-sm shadow-sm border border-coal-200"
              onClick={(e) => {
                e.stopPropagation();
                if (image.id) {
                  onMove(image.id, image.eyeType === 'OI' ? 'OD' : 'OI');
                }
              }}
            >
              {image.eyeType === 'OI' ? (
                <>
                  <span className="text-[10px] mr-1">{t('upload.gallery.moveToRight')}</span>
                  <ArrowRight className="w-3 h-3" />
                </>
              ) : (
                <>
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  <span className="text-[10px]">{t('upload.gallery.moveToLeft')}</span>
                </>
              )}
            </Button>
          </div>
        )}

        {/* Drag Handle (To prevent blocking clicks on the rest of the card) */}
        {!isLocked && (
          <div
            {...listeners}
            className="absolute top-2 left-2 p-1.5 bg-white/80 backdrop-blur-sm rounded-md border border-coal-200 cursor-grab active:cursor-grabbing opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shadow-sm"
          >
            <GripVertical className="w-4 h-4 text-coal-400" />
          </div>
        )}
      </div>
    );
  }
);

interface SortableImageCardProps {
  image: ImageType;
  thumbnail: string | undefined;
  patientId: string;
  sessionId: string;
  onDelete?: (imageId: number) => void;
  onMove?: (imageId: number, targetEye: 'OI' | 'OD') => void;
  isLocked?: boolean;
  refreshKey?: number;
}

const SortableImageCard: React.FC<SortableImageCardProps> = (props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.image.id!,
    disabled: props.isLocked,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <DraggableImageCard
      ref={setNodeRef}
      style={style}
      isDragging={isDragging}
      attributes={attributes}
      listeners={listeners}
      {...props}
    />
  );
};

// Main ImageGallery Component
const ImageGallery: React.FC<ImageGalleryProps> = ({ images, patientId, sessionId, onDelete, isLocked, refreshKey }) => {
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const [activeImage, setActiveImage] = useState<ImageType | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  const { t } = useTranslation();

  useEffect(() => {
    const newThumbnails = new Map<number, string>();
    for (const image of images) {
      if (image.id) {
        const url = URL.createObjectURL(image.originalBlob);
        newThumbnails.set(image.id, url);
      }
    }
    setThumbnails(newThumbnails);

    return () => {
      newThumbnails.forEach(url => URL.revokeObjectURL(url));
    };
  }, [images]);

  const { oiImages, odImages } = useMemo(() => {
    const oi = images.filter(img => img.eyeType === 'OI');
    const od = images.filter(img => img.eyeType === 'OD');
    return { oiImages: oi, odImages: od };
  }, [images]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveImage(images.find(img => img.id === active.id) || null);
  };

  const handleMove = async (imageId: number, targetEye: 'OI' | 'OD') => {
    try {
      await updateImageEyeType(imageId, targetEye);
    } catch (error) {
      console.error("Failed to update image eye type", error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveImage(null);
    const { active, over } = event;

    if (!over) {
      return;
    }

    const activeImage = images.find(img => img.id === active.id);
    if (!activeImage) {
      return;
    }

    let targetEye: 'OI' | 'OD' | null = null;
    if (over.id === 'OI' || oiImages.some(i => i.id === over.id)) {
      targetEye = 'OI';
    } else if (over.id === 'OD' || odImages.some(i => i.id === over.id)) {
      targetEye = 'OD';
    }

    if (targetEye && activeImage.eyeType !== targetEye) {
      handleMove(activeImage.id!, targetEye);
    }
  };

  const DroppableColumn: React.FC<{ id: 'OI' | 'OD'; title: string; imageList: ImageType[]; className: string; }> = ({ id, title, imageList, className }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
      <div className={cn('space-y-4 p-4 rounded-lg transition-colors', isOver && !isLocked ? 'bg-primary-50' : 'bg-coal-50/50')}>
        <div className={cn("flex items-center gap-2 px-4 py-2 rounded-lg border-2", className)}>
          <h3 className="text-lg font-bold">{title}</h3>
          <span className="text-sm">({imageList.length})</span>
        </div>
        <div ref={setNodeRef} className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[150px]">
          {imageList.map(image => (
            <SortableImageCard
              key={image.id}
              image={image}
              thumbnail={thumbnails.get(image.id!)}
              patientId={patientId}
              sessionId={sessionId}
              onDelete={onDelete}
              onMove={handleMove}
              isLocked={isLocked}
              refreshKey={refreshKey}
            />
          ))}
        </div>
      </div>
    );
  };

  if (images.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-coal-200 rounded-lg">
        <p className="text-smoke-500">{t('upload.galleryEmpty')}</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={isLocked ? undefined : handleDragEnd}
      collisionDetection={closestCenter}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SortableContext items={odImages.map(i => i.id!)} strategy={rectSortingStrategy}>
          <DroppableColumn id="OD" title={t('upload.eye.rightLabel')} imageList={odImages} className="bg-teal-50 border-teal-200 text-teal-700" />
        </SortableContext>
        <SortableContext items={oiImages.map(i => i.id!)} strategy={rectSortingStrategy}>
          <DroppableColumn id="OI" title={t('upload.eye.leftLabel')} imageList={oiImages} className="bg-primary-50 border-primary-200 text-primary-700" />
        </SortableContext>
      </div>
      {createPortal(
        <DragOverlay>
          {activeImage ? (
            <DraggableImageCard
              image={activeImage}
              thumbnail={thumbnails.get(activeImage.id!)}
              patientId={patientId}
              sessionId={sessionId}
              isLocked={isLocked}
              refreshKey={refreshKey}
            />
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
};

export default ImageGallery;
