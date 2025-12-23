import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useConfigStore } from '@/stores/config-store';
import { FileText, Image as ImageIcon, Layout, PenTool, Palette } from 'lucide-react';

export default function ReportSettings() {
  const { t } = useTranslation();
  const { config, updateReportConfig } = useConfigStore();
  const { report } = config;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          updateReportConfig({ 
            customLogo: event.target.result as string,
            useSystemLogo: false 
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
        <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t('settings.report.general.title')}
        </h2>
        <div className="space-y-4">
          <div>
            <Label className="dark:text-dark-text">{t('settings.report.general.reportTitle')}</Label>
            <Input
              value={report.title}
              onChange={(e) => updateReportConfig({ title: e.target.value })}
              className="mt-1 dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
            />
          </div>
          <div>
            <Label className="dark:text-dark-text">{t('settings.report.general.reportSubtitle')}</Label>
            <Input
              value={report.subtitle}
              onChange={(e) => updateReportConfig({ subtitle: e.target.value })}
              className="mt-1 dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
            />
          </div>
        </div>
      </Card>

      {/* Logo Settings */}
      <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
        <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4 flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          {t('settings.report.logo.title')}
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="dark:text-dark-text">{t('settings.report.logo.useSystem')}</Label>
            <Switch
              checked={report.useSystemLogo}
              onCheckedChange={(checked) => updateReportConfig({ useSystemLogo: checked })}
            />
          </div>

          {!report.useSystemLogo && (
            <div className="mt-4">
              <Label className="dark:text-dark-text">{t('settings.report.logo.uploadCustom')}</Label>
              <div className="flex gap-4 mt-2 items-start">
                 <Input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="dark:bg-dark-surface dark:border-coal-600"
                />
                {report.customLogo && (
                  <div className="w-16 h-16 border rounded flex items-center justify-center p-1 bg-white">
                    <img 
                      src={report.customLogo} 
                      alt="Custom Logo" 
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Colors */}
      <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
        <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4 flex items-center gap-2">
          <Palette className="h-5 w-5" />
          {t('settings.report.colors.title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="dark:text-dark-text">{t('settings.report.colors.primary')}</Label>
            <div className="flex gap-2 mt-2">
              <Input
                type="color"
                value={report.colors.primary}
                onChange={(e) => updateReportConfig({ 
                  colors: { ...report.colors, primary: e.target.value } 
                })}
                className="w-12 h-10 p-1 dark:bg-dark-surface dark:border-coal-600"
              />
               <Input
                type="text"
                value={report.colors.primary}
                onChange={(e) => updateReportConfig({ 
                  colors: { ...report.colors, primary: e.target.value } 
                })}
                className="flex-1 dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
              />
            </div>
          </div>
          <div>
            <Label className="dark:text-dark-text">{t('settings.report.colors.secondary')}</Label>
            <div className="flex gap-2 mt-2">
              <Input
                type="color"
                value={report.colors.secondary}
                onChange={(e) => updateReportConfig({ 
                  colors: { ...report.colors, secondary: e.target.value } 
                })}
                className="w-12 h-10 p-1 dark:bg-dark-surface dark:border-coal-600"
              />
              <Input
                type="text"
                value={report.colors.secondary}
                onChange={(e) => updateReportConfig({ 
                  colors: { ...report.colors, secondary: e.target.value } 
                })}
                className="flex-1 dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
              />
            </div>
          </div>
          <div>
            <Label className="dark:text-dark-text">{t('settings.report.colors.text')}</Label>
            <div className="flex gap-2 mt-2">
              <Input
                type="color"
                value={report.colors.text}
                onChange={(e) => updateReportConfig({ 
                  colors: { ...report.colors, text: e.target.value } 
                })}
                className="w-12 h-10 p-1 dark:bg-dark-surface dark:border-coal-600"
              />
               <Input
                type="text"
                value={report.colors.text}
                onChange={(e) => updateReportConfig({ 
                  colors: { ...report.colors, text: e.target.value } 
                })}
                className="flex-1 dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Sections Visibility */}
      <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
        <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4 flex items-center gap-2">
          <Layout className="h-5 w-5" />
          {t('settings.report.sections.title')}
        </h2>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Switch
              id="section-patient"
              checked={report.sections.patientInfo}
              onCheckedChange={(checked) => updateReportConfig({ 
                sections: { ...report.sections, patientInfo: checked } 
              })}
            />
            <Label htmlFor="section-patient" className="dark:text-dark-text">{t('settings.report.sections.patientInfo')}</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="section-summary"
              checked={report.sections.summary}
              onCheckedChange={(checked) => updateReportConfig({ 
                sections: { ...report.sections, summary: checked } 
              })}
            />
            <Label htmlFor="section-summary" className="dark:text-dark-text">{t('settings.report.sections.summary')}</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="section-gallery"
              checked={report.sections.gallery}
              onCheckedChange={(checked) => updateReportConfig({ 
                sections: { ...report.sections, gallery: checked } 
              })}
            />
            <Label htmlFor="section-gallery" className="dark:text-dark-text">{t('settings.report.sections.gallery')}</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="section-notes"
              checked={report.sections.evaluatorNotes}
              onCheckedChange={(checked) => updateReportConfig({ 
                sections: { ...report.sections, evaluatorNotes: checked } 
              })}
            />
            <Label htmlFor="section-notes" className="dark:text-dark-text">{t('settings.report.sections.evaluatorNotes')}</Label>
          </div>
        </div>
      </Card>

      {/* Gallery Options */}
      {report.sections.gallery && (
        <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
          <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4 flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            {t('settings.report.gallery.title')}
          </h2>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                id="gallery-annotated"
                checked={report.gallery.includeAnnotated}
                onCheckedChange={(checked) => updateReportConfig({ 
                  gallery: { ...report.gallery, includeAnnotated: checked } 
                })}
              />
              <Label htmlFor="gallery-annotated" className="dark:text-dark-text">{t('settings.report.gallery.includeAnnotated')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="gallery-original"
                checked={report.gallery.includeOriginal}
                onCheckedChange={(checked) => updateReportConfig({ 
                  gallery: { ...report.gallery, includeOriginal: checked } 
                })}
              />
              <Label htmlFor="gallery-original" className="dark:text-dark-text">{t('settings.report.gallery.includeOriginal')}</Label>
            </div>
            {!report.gallery.includeAnnotated && !report.gallery.includeOriginal && (
              <p className="text-sm text-red-500 mt-2">{t('settings.report.gallery.warning')}</p>
            )}
          </div>
        </Card>
      )}

      {/* Signature */}
      <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
        <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4 flex items-center gap-2">
          <PenTool className="h-5 w-5" />
          {t('settings.report.signature.title')}
        </h2>
        <div>
          <Label className="dark:text-dark-text">{t('settings.report.signature.text')}</Label>
          <Input
            value={report.signature.text}
            onChange={(e) => updateReportConfig({ 
              signature: { ...report.signature, text: e.target.value } 
            })}
            className="mt-1 dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
          />
        </div>
      </Card>
    </div>
  );
}
