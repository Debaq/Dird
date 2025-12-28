import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, TrendingUp, Info, Check, ChevronDown, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getSessionClassifications } from '@/lib/analysis/image-classification-service';
import type { ImageDRClassification } from '@/lib/analysis/image-dr-classifier';
import { db } from '@/lib/db/schema';
import { toast } from 'sonner';

interface DRClassificationCardProps {
  sessionId: number;
  refreshKey?: number;
}

// Severity labels are now handled through translation keys
const severityStyles: Record<string, { color: string; bg: string }> = {
  'no_dr': {
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700'
  },
  'mild_npdr': {
    color: 'text-yellow-700 dark:text-yellow-400',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700'
  },
  'moderate_npdr': {
    color: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700'
  },
  'severe_npdr': {
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700'
  },
  'pdr': {
    color: 'text-red-900 dark:text-red-300',
    bg: 'bg-red-200 dark:bg-red-900/50 border-red-400 dark:border-red-600'
  }
};

export const DRClassificationCard: React.FC<DRClassificationCardProps> = ({ sessionId, refreshKey }) => {
  const { t, i18n } = useTranslation();
  const [classifications, setClassifications] = useState<ImageDRClassification[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<{ OD?: number; OI?: number }>({});
  const [showDetailsModal, setShowDetailsModal] = useState<{ eye: 'OD' | 'OI'; classification: ImageDRClassification } | null>(null);
  const [odExpanded, setOdExpanded] = useState(false);
  const [oiExpanded, setOiExpanded] = useState(false);

  useEffect(() => {
    const loadClassifications = async () => {
      const results = await getSessionClassifications(sessionId);
      setClassifications(results);

      // Auto-select worst image for each eye (default behavior)
      const odClassifs = results.filter(c => c.eyeType === 'OD');
      const oiClassifs = results.filter(c => c.eyeType === 'OI');

      const severityOrder = ['no_dr', 'mild_npdr', 'moderate_npdr', 'severe_npdr', 'pdr'];
      const getWorstSeverity = (classifs: ImageDRClassification[]) => {
        if (classifs.length === 0) return null;
        return classifs.reduce((worst, current) => {
          const worstIndex = severityOrder.indexOf(worst.severity);
          const currentIndex = severityOrder.indexOf(current.severity);
          return currentIndex > worstIndex ? current : worst;
        });
      };

      const odWorst = getWorstSeverity(odClassifs);
      const oiWorst = getWorstSeverity(oiClassifs);

      setSelectedImageIds({
        OD: odWorst?.imageId,
        OI: oiWorst?.imageId
      });
    };
    loadClassifications();
  }, [sessionId, refreshKey]);

  // Agrupar por ojo
  const odClassifications = classifications.filter(c => c.eyeType === 'OD');
  const oiClassifications = classifications.filter(c => c.eyeType === 'OI');

  // Get selected classification or default to worst
  const getSelectedOrWorst = (classifs: ImageDRClassification[], eye: 'OD' | 'OI') => {
    const selectedId = selectedImageIds[eye];
    if (selectedId) {
      const selected = classifs.find(c => c.imageId === selectedId);
      if (selected) return selected;
    }
    // Fallback to worst
    const severityOrder = ['no_dr', 'mild_npdr', 'moderate_npdr', 'severe_npdr', 'pdr'];
    return classifs.reduce((worst, current) => {
      const worstIndex = severityOrder.indexOf(worst.severity);
      const currentIndex = severityOrder.indexOf(current.severity);
      return currentIndex > worstIndex ? current : worst;
    }, classifs[0]);
  };

  const odSelected = odClassifications.length > 0 ? getSelectedOrWorst(odClassifications, 'OD') : null;
  const oiSelected = oiClassifications.length > 0 ? getSelectedOrWorst(oiClassifications, 'OI') : null;

  const overallWorst = [odSelected, oiSelected].filter(Boolean).reduce((worst, current) => {
    if (!worst) return current;
    if (!current) return worst;
    const severityOrder = ['no_dr', 'mild_npdr', 'moderate_npdr', 'severe_npdr', 'pdr'];
    const worstIndex = severityOrder.indexOf(worst.severity);
    const currentIndex = severityOrder.indexOf(current.severity);
    return currentIndex > worstIndex ? current : worst;
  }, null as ImageDRClassification | null);

  const getSeverityLabel = (classif: ImageDRClassification | null) => {
    if (!classif) return '';
    if (classif.severityLabel) return classif.severityLabel;

    // Use translation key instead of hardcoded language check
    return t(`analysis.drClassification.severity.${classif.severity}.${i18n.language === 'es' ? 'es' : 'en'}`);
  };

  const getSeverityColor = (classif: ImageDRClassification | null) => {
    if (!classif) return 'text-gray-700';

    // Use guideline color if available
    // Note: color might be a hex code from the guideline, while our map uses tailwind classes
    // We'll prioritize our map if it's a standard severity, otherwise we'd need to handle hex
    return severityStyles[classif.severity]?.color || 'text-gray-700';
  };

  const getSeverityBg = (classif: ImageDRClassification | null) => {
    if (!classif) return 'bg-gray-100 border-gray-300';
    return severityStyles[classif.severity]?.bg || 'bg-gray-100 border-gray-300';
  };

  const handleImageSelect = (imageId: number, eye: 'OD' | 'OI') => {
    setSelectedImageIds(prev => ({ ...prev, [eye]: imageId }));
  };

  // Get image filename
  // const getImageFilename = async (imageId: number): Promise<string> => {
  //   const image = await db.images.get(imageId);
  //   return image?.filename || `Image ${imageId}`;
  // };

  // Render image selector for an eye
  const renderImageSelector = (classifs: ImageDRClassification[], eye: 'OD' | 'OI', expanded: boolean, setExpanded: (value: boolean) => void) => {
    if (classifs.length <= 1) return null;

    const selectedId = selectedImageIds[eye];

    return (
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
            {t('analysis.drClassification.imagesAvailable', { count: classifs.length })}
            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 mt-2">
          {classifs.map((classif) => {
            const isSelected = classif.imageId === selectedId;
            return (
              <div
                key={classif.imageId}
                className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                  isSelected ? 'bg-primary-50 border border-primary-300' : 'bg-smoke-50 hover:bg-smoke-100 border border-transparent'
                }`}
                onClick={() => handleImageSelect(classif.imageId, eye)}
              >
                <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  isSelected ? 'bg-primary-500 border-primary-500' : 'border-smoke-300'
                }`}>
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{t('analysis.drClassification.image', { id: classif.imageId })}</div>
                  <div className="text-xs text-smoke-600">{getSeverityLabel(classif)}</div>
                </div>
                <Badge variant={classif.confidence === 'high' ? 'default' : 'secondary'} className="text-xs flex-shrink-0">
                  {t(`analysis.drClassification.confidenceLevels.${classif.confidence}Short`)}
                </Badge>
              </div>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // Handle marking classification for contribution
  const handleMarkForContribution = async (classification: ImageDRClassification) => {
    try {
      // Get the full classification from DB to ensure we have the ID
      const dbClassification = await db.imageClassifications
        .where('imageId')
        .equals(classification.imageId)
        .first();

      if (!dbClassification?.id) {
        toast.error('No se pudo encontrar la clasificación en la base de datos');
        return;
      }

      // Check if already pending
      const existing = await db.pendingContributions
        .where({ type: 'conclusion', referenceId: dbClassification.id })
        .first();

      if (existing) {
        toast.info('Esta conclusión ya está marcada para contribuir');
        return;
      }

      // Add to pending contributions
      await db.pendingContributions.add({
        type: 'conclusion',
        referenceId: dbClassification.id,
        status: 'pending',
        metadata: {
          severity: classification.severity,
          eyeType: classification.eyeType,
          guideline: classification.guideline || 'unknown',
        },
        createdAt: new Date(),
      });

      toast.success('Conclusión marcada para contribuir. Ve a la sección Contribuir para enviarla.');
      setShowDetailsModal(null);
    } catch (error) {
      toast.error('Error al marcar la conclusión para contribuir');
      console.error(error);
    }
  };

  // Render details modal
  const renderDetailsModal = () => {
    if (!showDetailsModal) return null;

    const { eye, classification } = showDetailsModal;
    const eyeLabel = eye === 'OD' ? t('analysis.drClassification.detailsModal.titleOD') : t('analysis.drClassification.detailsModal.titleOI');

    return (
      <Dialog open={true} onOpenChange={() => setShowDetailsModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary-500" />
              {t('analysis.drClassification.detailsModal.title', { eye: eyeLabel })}
            </DialogTitle>
            <DialogDescription>
              {t('analysis.drClassification.detailsModal.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Severity Result */}
            <div className={`p-4 rounded-lg border-2 ${getSeverityBg(classification)}`}>
              <div className="font-semibold text-sm mb-1">{t('analysis.drClassification.detailsModal.finalClassification')}</div>
              <div className={`text-lg font-bold ${getSeverityColor(classification)}`}>
                {getSeverityLabel(classification)}
              </div>
              <div className="text-xs mt-2">
                <span className="font-medium">{t('analysis.drClassification.confidence')}:</span>{' '}
                <Badge variant={classification.confidence === 'high' ? 'default' : 'secondary'}>
                  {t(`analysis.drClassification.confidenceLevels.${classification.confidence}`)}
                </Badge>
              </div>
            </div>

            {/* Lesion Counts */}
            <div className="border rounded-lg p-4 bg-smoke-50">
              <div className="font-semibold text-sm mb-3">{t('analysis.drClassification.detailsModal.lesionsDetected')}</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-xs">
                  <span className="font-medium">{t('analysis.drClassification.detailsModal.lesionTypes.microaneurysms')}:</span> {classification.lesions.microaneurysms}
                </div>
                <div className="text-xs">
                  <span className="font-medium">{t('analysis.drClassification.detailsModal.lesionTypes.hemorrhages')}:</span> {classification.lesions.hemorrhages}
                </div>
                <div className="text-xs">
                  <span className="font-medium">{t('analysis.drClassification.detailsModal.lesionTypes.hardExudates')}:</span> {classification.lesions.hardExudates}
                </div>
                <div className="text-xs">
                  <span className="font-medium">{t('analysis.drClassification.detailsModal.lesionTypes.softExudates')}:</span> {classification.lesions.softExudates}
                </div>
                <div className="text-xs col-span-2">
                  <span className="font-medium">{t('analysis.drClassification.detailsModal.lesionTypes.neovascularization')}:</span> {classification.lesions.neovascularization}
                  {classification.lesions.neovascularization > 0 && (
                    <span className="ml-2 text-red-600 font-semibold">{t('analysis.drClassification.detailsModal.critical')}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Criteria Applied */}
            <div className="border rounded-lg p-4">
              <div className="font-semibold text-sm mb-3">{t('analysis.drClassification.detailsModal.criteriaApplied')}</div>
              <ul className="space-y-2">
                {classification.criteria.map((criterion, idx) => (
                  <li key={idx} className="text-xs flex items-start gap-2">
                    <span className="text-primary-500 mt-0.5">•</span>
                    <span>{criterion}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quadrant Analysis */}
            {classification.usedQuadrantAnalysis && (
              <div className="border rounded-lg p-4 bg-green-50">
                <div className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  {t('analysis.drClassification.detailsModal.quadrantAnalysis')}
                </div>
                <p className="text-xs text-smoke-700">
                  {t('analysis.drClassification.detailsModal.quadrantAnalysisDesc')}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {Object.entries(classification.quadrantLesions).map(([quadrant, lesions]) => (
                    <div key={quadrant} className="text-xs p-2 bg-white rounded border">
                      <div className="font-medium">{t(`analysis.drClassification.detailsModal.quadrantNames.${quadrant}`)}</div>
                      <div className="text-smoke-600 mt-1">
                        {t('analysis.drClassification.detailsModal.quadrantAbbreviations.ma')}: {lesions.microaneurysms}, {t('analysis.drClassification.detailsModal.quadrantAbbreviations.he')}: {lesions.hemorrhages}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {classification.warnings.length > 0 && (
              <div className="border-l-4 border-yellow-500 bg-yellow-50 p-4">
                <div className="font-semibold text-sm mb-2 text-yellow-800">{t('analysis.drClassification.warnings')}</div>
                <ul className="space-y-1">
                  {classification.warnings.map((warning, idx) => (
                    <li key={idx} className="text-xs text-yellow-700 flex items-start gap-2">
                      <span className="mt-0.5">⚠️</span>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Algorithm Summary */}
            <div className="border rounded-lg p-4 bg-blue-50">
              <div className="font-semibold text-sm mb-2 text-blue-800">{t('analysis.drClassification.detailsModal.algorithmSummary')}</div>
              <div className="text-xs text-blue-900 space-y-2">
                <p>
                  <strong>{t('analysis.drClassification.detailsModal.algorithmSteps.step1')}</strong> {t('analysis.drClassification.detailsModal.algorithmSteps.step1Desc')}
                </p>
                <p>
                  <strong>{t('analysis.drClassification.detailsModal.algorithmSteps.step2')}</strong> {t('analysis.drClassification.detailsModal.algorithmSteps.step2Desc')}
                </p>
                <p>
                  <strong>{t('analysis.drClassification.detailsModal.algorithmSteps.step3')}</strong> {t('analysis.drClassification.detailsModal.algorithmSteps.step3Desc')}
                </p>
                <p className="pt-2 border-t border-blue-200">
                  <em>{t('analysis.drClassification.detailsModal.algorithmSteps.disclaimer')}</em>
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col gap-3 sm:flex-row">
            {/* Only show contribution button if manually modified */}
            {classification.manuallyModified && (
              <div className="w-full space-y-2">
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  ⚠️ <strong>{t('analysis.drClassification.contribution.warningTitle')}:</strong> {t('analysis.drClassification.contribution.warningText')}
                </div>
                <Button
                  variant="default"
                  onClick={() => handleMarkForContribution(classification)}
                  className="w-full gap-2 bg-amber-500 hover:bg-amber-600"
                >
                  <Send className="h-4 w-4" />
                  {t('analysis.drClassification.contributeModifiedConclusion')}
                </Button>
              </div>
            )}
            <Button
              variant="outline"
              onClick={() => setShowDetailsModal(null)}
              className="w-full sm:w-auto"
            >
              {t('ui.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  if (classifications.length === 0) {
    return (
      <Card className="border-l-4 border-l-purple-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-500" />
            {t('analysis.drClassification.title', 'Clasificación de Retinopatía Diabética')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-smoke-600">
            <p className="text-sm">
              {t('analysis.drClassification.notGenerated', 'Procesa las imágenes con IA primero para generar la clasificación')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-purple-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-purple-500" />
          {t('analysis.drClassification.title', 'Clasificación de Retinopatía Diabética')}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {overallWorst && (
          <div className="space-y-4">
            {/* Overall Severity */}
            <div className="text-center">
              <div className="text-xs text-smoke-600 mb-2">
                {t('analysis.drClassification.overallSeverity', 'Severidad Global')}
              </div>
              <div className={`inline-block px-4 py-2 rounded-lg border-2 font-semibold ${getSeverityBg(overallWorst)}`}>
                <span className={getSeverityColor(overallWorst)}>
                  {getSeverityLabel(overallWorst)}
                </span>
              </div>
            </div>

            {/* Eye Classifications */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Right Eye (OD) */}
              {odSelected && (
                <div className={`p-4 rounded-lg border-2 ${getSeverityBg(odSelected)}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Eye className={`h-4 w-4 ${getSeverityColor(odSelected)}`} />
                      <span className="font-semibold text-sm">
                        {t('analysis.drClassification.rightEye', 'Ojo Derecho (OD)')}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setShowDetailsModal({ eye: 'OD', classification: odSelected })}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className={`text-sm font-medium mb-2 ${getSeverityColor(odSelected)}`}>
                    {getSeverityLabel(odSelected)}
                  </div>
                  <div className="text-xs text-smoke-700 space-y-2">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">
                        {t('analysis.drClassification.confidence')}:
                      </span>
                      <Badge variant={odSelected.confidence === 'high' ? 'default' : 'secondary'} className="text-xs">
                        {t(`analysis.drClassification.confidenceLevels.${odSelected.confidence}`)}
                      </Badge>
                    </div>
                    {odClassifications.length > 1 && (
                      <div className="flex items-center gap-1 text-xs">
                        <Check className="h-3 w-3 text-green-600" />
                        <span className="text-smoke-600">
                          {t('analysis.drClassification.imageSelected', { id: selectedImageIds.OD, total: odClassifications.length })}
                        </span>
                      </div>
                    )}
                    {odClassifications.length === 1 && (
                      <div className="text-xs text-smoke-600">
                        {t('analysis.drClassification.singleImage')}
                      </div>
                    )}
                  </div>
                  {renderImageSelector(odClassifications, 'OD', odExpanded, setOdExpanded)}
                </div>
              )}

              {/* Left Eye (OI) */}
              {oiSelected && (
                <div className={`p-4 rounded-lg border-2 ${getSeverityBg(oiSelected)}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Eye className={`h-4 w-4 ${getSeverityColor(oiSelected)}`} />
                      <span className="font-semibold text-sm">
                        {t('analysis.drClassification.leftEye', 'Ojo Izquierdo (OI)')}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setShowDetailsModal({ eye: 'OI', classification: oiSelected })}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className={`text-sm font-medium mb-2 ${getSeverityColor(oiSelected)}`}>
                    {getSeverityLabel(oiSelected)}
                  </div>
                  <div className="text-xs text-smoke-700 space-y-2">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">
                        {t('analysis.drClassification.confidence')}:
                      </span>
                      <Badge variant={oiSelected.confidence === 'high' ? 'default' : 'secondary'} className="text-xs">
                        {t(`analysis.drClassification.confidenceLevels.${oiSelected.confidence}`)}
                      </Badge>
                    </div>
                    {oiClassifications.length > 1 && (
                      <div className="flex items-center gap-1 text-xs">
                        <Check className="h-3 w-3 text-green-600" />
                        <span className="text-smoke-600">
                          {t('analysis.drClassification.imageSelected', { id: selectedImageIds.OI, total: oiClassifications.length })}
                        </span>
                      </div>
                    )}
                    {oiClassifications.length === 1 && (
                      <div className="text-xs text-smoke-600">
                        {t('analysis.drClassification.singleImage')}
                      </div>
                    )}
                  </div>
                  {renderImageSelector(oiClassifications, 'OI', oiExpanded, setOiExpanded)}
                </div>
              )}
            </div>

            {/* Info sobre el sistema de clasificación */}
            <div className="mt-4 p-3 bg-smoke-50 border border-smoke-200 rounded-lg">
              <p className="text-xs text-smoke-600">
                <strong>{t('analysis.drClassification.note')}</strong> {t('analysis.drClassification.noteText')}
                {overallWorst?.guidelineName && (
                  <span className="block mt-1 font-medium text-primary-700">
                    Protocolo utilizado: {overallWorst.guidelineName} {overallWorst.guidelineVersion ? `(v${overallWorst.guidelineVersion})` : ''}
                  </span>
                )}
                {odClassifications.length > 1 || oiClassifications.length > 1 ? (
                  <> {t('analysis.drClassification.noteMultipleImages')}</>
                ) : (
                  <> {t('analysis.drClassification.noteSingleImage')}</>
                )}
              </p>
            </div>
          </div>
        )}
      </CardContent>

      {/* Details Modal */}
      {renderDetailsModal()}
    </Card>
  );
};
