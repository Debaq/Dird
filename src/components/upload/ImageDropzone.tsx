import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { cn } from '@/lib/utils';
import { db } from '@/lib/db/schema';

interface ImageDropzoneProps {
  sessionId: number;
  onUploadComplete?: () => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

const ImageDropzone: React.FC<ImageDropzoneProps> = ({ sessionId, onUploadComplete }) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [selectedEye, setSelectedEye] = useState<'OI' | 'OD'>('OI');

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const imageFiles = Array.from(files).filter((file) =>
        file.type.startsWith('image/')
      );

      const newUploadingFiles: UploadingFile[] = imageFiles.map((file) => ({
        file,
        progress: 0,
        status: 'uploading',
      }));

      setUploadingFiles((prev) => [...prev, ...newUploadingFiles]);

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];

        try {
          // Compression options
          const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 2048,
            useWebWorker: true,
          };

          // Compress image
          const compressedFile = await imageCompression(file, options);

          // Read image dimensions
          const img = new Image();
          const imageUrl = URL.createObjectURL(compressedFile);

          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageUrl;
          });

          // Save to IndexedDB
          await db.images.add({
            sessionId,
            filename: file.name,
            eyeType: selectedEye,
            originalBlob: compressedFile,
            width: img.width,
            height: img.height,
            uploadedAt: new Date(),
          });

          URL.revokeObjectURL(imageUrl);

          // Update status
          setUploadingFiles((prev) =>
            prev.map((uf, idx) =>
              uf.file === file ? { ...uf, progress: 100, status: 'success' } : uf
            )
          );
        } catch (error) {
          console.error('Error uploading image:', error);
          setUploadingFiles((prev) =>
            prev.map((uf) =>
              uf.file === file
                ? { ...uf, status: 'error', error: 'Error al procesar la imagen' }
                : uf
            )
          );
        }
      }

      // Call completion callback after a delay
      setTimeout(() => {
        onUploadComplete?.();
        setUploadingFiles([]);
      }, 1500);
    },
    [sessionId, selectedEye, onUploadComplete]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
    },
    [handleFiles]
  );

  const removeUploadingFile = (file: File) => {
    setUploadingFiles((prev) => prev.filter((uf) => uf.file !== file));
  };

  return (
    <div className="space-y-4">
      {/* Eye selector */}
      <div className="flex items-center justify-center gap-4 p-4 bg-coal-50 rounded-lg">
        <span className="text-sm font-medium text-coal-700">Seleccionar ojo:</span>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedEye('OI')}
            className={cn(
              'px-6 py-2 rounded-lg font-medium transition-all',
              selectedEye === 'OI'
                ? 'bg-primary-500 text-white shadow-md'
                : 'bg-white text-coal-700 border border-coal-300 hover:border-primary-400'
            )}
          >
            OI (Izquierdo)
          </button>
          <button
            onClick={() => setSelectedEye('OD')}
            className={cn(
              'px-6 py-2 rounded-lg font-medium transition-all',
              selectedEye === 'OD'
                ? 'bg-primary-500 text-white shadow-md'
                : 'bg-white text-coal-700 border border-coal-300 hover:border-primary-400'
            )}
          >
            OD (Derecho)
          </button>
        </div>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-coal-300 hover:border-primary-400'
        )}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept="image/*"
          multiple
          onChange={handleFileInput}
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <Upload className="w-12 h-12 mx-auto mb-4 text-smoke-400" />
          <p className="text-coal-800 font-medium mb-2">{t('upload.dropzone')}</p>
          <p className="text-sm text-smoke-500">{t('upload.accepted')}</p>
          <p className="text-xs text-smoke-400 mt-1">{t('upload.maxSize')}</p>
        </label>
      </div>

      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((uf, idx) => (
            <div
              key={idx}
              className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-coal-200"
            >
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-coal-800">
                    {uf.file.name}
                  </span>
                  {uf.status === 'uploading' && (
                    <button
                      onClick={() => removeUploadingFile(uf.file)}
                      className="text-smoke-400 hover:text-coal-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {uf.status === 'success' && (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  )}
                  {uf.status === 'error' && (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>
                {uf.status === 'uploading' && (
                  <div className="h-1.5 bg-coal-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 transition-all duration-300"
                      style={{ width: `${uf.progress}%` }}
                    />
                  </div>
                )}
                {uf.status === 'error' && (
                  <p className="text-xs text-red-500">{uf.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageDropzone;
