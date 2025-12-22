import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Image } from '@/lib/db/schema';

interface ImageGalleryProps {
  images: Image[];
  patientId: string;
  sessionId: string;
  onDelete?: (imageId: number) => void;
  onView?: (image: Image) => void;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images, patientId, sessionId, onDelete, onView }) => {
  const navigate = useNavigate();
  const [thumbnails, setThumbnails] = React.useState<Map<number, string>>(new Map());

  React.useEffect(() => {
    const loadThumbnails = async () => {
      const newThumbnails = new Map<number, string>();

      for (const image of images) {
        if (image.id) {
          const url = URL.createObjectURL(image.originalBlob);
          newThumbnails.set(image.id, url);
        }
      }

      setThumbnails(newThumbnails);
    };

    loadThumbnails();

    return () => {
      thumbnails.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [images]);

  if (images.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-coal-200 rounded-lg">
        <p className="text-smoke-500">
          No hay imágenes en esta sesión. Sube algunas para comenzar el análisis.
        </p>
      </div>
    );
  }

  // Group images by eye type
  const oiImages = images.filter(img => img.eyeType === 'OI');
  const odImages = images.filter(img => img.eyeType === 'OD');

  const renderImageCard = (image: Image) => (
    <div
      key={image.id}
      className="group relative bg-white rounded-lg border border-coal-200 overflow-hidden hover:shadow-strong transition-shadow"
    >
      <div className="aspect-square overflow-hidden bg-coal-50">
        {image.id && thumbnails.has(image.id) && (
          <img
            src={thumbnails.get(image.id)}
            alt={image.filename}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="p-3">
        <p className="text-sm font-medium text-coal-800 truncate">
          {image.filename}
        </p>
        <p className="text-xs text-smoke-500">
          {image.width} × {image.height}
        </p>
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
        {onDelete && (
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* OI Column */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-lg border-2 border-primary-200">
          <h3 className="text-lg font-bold text-primary-700">OI (Ojo Izquierdo)</h3>
          <span className="text-sm text-primary-600">({oiImages.length})</span>
        </div>
        {oiImages.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-coal-200 rounded-lg">
            <p className="text-sm text-smoke-500">Sin imágenes del ojo izquierdo</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {oiImages.map(renderImageCard)}
          </div>
        )}
      </div>

      {/* OD Column */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-4 py-2 bg-teal-50 rounded-lg border-2 border-teal-200">
          <h3 className="text-lg font-bold text-teal-700">OD (Ojo Derecho)</h3>
          <span className="text-sm text-teal-600">({odImages.length})</span>
        </div>
        {odImages.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-coal-200 rounded-lg">
            <p className="text-sm text-smoke-500">Sin imágenes del ojo derecho</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {odImages.map(renderImageCard)}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageGallery;
