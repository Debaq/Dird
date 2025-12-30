import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings as SettingsIcon,
  Palette,
  Cpu,
  Gauge,
  Download,
  Info,
  Check,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FileText,
  Lock,
  BookOpen,
  Microscope
} from 'lucide-react';
import { useConfigStore, type ModelSource } from '@/stores/config-store';
import { apiInferenceService } from '@/lib/ai/api-inference-service';
import { PWAInstallButton, PWAInstallStatus } from '@/components/pwa/PWAInstallButton';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import ModelSettings from './ModelSettings';
import ReportSettings from './ReportSettings';
import { GuidelineSelector } from './GuidelineSelector';
import { getCurrentVersion, type VersionInfo } from '@/utils/version';
import { changeLanguage } from '@/i18n/config';
import { getAssetPath } from '@/utils/assets';
import { AdminLogin } from '@/components/admin/AdminLogin';

export function Settings() {
  const { t } = useTranslation();
  const {
    config,
    updateAppearance,
    updateProcessing,
    updateAdvancedAnalysis,
    updateAPIModels,
    updateLocalModels,
    setModelSource,
    resetConfig
  } = useConfigStore();

  const [activeTab, setActiveTab] = useState('appearance');
  const [apiTestResult, setApiTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<VersionInfo | null>(null);
  const [localVersion, setLocalVersion] = useState<VersionInfo | null>(null);
  const [isCheckingVersion, setIsCheckingVersion] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updateCheckMessage, setUpdateCheckMessage] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  // Tabs scroll logic
  const tabsListRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);

  const checkScroll = () => {
    if (tabsListRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsListRef.current;
      setShowLeftScroll(scrollLeft > 0);
      setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  // Check authentication status when modal closes
  const handleAdminLoginClose = (open: boolean) => {
    setShowAdminLogin(open);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (tabsListRef.current) {
      const scrollAmount = 200;
      tabsListRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    const loadVersionInfo = async () => {
      setIsCheckingVersion(true);
      try {
        const versionInfo = await getCurrentVersion(false);
        setCurrentVersion(versionInfo);

        // Obtener la versión local guardada en localStorage
        const savedLocalVersion = localStorage.getItem('installedVersion');
        if (savedLocalVersion) {
          // Si existe una versión guardada, usarla como versión local
          setLocalVersion(JSON.parse(savedLocalVersion));
        } else {
          // Si no existe, guardar la versión actual como instalada
          setLocalVersion(versionInfo);
          localStorage.setItem('installedVersion', JSON.stringify(versionInfo));
        }
      } catch (error) {
        console.error('Error loading version info:', error);
      } finally {
        setIsCheckingVersion(false);
      }
    };

    loadVersionInfo();
  }, []);

  const checkForUpdates = async () => {
    setIsCheckingVersion(true);
    setUpdateCheckMessage(null);
    try {
      const serverVersion = await getCurrentVersion(true);

      if (localVersion && serverVersion && serverVersion.buildNumber > localVersion.buildNumber) {
        setHasUpdate(true);
        setUpdateCheckMessage(null);
      } else if (localVersion && serverVersion && serverVersion.buildNumber === localVersion.buildNumber) {
        setHasUpdate(false);
        setUpdateCheckMessage(t('settings.about.noUpdates'));
      } else {
        setHasUpdate(false);
        setUpdateCheckMessage(t('settings.about.checkError'));
      }

      setCurrentVersion(serverVersion);
    } catch (error) {
      console.error('Error checking for updates:', error);
      setHasUpdate(false);
      setUpdateCheckMessage(t('settings.about.checkError'));
    } finally {
      setIsCheckingVersion(false);
    }
  };

  const forceUpdate = async () => {
    setIsReloading(true);

    // Actualizar la versión local guardada antes de recargar
    if (currentVersion) {
      localStorage.setItem('installedVersion', JSON.stringify(currentVersion));
    }

    // Limpiar el caché del navegador
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }

    // Forzar recarga de la página
    window.location.reload();
  };

  const handleTestApiConnection = async () => {
    setIsTestingApi(true);
    setApiTestResult(null);

    try {
      const result = await apiInferenceService.testConnection();
      setApiTestResult(result);
    } catch (error) {
      setApiTestResult({
        success: false,
        message: error instanceof Error ? error.message : t('settings.models.api.unknownError')
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-5xl dark:text-gray-100">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-coal-800 dark:text-gray-100 flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          {t('settings.title')}
        </h1>
        <p className="text-smoke-600 dark:text-gray-400 mt-2">{t('settings.description')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="relative group mb-6">
          {showLeftScroll && (
            <div className="absolute left-0 top-0 bottom-0 flex items-center z-10 bg-gradient-to-r from-white via-white to-transparent pl-1 pr-4 dark:from-gray-900 dark:via-gray-900">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full shadow-sm"
                onClick={() => scroll('left')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          <TabsList 
            ref={tabsListRef}
            onScroll={checkScroll}
            className="w-full justify-start overflow-x-auto scrollbar-hide border-b border-smoke-300 dark:border-gray-700 dark:bg-gray-800 h-auto p-2 gap-2"
          >
            <TabsTrigger value="appearance" className="flex-shrink-0 dark:text-gray-100 dark:data-[state=active]:text-white">
              <Palette className="h-4 w-4 mr-2" />
              {t('settings.tabs.appearance')}
            </TabsTrigger>
            <TabsTrigger value="models" className="flex-shrink-0 dark:text-gray-100 dark:data-[state=active]:text-white">
              <Cpu className="h-4 w-4 mr-2" />
              {t('settings.tabs.models')}
            </TabsTrigger>
            <TabsTrigger value="report" className="flex-shrink-0 dark:text-gray-100 dark:data-[state=active]:text-white">
              <FileText className="h-4 w-4 mr-2" />
              {t('settings.tabs.report')}
            </TabsTrigger>
            <TabsTrigger value="processing" className="flex-shrink-0 dark:text-gray-100 dark:data-[state=active]:text-white">
              <Gauge className="h-4 w-4 mr-2" />
              {t('settings.tabs.processing')}
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex-shrink-0 dark:text-gray-100 dark:data-[state=active]:text-white">
              <Microscope className="h-4 w-4 mr-2" />
              Análisis Avanzado
            </TabsTrigger>
            <TabsTrigger value="guidelines" className="flex-shrink-0 dark:text-gray-100 dark:data-[state=active]:text-white">
              <BookOpen className="h-4 w-4 mr-2" />
              Clinical Guidelines
            </TabsTrigger>
            <TabsTrigger value="pwa" className="flex-shrink-0 dark:text-gray-100 dark:data-[state=active]:text-white">
              <Download className="h-4 w-4 mr-2" />
              {t('settings.tabs.pwa')}
            </TabsTrigger>
            <TabsTrigger value="about" className="flex-shrink-0 dark:text-gray-100 dark:data-[state=active]:text-white">
              <Info className="h-4 w-4 mr-2" />
              {t('settings.tabs.about')}
            </TabsTrigger>
          </TabsList>

          {showRightScroll && (
            <div className="absolute right-0 top-0 bottom-0 flex items-center z-10 bg-gradient-to-l from-white via-white to-transparent pr-1 pl-4 dark:from-gray-900 dark:via-gray-900">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full shadow-sm"
                onClick={() => scroll('right')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
            <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4">
              {t('settings.appearance.title')}
            </h2>

            <div className="space-y-6">
              {/* Primary Color */}
              <div>
                <Label htmlFor="primaryColor" className="dark:text-dark-text">{t('settings.appearance.primaryColor')}</Label>
                <div className="flex gap-3 mt-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={config.appearance.primaryColor}
                    onChange={(e) => updateAppearance({ primaryColor: e.target.value })}
                    className="w-20 h-10 dark:bg-dark-surface dark:border-coal-600"
                  />
                  <Input
                    type="text"
                    value={config.appearance.primaryColor}
                    onChange={(e) => updateAppearance({ primaryColor: e.target.value })}
                    className="flex-1 dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
                  />
                </div>
              </div>

              {/* Logo */}
              <div>
                <Label className="dark:text-dark-text">{t('settings.appearance.logo')}</Label>
                <div className="mt-2 flex flex-col gap-3">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={config.appearance.logo}
                      onChange={(e) => updateAppearance({ logo: e.target.value })}
                      placeholder={getAssetPath('/logo.svg')}
                      className="dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
                    />
                  </div>

                  {/* Logo Preview */}
                  <div className="mt-2">
                    <Label className="text-sm font-medium text-smoke-700 dark:text-dark-textSecondary">
                      {t('settings.appearance.logoPreview')}
                    </Label>
                    <div className="mt-1 flex items-center">
                      <img
                        src={getAssetPath(config.appearance.logo)}
                        alt="Current logo preview"
                        className="w-12 h-12 object-contain border border-smoke-300 rounded dark:border-coal-600"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = getAssetPath('/logo-default.svg'); // fallback to default logo
                        }}
                      />
                    </div>
                  </div>

                  {/* Logo Upload */}
                  <div className="mt-2">
                    <Label className="text-sm font-medium text-smoke-700 dark:text-dark-textSecondary">
                      {t('settings.appearance.uploadNewLogo')}
                    </Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target?.result) {
                              updateAppearance({ logo: event.target.result as string });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="dark:bg-dark-surface dark:border-coal-600"
                    />
                  </div>
                </div>
              </div>

              {/* Theme */}
              <div>
                <Label htmlFor="theme" className="dark:text-dark-text">{t('settings.appearance.theme')}</Label>
                <select
                  id="theme"
                  value={config.appearance.theme}
                  onChange={(e) =>
                    updateAppearance({ theme: e.target.value as 'light' | 'dark' | 'auto' })
                  }
                  className="w-full mt-2 rounded-md border border-smoke-300 px-3 py-2 dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
                >
                  <option value="light">{t('settings.appearance.themes.light')}</option>
                  <option value="dark">{t('settings.appearance.themes.dark')}</option>
                  <option value="auto">{t('settings.appearance.themes.auto')}</option>
                </select>
              </div>

              {/* Language */}
              <div>
                <Label htmlFor="language" className="dark:text-dark-text">{t('settings.appearance.language')}</Label>
                <select
                  id="language"
                  value={config.appearance.language}
                  onChange={(e) => {
                    const newLanguage = e.target.value;
                    updateAppearance({ language: newLanguage });
                    changeLanguage(newLanguage);
                  }}
                  className="w-full mt-2 rounded-md border border-smoke-300 px-3 py-2 dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
                >
                  <option value="auto">{t('languages.auto')}</option>
                  <option value="es">{t('languages.es')}</option>
                  <option value="en">{t('languages.en')}</option>
                </select>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models">
          <ModelSettings />
          <div className="space-y-6 hidden">
            {/* Model Source Selection */}
            <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
              <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4">
                {t('settings.models.source.title')}
              </h2>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    id="modelSourceLocal"
                    name="modelSource"
                    value="local"
                    checked={config.modelSource === 'local'}
                    onChange={(e) => setModelSource(e.target.value as ModelSource)}
                    className="mt-1 dark:bg-dark-surface dark:border-coal-600"
                  />
                  <div className="flex-1">
                    <Label htmlFor="modelSourceLocal" className="font-semibold dark:text-dark-text">
                      {t('settings.models.source.local')}
                    </Label>
                    <p className="text-sm text-smoke-600 dark:text-dark-textSecondary mt-1">
                      {t('settings.models.source.localDescription')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    id="modelSourceApi"
                    name="modelSource"
                    value="api"
                    checked={config.modelSource === 'api'}
                    onChange={(e) => setModelSource(e.target.value as ModelSource)}
                    className="mt-1 dark:bg-dark-surface dark:border-coal-600"
                  />
                  <div className="flex-1">
                    <Label htmlFor="modelSourceApi" className="font-semibold dark:text-dark-text">
                      {t('settings.models.source.api')}
                    </Label>
                    <p className="text-sm text-smoke-600 dark:text-dark-textSecondary mt-1">
                      {t('settings.models.source.apiDescription')}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Local Models Configuration */}
            {config.modelSource === 'local' && (
              <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
                <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4">
                  {t('settings.models.local.title')}
                </h2>

                <div className="space-y-6">
                  {/* Detection Model */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="font-semibold dark:text-dark-text">
                        {t('settings.models.local.detection')}
                      </Label>
                      <Switch
                        checked={config.localModels.detection.enabled}
                        onCheckedChange={(checked) =>
                          updateLocalModels({
                            detection: { ...config.localModels.detection, enabled: checked }
                          })
                        }
                      />
                    </div>
                    <Input
                      type="text"
                      value={config.localModels.detection.modelPath}
                      onChange={(e) =>
                        updateLocalModels({
                          detection: { ...config.localModels.detection, modelPath: e.target.value }
                        })
                      }
                      placeholder="/models/detection-v1.0.0.onnx"
                      disabled={!config.localModels.detection.enabled}
                      className="dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
                    />
                  </div>

                  {/* Segmentation Model */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="font-semibold dark:text-dark-text">
                        {t('settings.models.local.segmentation')}
                      </Label>
                      <Switch
                        checked={config.localModels.segmentation.enabled}
                        onCheckedChange={(checked) =>
                          updateLocalModels({
                            segmentation: { ...config.localModels.segmentation, enabled: checked }
                          })
                        }
                      />
                    </div>
                    <Input
                      type="text"
                      value={config.localModels.segmentation.modelPath}
                      onChange={(e) =>
                        updateLocalModels({
                          segmentation: {
                            ...config.localModels.segmentation,
                            modelPath: e.target.value
                          }
                        })
                      }
                      placeholder="/models/segmentation-v1.0.0.onnx"
                      disabled={!config.localModels.segmentation.enabled}
                      className="dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* API Models Configuration */}
            {config.modelSource === 'api' && (
              <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
                <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4">
                  {t('settings.models.api.title')}
                </h2>

                <div className="space-y-6">
                  {/* API Endpoint */}
                  <div>
                    <Label htmlFor="apiEndpoint" className="dark:text-dark-text">{t('settings.models.api.endpoint')}</Label>
                    <Input
                      id="apiEndpoint"
                      type="url"
                      value={config.apiModels.endpoint}
                      onChange={(e) => updateAPIModels({ endpoint: e.target.value })}
                      placeholder="https://api.example.com/inference"
                      className="mt-2 dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
                    />
                  </div>

                  {/* API Key */}
                  <div>
                    <Label htmlFor="apiKey" className="dark:text-dark-text">{t('settings.models.api.key')}</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={config.apiModels.apiKey}
                      onChange={(e) => updateAPIModels({ apiKey: e.target.value })}
                      placeholder="sk-..."
                      className="mt-2 dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
                    />
                  </div>

                  {/* Model Name */}
                  <div>
                    <Label htmlFor="modelName" className="dark:text-dark-text">{t('settings.models.api.modelName')}</Label>
                    <Input
                      id="modelName"
                      type="text"
                      value={config.apiModels.modelName}
                      onChange={(e) => updateAPIModels({ modelName: e.target.value })}
                      placeholder="????????"
                      className="mt-2 dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
                    />
                  </div>

                  {/* Timeout */}
                  <div>
                    <Label htmlFor="timeout" className="dark:text-dark-text">
                      {t('settings.models.api.timeout')} ({config.apiModels.timeout}ms)
                    </Label>
                    <Slider
                      id="timeout"
                      min={5000}
                      max={60000}
                      step={1000}
                      value={[config.apiModels.timeout || 30000]}
                      onValueChange={([value]) => updateAPIModels({ timeout: value })}
                      className="mt-3"
                    />
                  </div>

                  {/* Custom Headers */}
                  <div>
                    <Label htmlFor="headers" className="dark:text-dark-text">{t('settings.models.api.headers')}</Label>
                    <Textarea
                      id="headers"
                      value={JSON.stringify(config.apiModels.headers, null, 2)}
                      onChange={(e) => {
                        try {
                          const headers = JSON.parse(e.target.value);
                          updateAPIModels({ headers });
                        } catch {
                          // Invalid JSON, ignore
                        }
                      }}
                      placeholder='{\n  "X-Custom-Header": "value"\n}'
                      className="mt-2 font-mono text-sm dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
                      rows={4}
                    />
                  </div>

                  {/* Test Connection */}
                  <div>
                    <Button
                      onClick={handleTestApiConnection}
                      disabled={isTestingApi || !config.apiModels.endpoint}
                      className="w-full"
                    >
                      {isTestingApi
                        ? t('settings.models.api.testing')
                        : t('settings.models.api.test')}
                    </Button>

                    {apiTestResult && (
                      <div
                        className={`mt-3 p-3 rounded-md flex items-start gap-2 ${
                          apiTestResult.success
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        }`}
                      >
                        {apiTestResult.success ? (
                          <Check className="h-5 w-5 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="h-5 w-5 flex-shrink-0" />
                        )}
                        <span className="text-sm">{apiTestResult.message}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Report Tab */}
        <TabsContent value="report">
          <ReportSettings />
        </TabsContent>

        {/* Processing Tab */}
        <TabsContent value="processing">
          <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
            <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4">
              {t('settings.processing.title')}
            </h2>

            <div className="space-y-6">
              {/* Optic Disc Refinement */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold dark:text-dark-text">
                    {t('settings.processing.opticDiscRefinement')}
                  </Label>
                  <p className="text-sm text-smoke-600 dark:text-dark-textSecondary mt-1">
                    {t('settings.processing.opticDiscRefinementDescription')}
                  </p>
                </div>
                <Switch
                  checked={config.processing.opticDiscRefinement}
                  onCheckedChange={(checked) => updateProcessing({ opticDiscRefinement: checked })}
                />
              </div>

              {/* CPU Vendor */}
              <div>
                <Label htmlFor="cpuVendor" className="dark:text-dark-text font-semibold">
                  {t('settings.processing.cpuVendor')}
                </Label>
                <p className="text-sm text-smoke-600 dark:text-dark-textSecondary mt-1 mb-2">
                  {t('settings.processing.cpuVendorDescription')}
                </p>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md mb-3 dark:bg-amber-900/20 dark:border-amber-700">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      {t('settings.processing.cpuVendorWarning')}
                    </p>
                  </div>
                </div>
                <select
                  id="cpuVendor"
                  value={config.processing.cpuVendor}
                  onChange={(e) =>
                    updateProcessing({ cpuVendor: e.target.value as 'auto' | 'intel' | 'amd' | 'arm' })
                  }
                  className="w-full rounded-md border border-smoke-300 px-3 py-2 dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
                >
                  <option value="auto">{t('settings.processing.cpuVendorOptions.auto')}</option>
                  <option value="intel">{t('settings.processing.cpuVendorOptions.intel')}</option>
                  <option value="amd">{t('settings.processing.cpuVendorOptions.amd')}</option>
                  <option value="arm">{t('settings.processing.cpuVendorOptions.arm')}</option>
                </select>
              </div>

              {/* Max Image Size */}
              <div>
                <Label htmlFor="maxImageSize" className="dark:text-dark-text">
                  {t('settings.processing.maxImageSizeWithUnit', { size: config.processing.maxImageSize })}
                </Label>
                <Slider
                  id="maxImageSize"
                  min={1}
                  max={50}
                  step={1}
                  value={[config.processing.maxImageSize]}
                  onValueChange={([value]) => updateProcessing({ maxImageSize: value })}
                  className="mt-3"
                />
              </div>

              {/* Compression Quality */}
              <div>
                <Label htmlFor="compressionQuality" className="dark:text-dark-text">
                  {t('settings.processing.compressionQualityWithUnit', {
                    quality: Math.round(config.processing.compressionQuality * 100)
                  })}
                </Label>
                <Slider
                  id="compressionQuality"
                  min={0.1}
                  max={1}
                  step={0.1}
                  value={[config.processing.compressionQuality]}
                  onValueChange={([value]) => updateProcessing({ compressionQuality: value })}
                  className="mt-3"
                />
              </div>

              {/* Batch Size */}
              <div>
                <Label htmlFor="batchSize" className="dark:text-dark-text">
                  {t('settings.processing.batchSizeWithUnit', { size: config.processing.batchSize })}
                </Label>
                <Slider
                  id="batchSize"
                  min={1}
                  max={20}
                  step={1}
                  value={[config.processing.batchSize]}
                  onValueChange={([value]) => updateProcessing({ batchSize: value })}
                  className="mt-3"
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Advanced Analysis Tab */}
        <TabsContent value="analysis">
          <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
            <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-2">
              Análisis Avanzado
            </h2>
            <p className="text-sm text-smoke-600 dark:text-dark-textSecondary mb-6">
              Configura qué análisis automáticos deseas activar en el canvas.
            </p>

            <div className="space-y-6">
              {/* Circinate Pattern */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold dark:text-dark-text">
                    Patrones Circinados
                  </Label>
                  <p className="text-sm text-smoke-600 dark:text-dark-textSecondary mt-1">
                    Detecta anillos circinados de exudados duros alrededor de la fóvea
                  </p>
                </div>
                <Switch
                  checked={config.advancedAnalysis?.circinatePattern ?? true}
                  onCheckedChange={(checked) => updateAdvancedAnalysis({ circinatePattern: checked })}
                />
              </div>

              {/* Hemorrhages */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold dark:text-dark-text">
                    Hemorragias Retinianas
                  </Label>
                  <p className="text-sm text-smoke-600 dark:text-dark-textSecondary mt-1">
                    Analiza hemorragias y su distribución por cuadrantes
                  </p>
                </div>
                <Switch
                  checked={config.advancedAnalysis?.hemorrhages ?? true}
                  onCheckedChange={(checked) => updateAdvancedAnalysis({ hemorrhages: checked })}
                />
              </div>

              {/* Microaneurysms */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold dark:text-dark-text">
                    Microaneurismas
                  </Label>
                  <p className="text-sm text-smoke-600 dark:text-dark-textSecondary mt-1">
                    Detecta y cuenta microaneurismas con análisis de distribución
                  </p>
                </div>
                <Switch
                  checked={config.advancedAnalysis?.microaneurysms ?? true}
                  onCheckedChange={(checked) => updateAdvancedAnalysis({ microaneurysms: checked })}
                />
              </div>

              {/* Optic Disc Cupping */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold dark:text-dark-text">
                    Excavación del Disco Óptico
                  </Label>
                  <p className="text-sm text-smoke-600 dark:text-dark-textSecondary mt-1">
                    Calcula la relación copa/disco (C/D ratio) y distancias del anillo neuroretiniano
                  </p>
                </div>
                <Switch
                  checked={config.advancedAnalysis?.opticDiscCupping ?? true}
                  onCheckedChange={(checked) => updateAdvancedAnalysis({ opticDiscCupping: checked })}
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Clinical Guidelines Tab */}
        <TabsContent value="guidelines">
          <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
            <GuidelineSelector />
          </Card>
        </TabsContent>

        {/* PWA Tab */}
        <TabsContent value="pwa">
          <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
            <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4">
              {t('settings.pwa.title')}
            </h2>

            <div className="space-y-6">
              {/* Install Status */}
              <div>
                <Label className="font-semibold dark:text-dark-text">{t('settings.pwa.status')}</Label>
                <div className="mt-2 dark:text-dark-text">
                  <PWAInstallStatus />
                </div>
              </div>

              {/* Install Button */}
              <div>
                <Label className="font-semibold dark:text-dark-text">{t('settings.pwa.install')}</Label>
                <p className="text-sm text-smoke-600 dark:text-dark-textSecondary mt-1 mb-3">
                  {t('settings.pwa.installDescription')}
                </p>
                <PWAInstallButton variant="button" className="w-full" />
              </div>

              {/* PWA Info */}
              <div className="bg-ice p-4 rounded-md dark:bg-dark-surface dark:border dark:border-coal-600">
                <h3 className="font-semibold text-coal-800 dark:text-dark-text mb-2">
                  {t('settings.pwa.benefits.title')}
                </h3>
                <ul className="space-y-2 text-sm text-smoke-600 dark:text-dark-textSecondary">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary-500 flex-shrink-0 mt-0.5 dark:text-primary-400" />
                    <span>{t('settings.pwa.benefits.offline')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary-500 flex-shrink-0 mt-0.5 dark:text-primary-400" />
                    <span>{t('settings.pwa.benefits.faster')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary-500 flex-shrink-0 mt-0.5 dark:text-primary-400" />
                    <span>{t('settings.pwa.benefits.desktop')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary-500 flex-shrink-0 mt-0.5 dark:text-primary-400" />
                    <span>{t('settings.pwa.benefits.privacy')}</span>
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* About Tab */}
        <TabsContent value="about">
          <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
            <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4">
              {t('settings.about.title')}
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-coal-800 dark:text-dark-text">{config.name}</h3>
                <p className="text-sm text-smoke-600 dark:text-dark-textSecondary mt-1">
                  {t('settings.about.description')}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold dark:text-dark-text">{t('settings.about.version')}</Label>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
                    {currentVersion ? currentVersion.version : isCheckingVersion ? t('settings.about.loading') : '1.0.0'}
                  </p>
                  <Button
                    onClick={checkForUpdates}
                    variant="outline"
                    size="sm"
                    disabled={isCheckingVersion}
                    className="dark:border-coal-600 dark:text-dark-text dark:hover:bg-dark-background"
                  >
                    {isCheckingVersion ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-2">{t('settings.about.check')}</span>
                  </Button>
                </div>
                {hasUpdate && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md dark:bg-amber-900/20 dark:border-amber-700">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      {t('settings.about.updateAvailable')}
                    </p>
                    <Button
                      onClick={forceUpdate}
                      variant="default"
                      size="sm"
                      className="mt-2 w-full dark:bg-amber-600 dark:hover:bg-amber-700"
                      disabled={isReloading}
                    >
                      {isReloading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-2">{t('settings.about.updateNow')}</span>
                    </Button>
                  </div>
                )}
                {!hasUpdate && updateCheckMessage && (
                  <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-md dark:bg-emerald-900/20 dark:border-emerald-700">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                      <p className="text-sm text-emerald-800 dark:text-emerald-200">
                        {updateCheckMessage}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Button onClick={resetConfig} variant="outline" className="w-full dark:border-coal-600 dark:text-dark-text dark:hover:bg-dark-background">
                  {t('settings.about.reset')}
                </Button>
              </div>

              {/* Admin Access Button */}
              <div className="pt-4 border-t border-smoke-200 dark:border-coal-700">
                <Button
                  onClick={() => setShowAdminLogin(true)}
                  variant="ghost"
                  size="sm"
                  className="w-full gap-2 text-smoke-600 dark:text-dark-textSecondary hover:text-coal-800 dark:hover:text-dark-text"
                >
                  <Lock className="w-4 h-4" />
                  Acceso Administrativo
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Admin Login Modal */}
      <AdminLogin
        open={showAdminLogin}
        onOpenChange={handleAdminLoginClose}
      />
    </div>
  );
}
