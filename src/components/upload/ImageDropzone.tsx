import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useImageUploader } from '@/hooks/useImageUploader';
import { Button } from '../ui/button';

interface ImageDropzoneProps {
  sessionId: number;
  onUploadComplete?: () => void;
}

const ImageDropzone: React.FC<ImageDropzoneProps> = ({ sessionId, onUploadComplete }) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const {
    selectedEye,
    setSelectedEye,
    uploadingFiles,
    getRootProps,
    getHiddenInput,
    triggerFileDialog
  } = useImageUploader({ sessionId, onUploadComplete });

  const { onDragOver, onDrop } = getRootProps();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
    onDragOver(e);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    onDrop(e);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {getHiddenInput()}

      <div className="flex items-center justify-center gap-4 p-4 mb-4 bg-coal-50 rounded-lg">
        <span className="text-sm font-medium text-coal-700">{t('upload.selectEye')}</span>
        <div className="flex gap-2">
          <Button
            variant={selectedEye === 'OI' ? 'default' : 'outline'}
            onClick={() => setSelectedEye('OI')}
          >
            {t('upload.eye.left')}
          </Button>
          <Button
            variant={selectedEye === 'OD' ? 'default' : 'outline'}
            onClick={() => setSelectedEye('OD')}
          >
            {t('upload.eye.right')}
          </Button>
        </div>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileDialog}
        className={cn(
          'border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer',
          isDragging ? 'border-primary-500 bg-primary-50' : 'border-coal-300 hover:border-primary-400'
        )}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-smoke-400" />
        <p className="text-coal-800 font-medium mb-2">{t('upload.dropzone')}</p>
        <p className="text-sm text-smoke-500">{t('upload.accepted')}</p>
        <p className="text-xs text-smoke-400 mt-1">{t('upload.maxSize')}</p>
      </div>

      {uploadingFiles.length > 0 && (
        <div className="space-y-2 mt-4">
          {uploadingFiles.map((uf) => (
            <div
              key={uf.id}
              className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-coal-200"
            >
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-coal-800 truncate">{uf.file.name}</span>
                  {uf.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {uf.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                </div>
                {uf.status === 'uploading' && (
                  <div className="h-1.5 bg-coal-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 transition-all" style={{ width: `${uf.progress}%` }} />
                  </div>
                )}
                {uf.status === 'error' && <p className="text-xs text-red-500">{uf.error}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageDropzone;