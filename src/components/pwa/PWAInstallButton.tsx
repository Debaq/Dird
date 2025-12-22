import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Check, X } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface PWAInstallButtonProps {
  variant?: 'button' | 'banner';
  className?: string;
}

export function PWAInstallButton({ variant = 'button', className = '' }: PWAInstallButtonProps) {
  const { t } = useTranslation();
  const { isInstallable, isInstalled, isStandalone, promptInstall, dismissPrompt } = usePWAInstall();
  const [isInstalling, setIsInstalling] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      await promptInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    dismissPrompt();
  };

  // Don't show anything if already installed or in standalone mode
  if (isInstalled || isStandalone) {
    return null;
  }

  // Don't show if not installable
  if (!isInstallable) {
    return null;
  }

  if (variant === 'banner' && showBanner) {
    return (
      <Card className={`border-primary-500 bg-primary-50 ${className}`}>
        <div className="flex items-center gap-4 p-4">
          <div className="flex-shrink-0">
            <Download className="h-6 w-6 text-primary-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-coal-800">
              {t('pwa.install.title')}
            </h3>
            <p className="text-sm text-smoke-600">
              {t('pwa.install.description')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleInstall}
              disabled={isInstalling}
              size="sm"
              className="bg-primary-500 hover:bg-primary-600"
            >
              {isInstalling ? (
                <>
                  <Download className="mr-2 h-4 w-4 animate-pulse" />
                  {t('pwa.install.installing')}
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  {t('pwa.install.button')}
                </>
              )}
            </Button>
            <Button
              onClick={handleDismiss}
              variant="outline"
              size="sm"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Button variant
  return (
    <Button
      onClick={handleInstall}
      disabled={isInstalling}
      className={className}
    >
      {isInstalling ? (
        <>
          <Download className="mr-2 h-4 w-4 animate-pulse" />
          {t('pwa.install.installing')}
        </>
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" />
          {t('pwa.install.button')}
        </>
      )}
    </Button>
  );
}

export function PWAInstallStatus() {
  const { t } = useTranslation();
  const { isInstalled, isStandalone } = usePWAInstall();

  if (!isInstalled && !isStandalone) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm text-emerald-600">
      <Check className="h-4 w-4" />
      <span>{t('pwa.install.installed')}</span>
    </div>
  );
}
