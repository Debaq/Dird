import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Download, ShieldAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { isTauri } from '@/utils/runtime';

const ACK_KEY = 'dird_web_warning_ack_v1';

export function WebSecurityWarning() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    if (isTauri()) return;
    try {
      if (localStorage.getItem(ACK_KEY) === '1') return;
    } catch {
      // localStorage bloqueado (modo privado); mostrar igual
    }
    setOpen(true);
  }, []);

  const handleAccept = () => {
    if (dontShow) {
      try { localStorage.setItem(ACK_KEY, '1'); } catch { /* ignore */ }
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* modal bloqueante, no cerrar por overlay */ }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            {t('webWarning.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm text-coal-700">
          <p>{t('webWarning.intro')}</p>
          <ul className="space-y-2 pl-1">
            <li className="flex gap-2">
              <ShieldAlert className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
              <span>{t('webWarning.bullet1')}</span>
            </li>
            <li className="flex gap-2">
              <ShieldAlert className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
              <span>{t('webWarning.bullet2')}</span>
            </li>
            <li className="flex gap-2">
              <Download className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary-600" />
              <span>{t('webWarning.bullet3')}</span>
            </li>
          </ul>
          <p className="rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900">
            {t('webWarning.legal')}
          </p>

          <label className="flex items-center gap-2 pt-1 text-xs text-smoke-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="h-4 w-4"
            />
            {t('webWarning.dontShowAgain')}
          </label>
        </div>

        <DialogFooter>
          <a
            href="https://github.com/sievnick/Dird/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-sm rounded-md border border-primary-300 text-primary-700 hover:bg-primary-50 inline-flex items-center gap-1 justify-center"
          >
            <Download className="h-4 w-4" />
            {t('webWarning.downloadDesktop')}
          </a>
          <button
            onClick={handleAccept}
            className="px-3 py-2 text-sm rounded-md bg-primary-600 text-white hover:bg-primary-700"
          >
            {t('webWarning.acknowledge')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
