import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GraduationCap,
  BookOpen,
  Brain,
  Target,
  Eye,
  Stethoscope,
  AlertCircle,
  CheckCircle2,
  PlayCircle,
  FileText,
  Layers
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MarkdownViewer } from '@/components/ui/markdown-viewer';

const AcademyView: React.FC = () => {
  const { t } = useTranslation();
  const [markdownModal, setMarkdownModal] = useState<{
    isOpen: boolean;
    filePath: string;
    title: string;
  }>({
    isOpen: false,
    filePath: '',
    title: ''
  });

  const openMarkdown = (filePath: string, title: string) => {
    setMarkdownModal({
      isOpen: true,
      filePath,
      title
    });
  };

  const closeMarkdown = () => {
    setMarkdownModal({
      isOpen: false,
      filePath: '',
      title: ''
    });
  };

  return (
    <div className="container mx-auto py-6 max-w-5xl dark:text-gray-100">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-coal-800 dark:text-gray-100 flex items-center gap-3">
          <GraduationCap className="h-8 w-8 text-blue-500" />
          {t('academy.title')}
        </h1>
        <p className="text-smoke-600 dark:text-gray-400 mt-2">
          {t('academy.description')}
        </p>
      </div>

      {/* Tutorial Section (Coming Soon) */}
      <Card className="p-6 mb-6 dark:bg-dark-surface dark:border-coal-700 border-l-4 border-l-blue-500">
        <div className="flex items-start gap-4">
          <PlayCircle className="h-6 w-6 text-blue-500 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-2">
              {t('academy.tutorial.title')}
            </h2>
            <p className="text-smoke-600 dark:text-dark-textSecondary mb-4">
              {t('academy.tutorial.description')}
            </p>
            <Button variant="secondary" disabled className="opacity-50">
              <PlayCircle className="h-4 w-4 mr-2" />
              {t('academy.tutorial.startButton')}
            </Button>
          </div>
        </div>
      </Card>

      {/* How DIRD Works */}
      <Card className="p-6 mb-6 dark:bg-dark-surface dark:border-coal-700">
        <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4 flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" />
          {t('academy.howItWorks.title')}
        </h2>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-medium text-coal-700 dark:text-gray-200 mb-2">
              {t('academy.howItWorks.privacy.title')}
            </h3>
            <p className="text-smoke-600 dark:text-gray-400">
              {t('academy.howItWorks.privacy.description')}
            </p>
          </div>
          <div>
            <h3 className="font-medium text-coal-700 dark:text-gray-200 mb-2">
              {t('academy.howItWorks.ai.title')}
            </h3>
            <p className="text-smoke-600 dark:text-gray-400">
              {t('academy.howItWorks.ai.description')}
            </p>
          </div>
          <div>
            <h3 className="font-medium text-coal-700 dark:text-gray-200 mb-2">
              {t('academy.howItWorks.workflow.title')}
            </h3>
            <ol className="list-decimal list-inside text-smoke-600 dark:text-gray-400 space-y-2 ml-2">
              <li>{t('academy.howItWorks.workflow.step1')}</li>
              <li>{t('academy.howItWorks.workflow.step2')}</li>
              <li>{t('academy.howItWorks.workflow.step3')}</li>
              <li>{t('academy.howItWorks.workflow.step4')}</li>
              <li>{t('academy.howItWorks.workflow.step5')}</li>
            </ol>
          </div>
        </div>
      </Card>

      {/* DR Classification System */}
      <Card className="p-6 mb-6 dark:bg-dark-surface dark:border-coal-700">
        <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4 flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-red-500" />
          {t('academy.drClassification.title')}
        </h2>

        <div className="space-y-6 text-sm">
          {/* Protocols */}
          <div>
            <h3 className="font-medium text-coal-700 dark:text-gray-200 mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t('academy.drClassification.protocols.title')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="font-medium text-blue-900 dark:text-blue-300 mb-1">
                  ICDR Scale
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-400">
                  {t('academy.drClassification.protocols.icdr')}
                </div>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg">
                <div className="font-medium text-purple-900 dark:text-purple-300 mb-1">
                  ETDRS
                </div>
                <div className="text-xs text-purple-700 dark:text-purple-400">
                  {t('academy.drClassification.protocols.etdrs')}
                </div>
              </div>
            </div>
          </div>

          {/* Severity Levels */}
          <div>
            <h3 className="font-medium text-coal-700 dark:text-gray-200 mb-3">
              {t('academy.drClassification.severityLevels.title')}
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium text-green-900 dark:text-green-300">
                    {t('academy.drClassification.severityLevels.noDR.name')}:
                  </span>
                  <span className="text-green-700 dark:text-green-400 ml-2 text-xs">
                    {t('academy.drClassification.severityLevels.noDR.criteria')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium text-yellow-900 dark:text-yellow-300">
                    {t('academy.drClassification.severityLevels.mildNPDR.name')}:
                  </span>
                  <span className="text-yellow-700 dark:text-yellow-400 ml-2 text-xs">
                    {t('academy.drClassification.severityLevels.mildNPDR.criteria')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded">
                <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium text-orange-900 dark:text-orange-300">
                    {t('academy.drClassification.severityLevels.moderateNPDR.name')}:
                  </span>
                  <span className="text-orange-700 dark:text-orange-400 ml-2 text-xs">
                    {t('academy.drClassification.severityLevels.moderateNPDR.criteria')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium text-red-900 dark:text-red-300">
                    {t('academy.drClassification.severityLevels.severeNPDR.name')}:
                  </span>
                  <span className="text-red-700 dark:text-red-400 ml-2 text-xs">
                    {t('academy.drClassification.severityLevels.severeNPDR.criteria')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-red-100 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded">
                <AlertCircle className="h-4 w-4 text-red-700 dark:text-red-300 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium text-red-900 dark:text-red-200">
                    {t('academy.drClassification.severityLevels.pdr.name')}:
                  </span>
                  <span className="text-red-800 dark:text-red-300 ml-2 text-xs">
                    {t('academy.drClassification.severityLevels.pdr.criteria')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Decision Making */}
          <div>
            <h3 className="font-medium text-coal-700 dark:text-gray-200 mb-3">
              {t('academy.drClassification.decisionMaking.title')}
            </h3>
            <div className="space-y-3 text-smoke-600 dark:text-gray-400">
              <div className="flex items-start gap-2">
                <Target className="h-4 w-4 text-blue-500 flex-shrink-0 mt-1" />
                <div>
                  <span className="font-medium text-coal-700 dark:text-gray-300">
                    {t('academy.drClassification.decisionMaking.step1.title')}:
                  </span>
                  <span className="ml-2">{t('academy.drClassification.decisionMaking.step1.description')}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Layers className="h-4 w-4 text-purple-500 flex-shrink-0 mt-1" />
                <div>
                  <span className="font-medium text-coal-700 dark:text-gray-300">
                    {t('academy.drClassification.decisionMaking.step2.title')}:
                  </span>
                  <span className="ml-2">{t('academy.drClassification.decisionMaking.step2.description')}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Eye className="h-4 w-4 text-green-500 flex-shrink-0 mt-1" />
                <div>
                  <span className="font-medium text-coal-700 dark:text-gray-300">
                    {t('academy.drClassification.decisionMaking.step3.title')}:
                  </span>
                  <span className="ml-2">{t('academy.drClassification.decisionMaking.step3.description')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Detected Classes */}
      <Card className="p-6 mb-6 dark:bg-dark-surface dark:border-coal-700">
        <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-green-500" />
          {t('academy.classes.title')}
        </h2>

        <div className="space-y-6">
          {/* Currently Detected */}
          <div>
            <h3 className="font-medium text-coal-700 dark:text-gray-200 mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              {t('academy.classes.current.title')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Badge className="bg-green-500 text-white">✓</Badge>
                <div className="text-sm">
                  <div className="font-medium text-coal-700 dark:text-gray-200">
                    {t('academy.classes.current.microaneurysms')}
                  </div>
                  <div className="text-xs text-smoke-600 dark:text-gray-400">
                    {t('academy.classes.current.microaneurysmsDesc')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Badge className="bg-green-500 text-white">✓</Badge>
                <div className="text-sm">
                  <div className="font-medium text-coal-700 dark:text-gray-200">
                    {t('academy.classes.current.hemorrhages')}
                  </div>
                  <div className="text-xs text-smoke-600 dark:text-gray-400">
                    {t('academy.classes.current.hemorrhagesDesc')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Badge className="bg-green-500 text-white">✓</Badge>
                <div className="text-sm">
                  <div className="font-medium text-coal-700 dark:text-gray-200">
                    {t('academy.classes.current.hardExudates')}
                  </div>
                  <div className="text-xs text-smoke-600 dark:text-gray-400">
                    {t('academy.classes.current.hardExudatesDesc')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Badge className="bg-green-500 text-white">✓</Badge>
                <div className="text-sm">
                  <div className="font-medium text-coal-700 dark:text-gray-200">
                    {t('academy.classes.current.softExudates')}
                  </div>
                  <div className="text-xs text-smoke-600 dark:text-gray-400">
                    {t('academy.classes.current.softExudatesDesc')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Badge className="bg-green-500 text-white">✓</Badge>
                <div className="text-sm">
                  <div className="font-medium text-coal-700 dark:text-gray-200">
                    {t('academy.classes.current.neovascularization')}
                  </div>
                  <div className="text-xs text-smoke-600 dark:text-gray-400">
                    {t('academy.classes.current.neovascularizationDesc')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* In Development */}
          <div>
            <h3 className="font-medium text-coal-700 dark:text-gray-200 mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              {t('academy.classes.future.title')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                <Badge className="bg-amber-500 text-white">🔬</Badge>
                <div className="text-sm">
                  <div className="font-medium text-coal-700 dark:text-gray-200">
                    {t('academy.classes.future.irma')}
                  </div>
                  <div className="text-xs text-smoke-600 dark:text-gray-400">
                    {t('academy.classes.future.irmaDesc')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                <Badge className="bg-amber-500 text-white">🔬</Badge>
                <div className="text-sm">
                  <div className="font-medium text-coal-700 dark:text-gray-200">
                    {t('academy.classes.future.venousBeading')}
                  </div>
                  <div className="text-xs text-smoke-600 dark:text-gray-400">
                    {t('academy.classes.future.venousBeadingDesc')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                <Badge className="bg-amber-500 text-white">🔬</Badge>
                <div className="text-sm">
                  <div className="font-medium text-coal-700 dark:text-gray-200">
                    {t('academy.classes.future.macularEdema')}
                  </div>
                  <div className="text-xs text-smoke-600 dark:text-gray-400">
                    {t('academy.classes.future.macularEdemaDesc')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Important Disclaimer */}
      <Card className="p-6 dark:bg-dark-surface dark:border-coal-700 border-l-4 border-l-amber-500">
        <div className="flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-coal-800 dark:text-dark-text mb-2">
              {t('academy.disclaimer.title')}
            </h3>
            <div className="text-sm text-smoke-600 dark:text-dark-textSecondary space-y-2">
              <p>{t('academy.disclaimer.paragraph1')}</p>
              <p>{t('academy.disclaimer.paragraph2')}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Technical Documentation Link */}
      <div className="mt-8 text-center">
        <div className="text-sm text-smoke-600 dark:text-gray-400 mb-4">
          {t('academy.technicalDocs.description')}
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => openMarkdown('/docs/REVISION_TECNICA_DR.md', 'Revisión Técnica - Sistema de Clasificación de RD')}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            {t('academy.technicalDocs.reviewButton')}
          </Button>
          <Button
            variant="outline"
            onClick={() => openMarkdown('/docs/MEJORAS_INMEDIATAS.md', 'Mejoras Inmediatas - Sin Entrenar Modelos')}
          >
            <FileText className="h-4 w-4 mr-2" />
            {t('academy.technicalDocs.improvementsButton')}
          </Button>
          <Button
            variant="outline"
            onClick={() => openMarkdown('/docs/CLASES_FALTANTES_ENTRENAMIENTO.md', 'Clases Faltantes y Estrategia de Entrenamiento')}
          >
            <Target className="h-4 w-4 mr-2" />
            Roadmap de Entrenamiento
          </Button>
        </div>
      </div>

      {/* Markdown Viewer Modal */}
      <MarkdownViewer
        isOpen={markdownModal.isOpen}
        onClose={closeMarkdown}
        filePath={markdownModal.filePath}
        title={markdownModal.title}
      />
    </div>
  );
};

export default AcademyView;
