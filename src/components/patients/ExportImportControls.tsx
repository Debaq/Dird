import React, { useState, useRef } from 'react';
import { Download, Upload, Database } from 'lucide-react';
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
import { exportPatient, exportAllData, downloadDirdFile } from '@/lib/export/dird-exporter';
import { importDirdFile } from '@/lib/export/dird-importer';
import type { ImportResult } from '@/lib/export/dird-importer';

interface ExportImportControlsProps {
  patientId?: number;
  patientName?: string;
  onImportComplete?: () => void;
}

const ExportImportControls: React.FC<ExportImportControlsProps> = ({
  patientId,
  patientName,
  onImportComplete,
}) => {
  const { t } = useTranslation();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportPatient = async () => {
    if (!patientId) return;

    try {
      const blob = await exportPatient(patientId);
      const filename = `paciente_${patientName?.replace(/\s/g, '_')}_${Date.now()}`;
      downloadDirdFile(blob, filename);
    } catch (error) {
      console.error('Error exporting patient:', error);
      toast.error(t('export.errorPatient'));
    }
  };

  const handleExportAll = async () => {
    try {
      const blob = await exportAllData();
      const filename = `dird_backup_${Date.now()}`;
      downloadDirdFile(blob, filename);
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error(t('export.errorData'));
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);

    try {
      const result = await importDirdFile(file);
      setImportResult(result);

      if (result.success) {
        setTimeout(() => {
          setShowImportDialog(false);
          onImportComplete?.();
        }, 3000);
      }
    } catch (error) {
      console.error('Error importing file:', error);
      setImportResult({
        success: false,
        error: t('import.processError'),
        sessionsImported: 0,
        imagesImported: 0,
        detectionsImported: 0,
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

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {patientId && (
          <Button variant="outline" onClick={handleExportPatient} size="sm">
            <Download className="w-4 h-4 mr-2" />
            {t('export.patient')}
          </Button>
        )}

        <Button variant="outline" onClick={handleExportAll} size="sm">
          <Database className="w-4 h-4 mr-2" />
          {t('export.all')}
        </Button>

        <Button variant="outline" onClick={() => setShowImportDialog(true)} size="sm">
          <Upload className="w-4 h-4 mr-2" />
          {t('export.import')}
        </Button>
      </div>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('import.title')}</DialogTitle>
            <DialogDescription>
              {t('import.description')}
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
                      <p>{t('import.patientLabel')}{importResult.patient?.name}</p>
                      <p>{t('import.sessionsImported')}{importResult.sessionsImported}</p>
                      <p>{t('import.imagesImported')}{importResult.imagesImported}</p>
                      <p>{t('import.detectionsImported')}{importResult.detectionsImported}</p>
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

export default ExportImportControls;
