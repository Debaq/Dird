import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

interface UploadProgressModalProps {
  uploadingFiles: UploadingFile[];
  onClose: () => void;
  onComplete?: () => void;
}

const UploadProgressModal: React.FC<UploadProgressModalProps> = ({ uploadingFiles, onClose, onComplete }) => {
  const { t } = useTranslation();

  const stats = useMemo(() => {
    const total = uploadingFiles.length;
    const completed = uploadingFiles.filter(f => f.status === 'success').length;
    const failed = uploadingFiles.filter(f => f.status === 'error').length;
    const uploading = uploadingFiles.filter(f => f.status === 'uploading').length;
    // Solo está todo listo cuando TODAS las imágenes están completadas o con error
    const allDone = total > 0 && (completed + failed) === total;
    const overallProgress = total > 0
      ? Math.round((completed / total) * 100)
      : 0;

    return { total, completed, failed, uploading, allDone, overallProgress };
  }, [uploadingFiles]);

  const isOpen = uploadingFiles.length > 0;

  const handleClose = () => {
    onClose();
    if (onComplete) {
      onComplete();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && stats.allDone) handleClose(); }}>
      <DialogContent className="sm:max-w-md" onPointerDown={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-center">
            {stats.allDone ? t('upload.modal.completed') : t('upload.modal.title')}
          </DialogTitle>
          <DialogDescription className="text-center">
            {stats.allDone
              ? t('upload.modal.descriptionComplete', { completed: stats.completed, total: stats.total })
              : t('upload.modal.description')
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Overall progress */}
          <div className="text-center">
            <p className="text-2xl font-bold text-primary-600">
              {stats.completed} / {stats.total}
            </p>
            <p className="text-sm text-smoke-500 mt-1">
              {t('upload.modal.imagesUploaded')}
            </p>
            {stats.failed > 0 && (
              <p className="text-sm text-red-500 mt-1">
                {t('upload.modal.imagesFailed', { count: stats.failed })}
              </p>
            )}
          </div>

          {/* Progress bar */}
          <Progress value={stats.overallProgress} className="h-2" />

          {/* File list */}
          <div className="max-h-64 overflow-y-auto space-y-2">
            {uploadingFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center space-x-3 p-3 bg-coal-50 rounded-lg border border-coal-200"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-coal-800 truncate">
                      {file.file.name}
                    </span>
                    {file.status === 'success' && (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 ml-2" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 ml-2" />
                    )}
                    {file.status === 'uploading' && (
                      <Loader2 className="w-4 h-4 text-primary-500 animate-spin flex-shrink-0 ml-2" />
                    )}
                  </div>

                  {file.status === 'uploading' && (
                    <div className="h-1.5 bg-coal-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}

                  {file.status === 'error' && file.error && (
                    <p className="text-xs text-red-500 mt-1">{file.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Status message */}
          {!stats.allDone && (
            <p className="text-xs text-center text-smoke-500">
              {t('upload.modal.pleaseWait')}
            </p>
          )}

          {/* Close button - only shown when all done */}
          {stats.allDone && (
            <div className="flex justify-center">
              <Button onClick={handleClose} className="w-full">
                {t('ui.close')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadProgressModal;
