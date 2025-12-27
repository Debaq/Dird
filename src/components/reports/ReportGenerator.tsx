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
import { isDemoPreviewSession } from '@/lib/db/demoPatient';
import { useTokenStore } from '@/stores/token-store';
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
  const [reportType, setReportType] = useState<ReportType>('preview');
  const { tokens, setTokens } = useTokenStore();

  const handleGenerateReport = async (type: ReportType) => {
    // Check if user has tokens before generating
    const noTokensMode = tokens <= 0;
    
    if (noTokensMode) {
      toast.warning(t('reports.offlineModeWarning', { defaultValue: 'Sin tokens: Generando informe en modo offline (sin validación externa).' }));
    }

    setGenerating(true);
    setReportType(type);
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
            confidence: c.confidence,
            criteria: c.criteria,
            lesions: c.lesions,
            warnings: c.warnings
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

        const localClassification = classifyDiabeticRetinopathy(detectionsByEye, patient);
        const formattedText = formatClassificationText(localClassification);
        
        systemComment = `[OFFLINE GENERATION]\n${formattedText}`;
      }

      // Append system comment to notes
      let finalNotes = evaluatorNotes;
      if (systemComment) {
        finalNotes = finalNotes 
          ? `${finalNotes}\n\n[IA]: ${systemComment}`
          : `[IA]: ${systemComment}`;
      }

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

      // If final report, lock session (unless it's the demo preview session)
      if (type === 'final') {
        const isDemoPreview = await isDemoPreviewSession(sessionId);
        if (!isDemoPreview) {
          await db.sessions.update(sessionId, {
            locked: true,
            lockedAt: new Date(),
          });
        }
      }

      setShowDialog(false);
      onReportGenerated?.();
      
      if (noTokensMode) {
        toast.warning(t('reports.generatedOffline', { defaultValue: 'Informe generado en modo offline.' }));
      } else if (tokensConsumed) {
        toast.success(t('reports.generated') + ` (Tokens restantes: ${tokens - 1})`);
      } else {
        // Tokens available but not consumed (e.g. AI quota limit reached)
        toast.success(t('reports.generated'));
      }
      
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error(t('errors.unknown'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Button 
        onClick={() => setShowDialog(true)} 
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
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Preview Report Card */}
              <div className="flex flex-col p-4 rounded-xl border border-coal-200 bg-coal-50/50 hover:border-primary-300 transition-all group">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-white border border-coal-200 group-hover:border-primary-200">
                    <FileText className="w-4 h-4 text-primary-500" />
                  </div>
                  <h4 className="font-bold text-coal-800 text-sm">
                    {t('reports.preview')}
                  </h4>
                </div>
                <p className="text-xs text-smoke-600 mb-4 flex-grow">
                  {t('reports.previewDescription')}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-white"
                  onClick={() => handleGenerateReport('preview')}
                  disabled={generating}
                >
                  {generating && reportType === 'preview' ? (
                    t('ui.loading')
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5 mr-2" />
                      {t('reports.previewButton')}
                    </>
                  )}
                </Button>
              </div>

              {/* Final Report Card */}
              <div className="flex flex-col p-4 rounded-xl border border-accent-100 bg-accent-50/30 hover:border-accent-400 transition-all group">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-white border border-accent-100 group-hover:border-accent-200">
                    <Lock className="w-4 h-4 text-accent-500" />
                  </div>
                  <h4 className="font-bold text-coal-800 text-sm">
                    {t('reports.finalize')}
                  </h4>
                </div>
                <p className="text-xs text-smoke-600 mb-4 flex-grow">
                  {t('reports.finalizeDescription')}
                </p>
                <Button
                  size="sm"
                  className="w-full bg-accent-500 hover:bg-accent-600 text-white"
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
                  disabled={generating}
                >
                  {generating && reportType === 'final' ? (
                    t('ui.loading')
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 mr-2" />
                      {t('reports.finalize')}
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-800 leading-tight">
                <strong>{t('reports.importantNoteTitle')}</strong> {t('reports.importantNoteBody')}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {ConfirmDialogComponent}
    </>
  );
};

export default ReportGeneratorComponent;

