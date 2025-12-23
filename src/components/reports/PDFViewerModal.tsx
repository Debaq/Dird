import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface PDFViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBlob: Blob;
  title: string;
  onDownload: () => void;
}

const PDFViewerModal: React.FC<PDFViewerModalProps> = ({
  isOpen,
  onClose,
  pdfBlob,
  title,
  onDownload
}) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && pdfBlob) {
      try {
        const url = URL.createObjectURL(pdfBlob);
        setPdfUrl(url);
        setError(null);
      } catch (err) {
        console.error('Error creating PDF object URL:', err);
        setError('Failed to load PDF document');
      }
    } else {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
    }

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [isOpen, pdfBlob]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] flex flex-col p-0 m-0">
        <DialogHeader className="flex-row items-center justify-between p-4 border-b">
          <DialogTitle className="text-lg font-semibold">
            {title}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Descargar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="flex items-center gap-2"
            >
              Salir
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col relative">
          {error && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-red-500">{error}</div>
            </div>
          )}

          {!error && pdfUrl && (
            <div className="flex-1">
              <iframe
                src={pdfUrl}
                className="w-full h-full border-0"
                title="PDF Viewer"
                style={{ minHeight: '500px' }}
              />
            </div>
          )}

          {!error && !pdfUrl && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-smoke-600">Cargando PDF...</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PDFViewerModal;