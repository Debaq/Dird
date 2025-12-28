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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MarkdownViewer } from '@/components/ui/markdown-viewer';
import { getAssetPath } from '@/utils/assets';

const AcademyView: React.FC = () => {
  const { t } = useTranslation();
  const [activeProtocol, setActiveProtocol] = useState('icdr');
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
          {/* Note about Settings */}
          <div className="p-4 mb-6 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 text-sm text-blue-800 dark:text-blue-300">
            <strong>Nota:</strong> El protocolo clínico activo se puede seleccionar en <span className="font-semibold">Configuración &gt; Guías Clínicas</span>. Todas las recomendaciones y clasificaciones automáticas se adaptarán a la guía seleccionada.
          </div>

          <Tabs value={activeProtocol} onValueChange={setActiveProtocol} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4 bg-gray-100 dark:bg-gray-800">
              <TabsTrigger value="icdr" className="data-[state=active]:bg-white dark:data-[state=active]:bg-coal-700 dark:text-gray-300 dark:data-[state=active]:text-white">ICDR (Internacional)</TabsTrigger>
              <TabsTrigger value="minsal" className="data-[state=active]:bg-white dark:data-[state=active]:bg-coal-700 dark:text-gray-300 dark:data-[state=active]:text-white">MINSAL 2017 (Chile)</TabsTrigger>
              <TabsTrigger value="etdrs" className="data-[state=active]:bg-white dark:data-[state=active]:bg-coal-700 dark:text-gray-300 dark:data-[state=active]:text-white">ETDRS (Investigación)</TabsTrigger>
            </TabsList>

            <TabsContent value="icdr" className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300">
                <strong className="block mb-1">International Clinical Diabetic Retinopathy Disease Severity Scale</strong>
                Estándar global simplificado para la práctica clínica diaria. Enfocado en signos observables.
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="font-medium text-green-900 dark:text-green-300">Sin Retinopatía Diabética:</span>
                    <span className="text-green-700 dark:text-green-400 ml-2 text-xs">Sin anomalías visibles.</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded">
                  <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="font-medium text-yellow-900 dark:text-yellow-300">RDNP Leve:</span>
                    <span className="text-yellow-700 dark:text-yellow-400 ml-2 text-xs">Solo microaneurismas.</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded">
                  <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="font-medium text-orange-900 dark:text-orange-300">RDNP Moderada:</span>
                    <span className="text-orange-700 dark:text-orange-400 ml-2 text-xs">Más que leve, menos que severa (exudados, hemorragias leves).</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="font-medium text-red-900 dark:text-red-300">RDNP Severa:</span>
                    <span className="text-red-700 dark:text-red-400 ml-2 text-xs">Regla 4-2-1 (Hemorragias 4Q, Arrosariamiento 2Q, o IRMA 1Q).</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-red-100 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded">
                  <AlertCircle className="h-4 w-4 text-red-700 dark:text-red-300 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="font-medium text-red-900 dark:text-red-200">RD Proliferativa:</span>
                    <span className="text-red-800 dark:text-red-300 ml-2 text-xs">Neovascularización o hemorragia vítrea/prerretinal.</span>
                  </div>
                </div>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    onClick={() => window.open('https://www.urmc.rochester.edu/MediaLibraries/URMCMedia/eye-institute/images/ICOPH.pdf', '_blank')}
                  >
                    <BookOpen className="h-4 w-4 mr-2" />
                    Ver Guía Oficial (ICO/AAO)
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="minsal" className="space-y-4">
              <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-300">
                <strong className="block mb-1">Guía Clínica MINSAL 2017 (Chile)</strong>
                Alineada con ICDR pero enfatiza la conducta y derivación oportuna en el sistema de salud (GES).
              </div>

              <div className="space-y-2">
                 <div className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-green-900 dark:text-green-300">Etapa 1: Sin RD</span>
                      <Badge variant="outline" className="text-green-700 border-green-200">APS</Badge>
                    </div>
                    <div className="text-xs text-green-700 dark:text-green-400">
                      <strong>Hallazgos:</strong> Retina normal.<br/>
                      <strong>Conducta:</strong> Control anual en Atención Primaria.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded">
                  <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-yellow-900 dark:text-yellow-300">Etapa 2: RD Leve</span>
                      <Badge variant="outline" className="text-yellow-700 border-yellow-200">APS / UAPO</Badge>
                    </div>
                    <div className="text-xs text-yellow-700 dark:text-yellow-400">
                      <strong>Hallazgos:</strong> Solo microaneurismas.<br/>
                      <strong>Conducta:</strong> Control estricto (semestral/anual) y control metabólico. Evaluar en UAPO.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded">
                  <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-orange-900 dark:text-orange-300">Etapa 3: RD Moderada</span>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">Derivación</Badge>
                    </div>
                    <div className="text-xs text-orange-700 dark:text-orange-400">
                      <strong>Hallazgos:</strong> Hemorragias, exudados duros/blandos.<br/>
                      <strong>Conducta:</strong> Derivación a Oftalmólogo para confirmación y plan de seguimiento.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-red-900 dark:text-red-300">Etapa 4: RD Severa</span>
                      <Badge variant="destructive">Urgente</Badge>
                    </div>
                    <div className="text-xs text-red-700 dark:text-red-400">
                      <strong>Hallazgos:</strong> Cumple regla 4-2-1.<br/>
                      <strong>Conducta:</strong> Derivación urgente para evaluación de tratamiento (Panfotocoagulación).
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2 bg-red-100 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded">
                  <AlertCircle className="h-4 w-4 text-red-700 dark:text-red-300 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-red-900 dark:text-red-200">Etapa 5: RD Proliferativa</span>
                      <Badge variant="destructive">GES</Badge>
                    </div>
                    <div className="text-xs text-red-800 dark:text-red-300">
                      <strong>Hallazgos:</strong> Neovasos o hemorragia.<br/>
                      <strong>Conducta:</strong> Tratamiento inmediato. Garantía GES para tratamiento oportuno.
                    </div>
                  </div>
                </div>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => window.open(getAssetPath('/docs/RE_GPC-Retinopatia-Diabetica_2017v2.pdf'), '_blank')}
                  >
                    <BookOpen className="h-4 w-4 mr-2" />
                    Ver Guía Clínica MINSAL 2017 (PDF)
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="etdrs" className="space-y-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg text-sm text-purple-800 dark:text-purple-300">
                <strong className="block mb-1">ETDRS (Early Treatment Diabetic Retinopathy Study)</strong>
                El "Gold Standard" para investigación clínica. Utiliza una escala detallada de 35 pasos basada en fotografías estereoscópicas de 7 campos.
              </div>
              
              <div className="bg-white dark:bg-coal-800 p-4 rounded-lg border border-gray-200 dark:border-coal-600 text-sm">
                <h4 className="font-semibold mb-3 dark:text-gray-200">Comparación Simplificada:</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="font-medium text-gray-500 dark:text-gray-400">Nivel ETDRS</div>
                  <div className="font-medium text-gray-500 dark:text-gray-400">Equivalente Clínico</div>
                  
                  <div className="p-1 border-b dark:border-coal-600">Nivel 10</div>
                  <div className="p-1 border-b dark:border-coal-600">Sin Retinopatía</div>
                  
                  <div className="p-1 border-b dark:border-coal-600">Nivel 20</div>
                  <div className="p-1 border-b dark:border-coal-600">Solo Microaneurismas</div>
                  
                  <div className="p-1 border-b dark:border-coal-600">Nivel 35</div>
                  <div className="p-1 border-b dark:border-coal-600">RDNP Leve</div>
                  
                  <div className="p-1 border-b dark:border-coal-600">Nivel 43-47</div>
                  <div className="p-1 border-b dark:border-coal-600">RDNP Moderada</div>
                  
                  <div className="p-1 border-b dark:border-coal-600">Nivel 53</div>
                  <div className="p-1 border-b dark:border-coal-600">RDNP Severa</div>
                  
                  <div className="p-1 border-b dark:border-coal-600">Nivel ≥60</div>
                  <div className="p-1 border-b dark:border-coal-600">RD Proliferativa</div>
                </div>
                <p className="mt-3 text-xs text-gray-500 italic">
                  * Nota: El sistema DIRD utiliza internamente criterios simplificados mapeados a ICDR, pero las métricas de investigación pueden referirse a estos niveles ETDRS.
                </p>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                    onClick={() => window.open('https://www.aao.org/assets/9f2de0c1-1c30-442f-a3bb-c76e2cf19502/636492239481630000/final-diabetic-retinopathy-update-2017-pdf', '_blank')}
                  >
                    <BookOpen className="h-4 w-4 mr-2" />
                    Ver Detalles del Estudio (AAO 2017)
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

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
            onClick={() => openMarkdown(getAssetPath('/docs/REVISION_TECNICA_DR.md'), 'Revisión Técnica - Sistema de Clasificación de RD')}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            {t('academy.technicalDocs.reviewButton')}
          </Button>
          <Button
            variant="outline"
            onClick={() => openMarkdown(getAssetPath('/docs/MEJORAS_INMEDIATAS.md'), 'Mejoras Inmediatas - Sin Entrenar Modelos')}
          >
            <FileText className="h-4 w-4 mr-2" />
            {t('academy.technicalDocs.improvementsButton')}
          </Button>
          <Button
            variant="outline"
            onClick={() => openMarkdown(getAssetPath('/docs/CLASES_FALTANTES_ENTRENAMIENTO.md'), 'Clases Faltantes y Estrategia de Entrenamiento')}
          >
            <Target className="h-4 w-4 mr-2" />
            Roadmap de Entrenamiento
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(getAssetPath('/docs/RE_GPC-Retinopatia-Diabetica_2017v2.pdf'), '_blank')}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Guía Clínica MINSAL 2017 (PDF)
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
