import React, { useCallback, useState, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { db } from '@/lib/db/schema';
import { useTranslation } from 'react-i18next'; // Added this line

interface UseImageUploaderProps {
  sessionId: number;
  onUploadComplete?: () => void;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

export const useImageUploader = ({ sessionId, onUploadComplete }: UseImageUploaderProps) => {
  const { t } = useTranslation(); // Added this line
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [selectedEye, setSelectedEye] = useState<'OI' | 'OD'>('OI');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));

      const newUploadingFiles: UploadingFile[] = imageFiles.map((file) => ({
        id: `${file.name}-${file.lastModified}`,
        file,
        progress: 0,
        status: 'uploading',
      }));

      setUploadingFiles((prev) => [...prev, ...newUploadingFiles]);

      for (const newFile of newUploadingFiles) {
        try {
          const options = { maxSizeMB: 1, maxWidthOrHeight: 2048, useWebWorker: true };
          const compressedFile = await imageCompression(newFile.file, options);

          const img = new Image();
          const imageUrl = URL.createObjectURL(compressedFile);
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageUrl;
          });

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
      }

      setTimeout(() => {
        onUploadComplete?.();
        setUploadingFiles([]);
      }, 1500);
    },
    [sessionId, selectedEye, onUploadComplete, t]
  );
  
  const triggerFileDialog = () => {
    fileInputRef.current?.click();
  };

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
    getRootProps,
    getHiddenInput,
  };
};
