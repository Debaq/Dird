import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useImageUploader } from '@/hooks/useImageUploader';
import { Button } from '../ui/button';
import UploadProgressModal from './UploadProgressModal';
import { db } from '@/lib/db/schema';

interface ImageDropzoneProps {
  sessionId: number;
  onUploadComplete?: () => void;
  onUploadStart?: () => void;
}

const ImageDropzone: React.FC<ImageDropzoneProps> = ({ sessionId, onUploadComplete, onUploadStart }) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [imageCount, setImageCount] = useState(0);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const {
    selectedEye,
    setSelectedEye,
    uploadingFiles,
    clearUploadState,
    getRootProps,
    getHiddenInput,
    triggerFileDialog
  } = useImageUploader({ sessionId, onUploadComplete, onUploadStart });

  const { onDragOver, onDrop } = getRootProps();

  // Check image count on component mount and when sessionId changes
  useEffect(() => {
    const fetchImageCount = async () => {
      const count = await db.images.where('sessionId').equals(sessionId).count();
      setImageCount(count);
      setIsLimitReached(count >= 20);
    };

    fetchImageCount();
  }, [sessionId]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (isLimitReached) return; // Don't allow drag over if limit is reached

    setIsDragging(true);
    onDragOver(e);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isLimitReached) return; // Don't allow drop if limit is reached

    setIsDragging(false);
    onDrop(e);
  };

  const handleClick = () => {
    if (isLimitReached) return; // Don't allow click if limit is reached
    triggerFileDialog();
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {getHiddenInput()}

      <div className="flex flex-wrap items-center justify-center gap-4 p-4 mb-4 bg-coal-50 rounded-lg">
        <span className="text-sm font-medium text-coal-700">{t('upload.selectEye')}</span>
        <div className="flex gap-2">
          <Button
            variant={selectedEye === 'OD' ? 'default' : 'outline'}
            onClick={() => setSelectedEye('OD')}
            disabled={isLimitReached}
          >
            {t('upload.eye.right')}
          </Button>          
          <Button
            variant={selectedEye === 'OI' ? 'default' : 'outline'}
            onClick={() => setSelectedEye('OI')}
            disabled={isLimitReached}
          >
            {t('upload.eye.left')}
          </Button>
        </div>
      </div>

      {isLimitReached && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
          <span className="text-red-700 text-sm">
            {t('upload.photoLimitExceeded', { limit: 20 })}
          </span>
        </div>
      )}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 lg:p-12 text-center transition-colors cursor-pointer',
          isLimitReached
            ? 'border-red-300 bg-red-50 cursor-not-allowed'
            : isDragging
              ? 'border-primary-500 bg-primary-50'
              : 'border-coal-300 hover:border-primary-400'
        )}
      >
        <Upload className={`w-12 h-12 mx-auto mb-4 ${isLimitReached ? 'text-red-400' : 'text-smoke-400'}`} />
        <p className={`font-medium mb-2 ${isLimitReached ? 'text-red-800' : 'text-coal-800'}`}>
          {isLimitReached ? t('upload.photoLimitExceeded', { limit: 20 }) : t('upload.dropzone')}
        </p>
        {!isLimitReached && (
          <>
            <p className="text-sm text-smoke-500">{t('upload.accepted')}</p>
            <p className="text-xs text-smoke-400 mt-1">{t('upload.maxSize')}</p>
            <p className="text-xs text-smoke-400 mt-1">
              {t('upload.imagesCount', { count: imageCount, limit: 20 })}
            </p>
          </>
        )}
      </div>

      <UploadProgressModal
        uploadingFiles={uploadingFiles}
        onClose={clearUploadState}
        onComplete={onUploadComplete}
      />
    </div>
  );
};

export default ImageDropzone;