import { Copy, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getInstallationToken } from '@/lib/utils/installation';

interface TokenInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TokenInfoModal({ open, onOpenChange }: TokenInfoModalProps) {
  const { t } = useTranslation();
  const installationToken = getInstallationToken();

  const handleCopyToken = () => {
    navigator.clipboard.writeText(installationToken);
    toast.success(t('tokens.modal.copied'));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            {t('tokens.modal.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
              {t('tokens.modal.description')}
            </p>
            <div className="bg-smoke-100 dark:bg-coal-900 rounded-lg p-4 border border-smoke-200 dark:border-coal-700">
              <code className="text-xs font-mono text-coal-800 dark:text-dark-text break-all block">
                {installationToken}
              </code>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyToken}
              className="w-full gap-2"
            >
              <Copy className="w-4 h-4" />
              {t('tokens.modal.copyButton')}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
