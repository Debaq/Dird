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
import { Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Image } from '@/lib/db/schema';
import { updateImageEyeType } from '@/lib/db/actions';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next'; // Added this line

interface ImageGalleryProps {
  images: Image[];
  patientId: string;
  sessionId: string;
  onDelete?: (imageId: number) => void;
  isLocked?: boolean;
}

interface DraggableImageCardProps {
  image: Image;
  thumbnail: string | undefined;
  patientId: string;
  sessionId: string;
  onDelete?: (imageId: number) => void;
  isLocked?: boolean;
  isDragging?: boolean;
  style?: React.CSSProperties;
  listeners?: ReturnType<typeof useSortable>['listeners'];
  attributes?: ReturnType<typeof useSortable>['attributes'];
}

const DraggableImageCard = React.forwardRef<HTMLDivElement, DraggableImageCardProps>(
  (
    { image, thumbnail, patientId, sessionId, onDelete, isLocked, isDragging, style, listeners, attributes, ...props },
    ref
  ) => {
    const navigate = useNavigate();
    const cardStyle = {
      ...style,
      opacity: isDragging ? 0 : 1,
      cursor: isLocked ? 'default' : 'grab',
    };

    return (
      <div
        ref={ref}
        style={cardStyle}
        {...listeners}
        {...attributes}
        {...props}
        className="group relative bg-white rounded-lg border border-coal-200 overflow-hidden hover:shadow-strong transition-shadow touch-none"
      >
        <div className="aspect-square overflow-hidden bg-coal-50">
          {thumbnail && <img src={thumbnail} alt={image.filename} className="w-full h-full object-cover" />}
        </div>
        <div className="p-3">
          <p className="text-sm font-medium text-coal-800 truncate">{image.filename}</p>
          <p className="text-xs text-smoke-500">{`${image.width} × ${image.height}`}</p>
        </div>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity space-x-1">
          <Button
            size="icon"
            variant="secondary"
            onClick={() => navigate(`/patients/${patientId}/sessions/${sessionId}/images/${image.id}`)}
            className="bg-white hover:bg-coal-100"
          >
            <Eye className="w-4 h-4" />
          </Button>
          {onDelete && !isLocked && (
            <Button
              size="icon"
              variant="destructive"
              onClick={() => image.id && onDelete(image.id)}
              className="bg-white hover:bg-red-500 text-red-500 hover:text-white"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }
);

interface SortableImageCardProps {
  image: Image;
  thumbnail: string | undefined;
  patientId: string;
  sessionId: string;
  onDelete?: (imageId: number) => void;
  isLocked?: boolean;
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
const ImageGallery: React.FC<ImageGalleryProps> = ({ images, patientId, sessionId, onDelete, isLocked }) => {
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const [activeImage, setActiveImage] = useState<Image | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));
  const { t } = useTranslation(); // Added this line

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
      try {
        await updateImageEyeType(activeImage.id!, targetEye);
      } catch (error) {
        console.error("Failed to update image eye type", error);
      }
    }
  };

  const DroppableColumn: React.FC<{ id: 'OI' | 'OD'; title: string; imageList: Image[]; className: string; }> = ({ id, title, imageList, className }) => {
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
              isLocked={isLocked}
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
        <SortableContext items={oiImages.map(i => i.id!)} strategy={rectSortingStrategy}>
          <DroppableColumn id="OI" title={t('upload.eye.leftLabel')} imageList={oiImages} className="bg-primary-50 border-primary-200 text-primary-700" />
        </SortableContext>
        <SortableContext items={odImages.map(i => i.id!)} strategy={rectSortingStrategy}>
          <DroppableColumn id="OD" title={t('upload.eye.rightLabel')} imageList={odImages} className="bg-teal-50 border-teal-200 text-teal-700" />
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
            />
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
};

export default ImageGallery;
