import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings as SettingsIcon,
  Palette,
  Cpu,
  Gauge,
  Download,
  Info,
  Check,
  AlertCircle
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

export function Settings() {
  const { t } = useTranslation();
  const {
    config,
    updateAppearance,
    updateProcessing,
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

  const handleTestApiConnection = async () => {
    setIsTestingApi(true);
    setApiTestResult(null);

    try {
      const result = await apiInferenceService.testConnection();
      setApiTestResult(result);
    } catch (error) {
      setApiTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-coal-800 flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          {t('settings.title')}
        </h1>
        <p className="text-smoke-600 mt-2">{t('settings.description')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="border-b border-smoke-300 mb-6">
          <TabsTrigger value="appearance">
            <Palette className="h-4 w-4 mr-2" />
            {t('settings.tabs.appearance')}
          </TabsTrigger>
          <TabsTrigger value="models">
            <Cpu className="h-4 w-4 mr-2" />
            {t('settings.tabs.models')}
          </TabsTrigger>
          <TabsTrigger value="processing">
            <Gauge className="h-4 w-4 mr-2" />
            {t('settings.tabs.processing')}
          </TabsTrigger>
          <TabsTrigger value="pwa">
            <Download className="h-4 w-4 mr-2" />
            {t('settings.tabs.pwa')}
          </TabsTrigger>
          <TabsTrigger value="about">
            <Info className="h-4 w-4 mr-2" />
            {t('settings.tabs.about')}
          </TabsTrigger>
        </TabsList>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-coal-800 mb-4">
              {t('settings.appearance.title')}
            </h2>

            <div className="space-y-6">
              {/* Primary Color */}
              <div>
                <Label htmlFor="primaryColor">{t('settings.appearance.primaryColor')}</Label>
                <div className="flex gap-3 mt-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={config.appearance.primaryColor}
                    onChange={(e) => updateAppearance({ primaryColor: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={config.appearance.primaryColor}
                    onChange={(e) => updateAppearance({ primaryColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Logo */}
              <div>
                <Label htmlFor="logo">{t('settings.appearance.logo')}</Label>
                <Input
                  id="logo"
                  type="text"
                  value={config.appearance.logo}
                  onChange={(e) => updateAppearance({ logo: e.target.value })}
                  placeholder="/logo.svg"
                  className="mt-2"
                />
              </div>

              {/* Theme */}
              <div>
                <Label htmlFor="theme">{t('settings.appearance.theme')}</Label>
                <select
                  id="theme"
                  value={config.appearance.theme}
                  onChange={(e) =>
                    updateAppearance({ theme: e.target.value as 'light' | 'dark' | 'auto' })
                  }
                  className="w-full mt-2 rounded-md border border-smoke-300 px-3 py-2"
                >
                  <option value="light">{t('settings.appearance.themes.light')}</option>
                  <option value="dark">{t('settings.appearance.themes.dark')}</option>
                  <option value="auto">{t('settings.appearance.themes.auto')}</option>
                </select>
              </div>

              {/* Language */}
              <div>
                <Label htmlFor="language">{t('settings.appearance.language')}</Label>
                <select
                  id="language"
                  value={config.appearance.language}
                  onChange={(e) => updateAppearance({ language: e.target.value })}
                  className="w-full mt-2 rounded-md border border-smoke-300 px-3 py-2"
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models">
          <div className="space-y-6">
            {/* Model Source Selection */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-coal-800 mb-4">
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
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label htmlFor="modelSourceLocal" className="font-semibold">
                      {t('settings.models.source.local')}
                    </Label>
                    <p className="text-sm text-smoke-600 mt-1">
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
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label htmlFor="modelSourceApi" className="font-semibold">
                      {t('settings.models.source.api')}
                    </Label>
                    <p className="text-sm text-smoke-600 mt-1">
                      {t('settings.models.source.apiDescription')}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Local Models Configuration */}
            {config.modelSource === 'local' && (
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-coal-800 mb-4">
                  {t('settings.models.local.title')}
                </h2>

                <div className="space-y-6">
                  {/* Detection Model */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="font-semibold">
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
                    />
                  </div>

                  {/* Segmentation Model */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="font-semibold">
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
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* API Models Configuration */}
            {config.modelSource === 'api' && (
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-coal-800 mb-4">
                  {t('settings.models.api.title')}
                </h2>

                <div className="space-y-6">
                  {/* API Endpoint */}
                  <div>
                    <Label htmlFor="apiEndpoint">{t('settings.models.api.endpoint')}</Label>
                    <Input
                      id="apiEndpoint"
                      type="url"
                      value={config.apiModels.endpoint}
                      onChange={(e) => updateAPIModels({ endpoint: e.target.value })}
                      placeholder="https://api.example.com/inference"
                      className="mt-2"
                    />
                  </div>

                  {/* API Key */}
                  <div>
                    <Label htmlFor="apiKey">{t('settings.models.api.key')}</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={config.apiModels.apiKey}
                      onChange={(e) => updateAPIModels({ apiKey: e.target.value })}
                      placeholder="sk-..."
                      className="mt-2"
                    />
                  </div>

                  {/* Model Name */}
                  <div>
                    <Label htmlFor="modelName">{t('settings.models.api.modelName')}</Label>
                    <Input
                      id="modelName"
                      type="text"
                      value={config.apiModels.modelName}
                      onChange={(e) => updateAPIModels({ modelName: e.target.value })}
                      placeholder="yolov8n-retina-v2.0"
                      className="mt-2"
                    />
                  </div>

                  {/* Timeout */}
                  <div>
                    <Label htmlFor="timeout">
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
                    <Label htmlFor="headers">{t('settings.models.api.headers')}</Label>
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
                      className="mt-2 font-mono text-sm"
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
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
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

        {/* Processing Tab */}
        <TabsContent value="processing">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-coal-800 mb-4">
              {t('settings.processing.title')}
            </h2>

            <div className="space-y-6">
              {/* Auto Process */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold">
                    {t('settings.processing.autoProcess')}
                  </Label>
                  <p className="text-sm text-smoke-600 mt-1">
                    {t('settings.processing.autoProcessDescription')}
                  </p>
                </div>
                <Switch
                  checked={config.processing.autoProcess}
                  onCheckedChange={(checked) => updateProcessing({ autoProcess: checked })}
                />
              </div>

              {/* Max Image Size */}
              <div>
                <Label htmlFor="maxImageSize">
                  {t('settings.processing.maxImageSize')} ({config.processing.maxImageSize} MB)
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
                <Label htmlFor="compressionQuality">
                  {t('settings.processing.compressionQuality')} (
                  {Math.round(config.processing.compressionQuality * 100)}%)
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
                <Label htmlFor="batchSize">
                  {t('settings.processing.batchSize')} ({config.processing.batchSize})
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

        {/* PWA Tab */}
        <TabsContent value="pwa">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-coal-800 mb-4">
              {t('settings.pwa.title')}
            </h2>

            <div className="space-y-6">
              {/* Install Status */}
              <div>
                <Label className="font-semibold">{t('settings.pwa.status')}</Label>
                <div className="mt-2">
                  <PWAInstallStatus />
                </div>
              </div>

              {/* Install Button */}
              <div>
                <Label className="font-semibold">{t('settings.pwa.install')}</Label>
                <p className="text-sm text-smoke-600 mt-1 mb-3">
                  {t('settings.pwa.installDescription')}
                </p>
                <PWAInstallButton variant="button" className="w-full" />
              </div>

              {/* PWA Info */}
              <div className="bg-ice p-4 rounded-md">
                <h3 className="font-semibold text-coal-800 mb-2">
                  {t('settings.pwa.benefits.title')}
                </h3>
                <ul className="space-y-2 text-sm text-smoke-600">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary-500 flex-shrink-0 mt-0.5" />
                    <span>{t('settings.pwa.benefits.offline')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary-500 flex-shrink-0 mt-0.5" />
                    <span>{t('settings.pwa.benefits.faster')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary-500 flex-shrink-0 mt-0.5" />
                    <span>{t('settings.pwa.benefits.desktop')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary-500 flex-shrink-0 mt-0.5" />
                    <span>{t('settings.pwa.benefits.privacy')}</span>
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* About Tab */}
        <TabsContent value="about">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-coal-800 mb-4">
              {t('settings.about.title')}
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-coal-800">{config.name}</h3>
                <p className="text-sm text-smoke-600 mt-1">
                  {t('settings.about.description')}
                </p>
              </div>

              <div>
                <Label className="font-semibold">{t('settings.about.version')}</Label>
                <p className="text-sm text-smoke-600 mt-1">1.0.0</p>
              </div>

              <div>
                <Button onClick={resetConfig} variant="outline" className="w-full">
                  {t('settings.about.reset')}
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
