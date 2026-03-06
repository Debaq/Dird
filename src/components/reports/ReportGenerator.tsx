import React, { useState } from 'react';
import { FileText, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { generateSessionReport } from '@/lib/pdf/report-generator';
import type { ReportType } from '@/lib/pdf/report-generator';
import { db } from '@/lib/db/schema';
import { useTokenStore } from '@/stores/token-store';
import { useConfigStore } from '@/stores/config-store';
import { processConclusion, confirmProcessing } from '@/lib/api/token-service';
import { getSessionClassifications } from '@/lib/analysis/image-classification-service';
import { classifyDiabeticRetinopathy, formatClassificationText } from '@/lib/analysis/dr-classifier';

interface ReportGeneratorProps {
  sessionId: number;
  onReportGenerated?: () => void;
}

const ReportGeneratorComponent: React.FC<ReportGeneratorProps> = ({
  sessionId,
  onReportGenerated,
}) => {
  const { t, i18n } = useTranslation();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [showDialog, setShowDialog] = useState(false);
  const [evaluatorNotes, setEvaluatorNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [previewGenerated, setPreviewGenerated] = useState(false);
  const [hasInteractedWithPreview, setHasInteractedWithPreview] = useState(false);
  const { tokens, setTokens } = useTokenStore();

  const handleGenerateReport = async (type: ReportType) => {
    // Check if user has tokens before generating
    const noTokensMode = tokens <= 0;
    
    if (noTokensMode) {
      toast.warning(t('reports.offlineModeWarning', { defaultValue: 'Sin tokens: Generando informe en modo offline (sin validación externa).' }));
    }

    setGenerating(true);
    try {
      // 1. Gather report data
      const session = await db.sessions.get(sessionId);
      if (!session) throw new Error('Session not found');

      const patient = await db.patients.get(session.patientId);
      if (!patient) throw new Error('Patient not found');

      const images = await db.images.where('sessionId').equals(sessionId).toArray();
      const allDetections = await Promise.all(
        images.map((img) => db.detections.where('imageId').equals(img.id!).toArray())
      );
      const detections = allDetections.flat();

      const allSegmentations = await Promise.all(
        images.map((img) => db.segmentations.where('imageId').equals(img.id!).toArray())
      );
      const segmentations = allSegmentations.flat();

      const allMeasurements = await Promise.all(
        images.map((img) => db.measurements.where('imageId').equals(img.id!).toArray())
      );
      const measurements = allMeasurements.flat();

      // Fetch AI Classifications
      const classifications = await getSessionClassifications(sessionId);

      let systemComment = '';
      let tokensConsumed = false;

      if (!noTokensMode) {
        // --- ONLINE MODE ---
        // Prepare report data for backend
        const reportDataForBackend = {
          patient: {
            id: patient.id,
            // Removed personal identifiers for privacy
          },
          session: {
            id: session.id,
            sessionNumber: session.sessionNumber,
            date: session.date,
            notes: session.notes,
          },
          images: images.map(img => ({
            id: img.id,
            filename: img.filename,
            width: img.width,
            height: img.height,
          })),
          detections: detections.map(d => ({
            id: d.id,
            imageId: d.imageId,
            type: d.type,
            bbox: d.bbox,
            class: d.class,
            confidence: d.confidence,
          })),
          classifications: classifications.map(c => ({
            eyeType: c.eyeType,
            severity: c.severity,
            severityLabel: c.severityLabel,
            confidence: c.confidence,
            criteria: c.criteria,
            lesions: c.lesions,
            warnings: c.warnings,
            // Guideline information
            guideline: c.guideline,
            guidelineName: c.guidelineName,
            guidelineVersion: c.guidelineVersion,
            treatments: c.treatments,
            followupDays: c.followupDays,
            urgency: c.urgency,
            rationale: c.rationale,
            rule421CriteriaMet: c.rule421CriteriaMet
          })),
          segmentations: segmentations.map(s => ({
            id: s.id,
            imageId: s.imageId,
            type: s.type,
            class: s.class,
            confidence: s.confidence,
          })),
          measurements: measurements.map(m => ({
            id: m.id,
            imageId: m.imageId,
            distancePixels: m.distancePixels,
            distanceDD: m.distanceDD,
          })),
          evaluatorNotes,
          reportType: type,
        };

        // Send to backend
        const { processed_data: processedData, ai_processed, message } = await processConclusion(reportDataForBackend, i18n.language);

        if (!processedData || !processedData._processing) {
          throw new Error('Invalid processed data received from server');
        }

        systemComment = processedData.ai_analysis || processedData._processing.comment || '';
        
        if (ai_processed) {
          // Confirm processing (consumes token) ONLY if AI actually processed it
          const remainingTokens = await confirmProcessing();
          setTokens(remainingTokens);
          tokensConsumed = true;
        } else if (message) {
          // AI failed (e.g. quota limit), show warning but continue with report generation
          toast.warning(message, { duration: 6000 });
        }
        
      } else {
        // --- OFFLINE MODE ---
        // Generate classification text locally
        const detectionsByEye = new Map<'OD' | 'OI', any[]>();
        
        // Group detections by eye (using image eyeType)
        for (const img of images) {
          const imgDetections = detections.filter(d => d.imageId === img.id);
          if (imgDetections.length > 0) {
            const current = detectionsByEye.get(img.eyeType) || [];
            detectionsByEye.set(img.eyeType, [...current, ...imgDetections]);
          }
        }

        // Get active guideline
        const { config } = useConfigStore.getState();
        const localClassification = await classifyDiabeticRetinopathy(detectionsByEye, patient, config.activeGuideline);
        const formattedText = formatClassificationText(localClassification);
        
        systemComment = `[OFFLINE GENERATION]\n${formattedText}`;
      }

      // Append system comment to notes
      // The AI now integrates the user's notes, so we use the AI output as the primary content.
      // We store the original user input in 'originalNotes' for reference.
      const finalNotes = systemComment || evaluatorNotes;

      // 4. Generate PDF with the processed notes
      const pdfBlob = await generateSessionReport(sessionId, type, finalNotes);

      // Check if a report of the same type already exists for this session
      const existingReport = await db.reports
        .where({ sessionId: sessionId, type: type })
        .first();

      if (existingReport) {
        // Update the existing report instead of creating a duplicate
        await db.reports.update(existingReport.id, {
          pdfBlob: pdfBlob,
          evaluatorNotes: finalNotes,
          originalNotes: evaluatorNotes, // Save original draft
          generatedAt: new Date(),
        });
      } else {
        // Create a new report
        await db.reports.add({
          sessionId: sessionId,
          type: type,
          reportCategory: 'single',
          pdfBlob: pdfBlob,
          evaluatorNotes: finalNotes,
          originalNotes: evaluatorNotes, // Save original draft
          areasOfInterest: [], // Initialize empty
          generatedAt: new Date(),
        });
      }

      // Only download final reports automatically, not preview reports
      if (type === 'final') {
        // Download PDF for final reports
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DIRD_Reporte_${type.toUpperCase()}_${sessionId}_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      // If final report, lock session
      if (type === 'final') {
        await db.sessions.update(sessionId, {
          locked: true,
          lockedAt: new Date(),
        });
      }

      // Close dialog only if final report
      if (type === 'final') {
        setShowDialog(false);
        onReportGenerated?.();

        if (noTokensMode) {
          toast.success(t('reports.generated') + ' ' + t('reports.generatedOffline'));
        } else if (tokensConsumed) {
          toast.success(t('reports.generated') + ` (Tokens restantes: ${tokens - 1})`);
        } else {
          toast.success(t('reports.generated'));
        }
      } else {
        // Preview generated successfully
        setPreviewGenerated(true);

        if (noTokensMode) {
          toast.success(t('reports.previewGenerated') + ' (' + t('reports.generatedOffline') + ')');
        } else if (tokensConsumed) {
          toast.success(t('reports.previewGenerated') + ` (Tokens restantes: ${tokens - 1})`);
        } else {
          toast.success(t('reports.previewGenerated'));
        }

        // Close dialog and refresh to show the preview in the list
        setShowDialog(false);
        onReportGenerated?.();
      }
      
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error(t('errors.unknown'));
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenDialog = async () => {
    setShowDialog(true);

    // Check if a preview report already exists for this session
    const existingPreview = await db.reports
      .where({ sessionId: sessionId, type: 'preview' })
      .first();

    if (existingPreview) {
      // Preview already exists, show options to regenerate or finalize
      setPreviewGenerated(true);

      // Check if user has interacted with the preview
      const hasInteracted = existingPreview.previewViewed ||
                           existingPreview.previewDownloaded ||
                           existingPreview.conclusionEdited;
      setHasInteractedWithPreview(hasInteracted || false);
    } else {
      // No preview yet, show only generate preview option
      setPreviewGenerated(false);
      setHasInteractedWithPreview(false);
    }
  };

  const handleDeletePreview = async () => {
    try {
      const existingPreview = await db.reports
        .where({ sessionId: sessionId, type: 'preview' })
        .first();

      if (existingPreview) {
        await db.reports.delete(existingPreview.id!);
        setPreviewGenerated(false);
        toast.success('Vista previa eliminada');
        onReportGenerated?.(); // Refresh reports list
      }
    } catch (error) {
      console.error('Error deleting preview:', error);
      toast.error('Error al eliminar la vista previa');
    }
  };

  return (
    <>
      <Button
        onClick={handleOpenDialog}
        className="flex items-center justify-center gap-2 h-auto min-h-[40px] py-2 whitespace-normal text-center leading-tight w-full sm:w-auto"
      >
        <FileText className="w-4 h-4 flex-shrink-0" />
        <span>{t('reports.generate')}</span>
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600" />
              {t('reports.generate')}
            </DialogTitle>
            <DialogDescription>
              {t('reports.dialogDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-semibold text-coal-700">
                {t('reports.evaluatorNotes')}
              </Label>
              <Textarea
                id="notes"
                value={evaluatorNotes}
                onChange={(e) => setEvaluatorNotes(e.target.value)}
                placeholder={t('reports.evaluatorNotesPlaceholder')}
                rows={5}
                className="resize-none"
                disabled={generating || previewGenerated}
              />
            </div>

            {!previewGenerated ? (
              <>
                {/* No preview exists - Show only generate preview option */}
                <div className="flex flex-col p-5 rounded-xl border-2 border-primary-200 bg-gradient-to-br from-primary-50/50 to-white">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-primary-500 text-white">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-coal-800 text-base">
                        {t('reports.preview')}
                      </h4>
                      <p className="text-xs text-smoke-600">
                        {t('reports.dialog.withAI')}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-smoke-700 mb-4 leading-relaxed">
                    {t('reports.previewDescription')}
                  </p>
                  <Button
                    size="lg"
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white"
                    onClick={() => handleGenerateReport('preview')}
                    disabled={generating}
                  >
                    {generating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        {t('reports.processingWithAI')}
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        {t('reports.previewButton')}
                      </>
                    )}
                  </Button>
                </div>

                {/* Important Note */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-blue-800 leading-tight">
                    <strong>{t('reports.importantNoteTitle')}</strong> {t('reports.importantNoteBody')}
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Preview exists - Show options */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 border-2 border-green-200">
                  <CheckCircle className="w-6 h-6 text-green-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-800 mb-1">
                      ✓ {t('reports.dialog.previewExists')}
                    </p>
                    <p className="text-xs text-green-700 leading-relaxed">
                      {t('reports.dialog.previewExistsDescription')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Option 1: Regenerate Preview */}
                  <div className="flex flex-col p-4 rounded-xl border-2 border-amber-200 bg-amber-50/50 hover:border-amber-300 transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 rounded-lg bg-amber-500 text-white">
                        <FileText className="w-4 h-4" />
                      </div>
                      <h4 className="font-bold text-coal-800 text-sm">
                        {t('reports.dialog.regenerateTitle')}
                      </h4>
                    </div>
                    <p className="text-xs text-smoke-600 mb-4 flex-grow">
                      {t('reports.dialog.regenerateDescription')}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-amber-300 hover:bg-amber-100"
                      onClick={async () => {
                        const confirmed = await confirm({
                          title: t('reports.dialog.regenerateConfirmTitle'),
                          description: t('reports.dialog.regenerateConfirmDescription'),
                          confirmText: t('common.confirm'),
                          cancelText: t('common.cancel'),
                          variant: 'warning',
                        });

                        if (confirmed) {
                          await handleDeletePreview();
                          await handleGenerateReport('preview');
                        }
                      }}
                      disabled={generating}
                    >
                      {generating ? (
                        t('ui.loading')
                      ) : (
                        <>
                          <FileText className="w-3.5 h-3.5 mr-2" />
                          {t('reports.dialog.regenerateButton')}
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Option 2: Finalize Report */}
                  <div className="flex flex-col p-4 rounded-xl border-2 border-accent-200 bg-accent-50/50 hover:border-accent-300 transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 rounded-lg bg-accent-500 text-white">
                        <Lock className="w-4 h-4" />
                      </div>
                      <h4 className="font-bold text-coal-800 text-sm">
                        {t('reports.dialog.finalizeTitle')}
                      </h4>
                    </div>
                    <p className="text-xs text-smoke-600 mb-4 flex-grow">
                      {t('reports.dialog.finalizeDescription')}
                    </p>
                    {!hasInteractedWithPreview && (
                      <div className="mb-3 p-2 rounded-md bg-amber-50 border border-amber-200">
                        <p className="text-[10px] text-amber-800 leading-tight">
                          <strong>{t('reports.dialog.interactionRequired', { defaultValue: 'Interacción requerida:' })}</strong> {t('reports.dialog.mustInteractFirst', { defaultValue: 'Debe visualizar, descargar o editar el preview primero' })}
                        </p>
                      </div>
                    )}
                    <Button
                      size="sm"
                      className="w-full bg-accent-500 hover:bg-accent-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={async () => {
                        const confirmed = await confirm({
                          title: t('confirmations.finalizeReportTitle') || t('reports.finalize'),
                          description: t('reports.finalWarning'),
                          confirmText: t('common.confirm'),
                          cancelText: t('common.cancel'),
                          variant: 'warning',
                        });

                        if (confirmed) {
                          handleGenerateReport('final');
                        }
                      }}
                      disabled={generating || !hasInteractedWithPreview}
                      title={!hasInteractedWithPreview ? t('reports.dialog.mustInteractFirst', { defaultValue: 'Debe visualizar, descargar o editar el preview primero' }) : ''}
                    >
                      {generating ? (
                        t('ui.loading')
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 mr-2" />
                          {t('reports.dialog.finalizeButton')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Warning Note */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                  <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-800 leading-tight">
                    <strong>{t('reports.dialog.warningTitle')}</strong> {t('reports.dialog.warningBody')}
                  </p>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {ConfirmDialogComponent}
    </>
  );
};

export default ReportGeneratorComponent;

