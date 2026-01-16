import React, { useState, useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

import { exportAllData, downloadDirdFile } from '@/lib/export/dird-exporter';
import { importDirdFile, importDirdType } from '@/lib/export/dird-importer';
import type { ImportResult } from '@/lib/export/dird-importer';

interface ExportImportPatientsProps {
  onImportComplete?: () => void;
}

const ExportImportPatients: React.FC<ExportImportPatientsProps> = ({
  onImportComplete,
}) => {
  const { t } = useTranslation();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closeTimeoutRef = useRef<number | null>(null);


  const handleExportAll = async () => {
    setExporting(true);
    try {
      const blob = await exportAllData();
      downloadDirdFile(blob, `dird_backup_${Date.now()}`);
      toast.success(t('export.fullSuccess'));
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error(t('export.errorData'));
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);

    try {
      const type = await importDirdType(file);

      if (type === 'session') {
        setImporting(false);
        
        setImportResult({
          success: false,
          error: t('import.invalidFile'),
          patientsImported: 0,
          sessionsImported: 0,
          imagesImported: 0,
          detectionsImported: 0,
          segmentationsImported: 0,
          measurementsImported: 0,
          reportsImported: 0
        });
        return;
      }

      const result = await importDirdFile(file);
      setImportResult(result);

      if (result.success) {
        closeTimeoutRef.current = window.setTimeout(() => {
          setShowImportDialog(false);
          setImporting(false);
          setImportResult(null);
          onImportComplete?.();
        }, 5000);
      }

    } catch (error) {
      console.error('Error importing file:', error);
      setImportResult({
        success: false,
        error: t('import.processError'),
        sessionsImported: 0,
        imagesImported: 0,
        detectionsImported: 0,
        segmentationsImported: 0,
        measurementsImported: 0,
        reportsImported: 0
      });
    } finally {
      setImporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImport(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleImport(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">

        <Button 
          variant="outline" 
          onClick={handleExportAll} 
          size="sm"
          disabled={exporting}
          className="flex-1 md:flex-none"
        >
          <Download className="w-4 h-4 mr-2" />
          {exporting ? t('export.exporting') : t('export.all')}
        </Button>

        <Button variant="outline" onClick={() => setShowImportDialog(true)} size="sm">
          <Upload className="w-4 h-4 mr-2" />
          {t('import.patientTitle')}
        </Button>
      </div>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={(open) => {
        setShowImportDialog(open);

        if (!open) {
          if (closeTimeoutRef.current !== null) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
          }

          setImportResult(null);
          setImporting(false);
        }

        if (fileInputRef.current) {fileInputRef.current.value = '';}
      }}
      >

        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('import.patientTitle')}</DialogTitle>
            <DialogDescription>
              {t('import.patientDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!importing && !importResult && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".dird"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-coal-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-400 transition-colors"
                >
                  <Upload className="w-12 h-12 mx-auto mb-4 text-smoke-400" />
                  <p className="text-coal-800 font-medium mb-2">
                    {t('import.selectFile')}
                  </p>
                  <p className="text-sm text-smoke-500">{t('export.dragAndDrop')}</p>
                </div>
              </>
            )}

            {importing && (
              <div className="text-center py-8">
                <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-coal-800 font-medium">{t('import.importing')}</p>
                <p className="text-sm text-smoke-500">{t('import.waitMessage')}</p>
              </div>
            )}

            {importResult && (
              <div
                className={`p-4 rounded-lg ${
                  importResult.success
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                {importResult.success ? (
                  <div>
                    <h3 className="font-semibold text-green-800 mb-2">
                      {t('import.successTitle')}
                    </h3>
                    <div className="text-sm text-green-700 space-y-1">

                      {importResult.import_type === 'patient' && (
                        <p>{t('import.patientLabel')}{importResult.patient?.name}</p>
                      )}

                      {importResult.import_type === 'full' && (
                        <p>{t('import.patientsImported')}{importResult.patientsImported}</p>
                      )}

                      <p>{t('import.sessionsImported')}{importResult.sessionsImported}</p>
                      <p>{t('import.imagesImported')}{importResult.imagesImported}</p>
                      <p>{t('import.reportsImported')}{importResult.reportsImported}</p>
                      <p>{t('import.detectionsImported')}{importResult.detectionsImported}</p>
                      <p>{t('import.segmentationsImported')}{importResult.segmentationsImported}</p>
                      <p>{t('import.measurementsImported')}{importResult.measurementsImported}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="font-semibold text-red-800 mb-2">{t('import.errorTitle')}</h3>
                    <p className="text-sm text-red-700">{importResult.error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ExportImportPatients;
