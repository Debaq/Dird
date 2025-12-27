import React, { useCallback, useState, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { db } from '@/lib/db/schema';
import { useTranslation } from 'react-i18next'; // Added this line

interface UseImageUploaderProps {
  sessionId: number;
  onUploadComplete?: () => void;
  onUploadStart?: () => void;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

export const useImageUploader = ({ sessionId, onUploadComplete: _onUploadComplete, onUploadStart }: UseImageUploaderProps) => {
  const { t } = useTranslation(); // Added this line
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [selectedEye, setSelectedEye] = useState<'OI' | 'OD'>('OI');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
      if (imageFiles.length === 0) return;

      // Notify parent that upload is starting
      onUploadStart?.();

      const newUploadingFiles: UploadingFile[] = imageFiles.map((file) => ({
        id: `${file.name}-${file.lastModified}`,
        file,
        progress: 0,
        status: 'uploading',
      }));

      setUploadingFiles((prev) => [...prev, ...newUploadingFiles]);

      // Process single image function
      const processImage = async (newFile: UploadingFile) => {
        try {
          // Start compression - update to 10%
          setUploadingFiles((prev) =>
            prev.map((uf) =>
              uf.id === newFile.id ? { ...uf, progress: 10 } : uf
            )
          );

          const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 2048,
            useWebWorker: true
          };
          const compressedFile = await imageCompression(newFile.file, options);

          // Update progress to 50% after compression
          setUploadingFiles((prev) =>
            prev.map((uf) =>
              uf.id === newFile.id ? { ...uf, progress: 50 } : uf
            )
          );

          const img = new Image();
          const imageUrl = URL.createObjectURL(compressedFile);
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageUrl;
          });

          // Update progress to 70% after image load
          setUploadingFiles((prev) =>
            prev.map((uf) =>
              uf.id === newFile.id ? { ...uf, progress: 70 } : uf
            )
          );

          await db.images.add({
            sessionId,
            filename: newFile.file.name,
            eyeType: selectedEye,
            originalBlob: compressedFile,
            width: img.width,
            height: img.height,
            uploadedAt: new Date(),
          });

          URL.revokeObjectURL(imageUrl);

          // Update to 100% after successful save
          setUploadingFiles((prev) =>
            prev.map((uf) =>
              uf.id === newFile.id ? { ...uf, progress: 100, status: 'success' } : uf
            )
          );
        } catch (error) {
          console.error('Error uploading image:', error);
          setUploadingFiles((prev) =>
            prev.map((uf) =>
              uf.id === newFile.id
                ? { ...uf, status: 'error', error: t('errors.imageProcessing') }
                : uf
            )
          );
        }
      };

      // Process images with concurrency limit (2 at a time)
      const CONCURRENCY_LIMIT = 2;

      // Simple approach: split into batches and process each batch in parallel
      for (let i = 0; i < newUploadingFiles.length; i += CONCURRENCY_LIMIT) {
        const batch = newUploadingFiles.slice(i, i + CONCURRENCY_LIMIT);
        await Promise.all(batch.map(file => processImage(file)));
      }
    },
    [sessionId, selectedEye, onUploadStart, t]
  );
  
  const triggerFileDialog = () => {
    fileInputRef.current?.click();
  };

  const clearUploadState = useCallback(() => {
    setUploadingFiles([]);
  }, []);

  const getRootProps = () => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleFiles(e.dataTransfer.files);
    },
  });

  const getHiddenInput = () => (
    <input
      ref={fileInputRef}
      type="file"
      className="hidden"
      accept="image/*"
      multiple
      onChange={(e) => handleFiles(e.target.files)}
    />
  );

  return {
    selectedEye,
    setSelectedEye,
    uploadingFiles,
    triggerFileDialog,
    clearUploadState,
    getRootProps,
    getHiddenInput,
  };
};
