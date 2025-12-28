import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Plus, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { getInstallations, updateTokens } from '@/lib/api/admin-service';
import type { Installation } from '@/types/admin';

export function InstallationsList() {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedInstallation, setSelectedInstallation] = useState<Installation | null>(null);
  const [newTotalTokens, setNewTotalTokens] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const { t } = useTranslation();

  const loadInstallations = async (showToast = false) => {
    try {
      setIsRefreshing(true);
      const data = await getInstallations();
      setInstallations(data);
      if (showToast) {
        toast.success(t('admin.installations.success'));
      }
    } catch (error) {
      toast.error(t('admin.installations.errors.loadError'));
      console.error(error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadInstallations();
  }, []);

  const handleUpdateTokens = async () => {
    if (!selectedInstallation) return;

    const newTotal = parseInt(newTotalTokens);
    if (isNaN(newTotal) || newTotal < 0) {
      toast.error(t('admin.installations.errors.invalidAmount'));
      return;
    }

    if (newTotal > 9999) {
      toast.error(t('admin.installations.errors.exceedsLimit'));
      return;
    }

    if (newTotal === selectedInstallation.tokens) {
      toast.info(t('admin.installations.info.noChanges'));
      return;
    }

    setIsUpdating(true);

    try {
      const newTokens = await updateTokens({
        installation_token: selectedInstallation.installation_token,
        new_total: newTotal,
      });

      toast.success(t('admin.installations.tokensUpdated', { tokens: newTokens }));
      setSelectedInstallation(null);
      setNewTotalTokens('');
      loadInstallations();
    } catch (error) {
      toast.error(t('admin.installations.errors.updateError'));
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString();
  };

  const truncateToken = (token: string) => {
    return `${token.substring(0, 8)}...${token.substring(token.length - 4)}`;
  };

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center gap-2 text-smoke-600 dark:text-dark-textSecondary">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Cargando instalaciones...</span>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-coal-800 dark:text-dark-text">
              {t('admin.installations.title')}
            </h2>
            <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
              {t('admin.installations.total', { count: installations.length })}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadInstallations(true)}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {t('admin.installations.refreshButton')}
          </Button>
        </div>

        {installations.length === 0 ? (
          <div className="text-center py-12 text-smoke-600 dark:text-dark-textSecondary">
            {t('admin.installations.noInstallations')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-smoke-200 dark:border-coal-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-smoke-600 dark:text-dark-textSecondary">
                    {t('admin.installations.columns.token')}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-smoke-600 dark:text-dark-textSecondary">
                    {t('admin.installations.columns.tokens')}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-smoke-600 dark:text-dark-textSecondary">
                    {t('admin.installations.columns.created')}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-smoke-600 dark:text-dark-textSecondary">
                    {t('admin.installations.columns.lastAccess')}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-smoke-600 dark:text-dark-textSecondary">
                    {t('admin.installations.columns.status')}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-smoke-600 dark:text-dark-textSecondary">
                    {t('admin.installations.columns.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {installations.map((installation) => (
                  <tr
                    key={installation.installation_token}
                    className="border-b border-smoke-100 dark:border-coal-800 hover:bg-smoke-50 dark:hover:bg-coal-900 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <code className="text-xs bg-smoke-100 dark:bg-coal-800 px-2 py-1 rounded font-mono">
                        {truncateToken(installation.installation_token)}
                      </code>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-semibold ${
                        installation.tokens === 0
                          ? 'text-red-600 dark:text-red-400'
                          : installation.tokens < 5
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        {installation.tokens}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-smoke-600 dark:text-dark-textSecondary">
                      {formatDate(installation.created_at)}
                    </td>
                    <td className="py-3 px-4 text-sm text-smoke-600 dark:text-dark-textSecondary">
                      {formatDate(installation.last_access)}
                    </td>
                    <td className="py-3 px-4">
                      {installation.has_active_beacon && (
                        <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                          <Radio className="w-3 h-3 animate-pulse" />
                          {t('admin.installations.activeBeacon')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedInstallation(installation);
                          setNewTotalTokens(installation.tokens.toString());
                        }}
                        className="gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        {t('admin.installations.editTokens')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Update Tokens Dialog */}
      <Dialog
        open={!!selectedInstallation}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedInstallation(null);
            setNewTotalTokens('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.installations.dialog.title')}</DialogTitle>
          </DialogHeader>

          {selectedInstallation && (
            <div className="space-y-4">
              <div className="bg-smoke-50 dark:bg-coal-900 p-3 rounded-lg space-y-1">
                <p className="text-xs text-smoke-600 dark:text-dark-textSecondary">
                  {t('admin.installations.dialog.tokenLabel')}
                </p>
                <code className="text-xs font-mono break-all">
                  {selectedInstallation.installation_token}
                </code>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-smoke-600 dark:text-dark-textSecondary">{t('admin.installations.dialog.currentTokens')}</p>
                  <p className="text-lg font-semibold text-coal-800 dark:text-dark-text">
                    {selectedInstallation.tokens}
                  </p>
                </div>
                <div>
                  <p className="text-smoke-600 dark:text-dark-textSecondary">{t('admin.installations.dialog.newTotal')}</p>
                  <p className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                    {parseInt(newTotalTokens) || 0}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tokens-amount">{t('admin.installations.dialog.newTotalLabel')}</Label>
                <Input
                  id="tokens-amount"
                  type="number"
                  min="0"
                  max="9999"
                  value={newTotalTokens}
                  onChange={(e) => setNewTotalTokens(e.target.value)}
                  placeholder={t('admin.installations.dialog.placeholder')}
                  disabled={isUpdating}
                />
                <p className="text-xs text-smoke-600 dark:text-dark-textSecondary">
                  {t('admin.installations.dialog.range')}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedInstallation(null);
                setNewTotalTokens('');
              }}
              disabled={isUpdating}
            >
              {t('ui.cancel')}
            </Button>
            <Button
              onClick={handleUpdateTokens}
              disabled={isUpdating || !newTotalTokens || parseInt(newTotalTokens) < 0}
            >
              {isUpdating ? t('admin.installations.updating') : t('admin.installations.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
