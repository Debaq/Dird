import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Radio, RefreshCw, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getActiveBeacons } from '@/lib/api/admin-service';
import type { Beacon } from '@/types/admin';

export function BeaconMonitor() {
  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { t } = useTranslation();

  const loadBeacons = async (showToast = false) => {
    try {
      setIsRefreshing(true);
      const data = await getActiveBeacons();
      setBeacons(data);
      if (showToast) {
        toast.success(t('admin.beaconMonitor.success'));
      }
    } catch (error) {
      toast.error(t('admin.beaconMonitor.errors.loadError'));
      console.error(error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadBeacons();

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      loadBeacons();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const formatTimeRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const truncateToken = (token: string) => {
    return `${token.substring(0, 12)}...${token.substring(token.length - 4)}`;
  };

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center gap-2 text-smoke-600 dark:text-dark-textSecondary">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Cargando balizas...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-coal-800 dark:text-dark-text flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-500 animate-pulse" />
            {t('admin.beaconMonitor.title')}
          </h2>
          <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
            {t('admin.beaconMonitor.description', { count: beacons.length })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadBeacons(true)}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {t('admin.beaconMonitor.refreshButton')}
        </Button>
      </div>

      {beacons.length === 0 ? (
        <div className="text-center py-12">
          <Radio className="w-12 h-12 mx-auto mb-4 text-smoke-400 dark:text-coal-600" />
          <p className="text-smoke-600 dark:text-dark-textSecondary">
            {t('admin.beaconMonitor.noBeacons')}
          </p>
          <p className="text-sm text-smoke-500 dark:text-coal-500 mt-1">
            {t('admin.beaconMonitor.instructions')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {beacons.map((beacon) => (
            <div
              key={beacon.installation_token}
              className="border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 rounded-lg p-4 transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Radio className="w-4 h-4 text-red-600 dark:text-red-400 animate-pulse flex-shrink-0" />
                    <h3 className="font-semibold text-coal-800 dark:text-dark-text">
                      {t('admin.beaconMonitor.activeBeacon')}
                    </h3>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-smoke-600 dark:text-dark-textSecondary">
                        {t('admin.beaconMonitor.installationLabel')}
                      </span>
                      <code className="text-xs bg-white dark:bg-coal-900 px-2 py-0.5 rounded font-mono text-coal-800 dark:text-dark-text">
                        {truncateToken(beacon.installation_token)}
                      </code>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-smoke-600 dark:text-dark-textSecondary">
                      <Clock className="w-3 h-3" />
                      {t('admin.beaconMonitor.activatedLabel')} {new Date(beacon.activated_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="bg-red-600 dark:bg-red-700 text-white px-3 py-1.5 rounded-lg font-mono text-lg font-bold">
                    {formatTimeRemaining(beacon.seconds_remaining)}
                  </div>
                  <p className="text-xs text-smoke-600 dark:text-dark-textSecondary mt-1">
                    {t('admin.beaconMonitor.timeRemaining')}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-1.5 bg-red-200 dark:bg-red-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 dark:bg-red-500 transition-all duration-1000"
                  style={{
                    width: `${(beacon.seconds_remaining / 300) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-smoke-100 dark:bg-coal-900 rounded-lg">
        <p className="text-sm text-smoke-700 dark:text-dark-textSecondary">
          <strong>{t('admin.beaconMonitor.infoLabel')}:</strong> {t('admin.beaconMonitor.infoDescription')}
        </p>
      </div>
    </Card>
  );
}
