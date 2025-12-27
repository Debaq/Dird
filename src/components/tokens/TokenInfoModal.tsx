import { useState } from 'react';
import { Copy, Radio, CheckCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getInstallationToken } from '@/lib/utils/installation';
import { activateBeacon } from '@/lib/api/admin-service';

interface TokenInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TokenInfoModal({ open, onOpenChange }: TokenInfoModalProps) {
  const [isActivating, setIsActivating] = useState(false);
  const [beaconActive, setBeaconActive] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const installationToken = getInstallationToken();

  const handleCopyToken = () => {
    navigator.clipboard.writeText(installationToken);
    toast.success('Token copiado al portapapeles');
  };

  const handleActivateBeacon = async () => {
    setIsActivating(true);

    try {
      const response = await activateBeacon(installationToken);

      if (response.already_active) {
        toast.info(`Baliza ya está activa (${Math.floor(response.seconds_remaining / 60)}:${(response.seconds_remaining % 60).toString().padStart(2, '0')} restantes)`);
      } else {
        toast.success('¡Baliza activada! El administrador será notificado.');
        setBeaconActive(true);
        setTimeRemaining(response.seconds_remaining);

        // Countdown timer
        const interval = setInterval(() => {
          setTimeRemaining((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              setBeaconActive(false);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (error) {
      toast.error('Error al activar baliza');
      console.error(error);
    } finally {
      setIsActivating(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Mi Token de Sesión
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Token Display */}
          <div className="space-y-2">
            <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
              Este es tu identificador único de instalación:
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
              Copiar Token
            </Button>
          </div>

          {/* Beacon Button */}
          <div className="border-t border-smoke-200 dark:border-coal-700 pt-4">
            {beaconActive ? (
              <div className="space-y-3">
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h3 className="font-semibold text-green-800 dark:text-green-300">
                      Baliza Activa
                    </h3>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-400">
                    El administrador ha sido notificado de tu solicitud de ayuda.
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-green-600 dark:text-green-400">
                      Tiempo restante:
                    </span>
                    <span className="font-mono text-lg font-bold text-green-700 dark:text-green-300">
                      {formatTime(timeRemaining)}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-2 bg-green-200 dark:bg-green-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600 dark:bg-green-500 transition-all duration-1000"
                      style={{ width: `${(timeRemaining / 300) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  onClick={handleActivateBeacon}
                  disabled={isActivating}
                  className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white"
                  size="lg"
                >
                  <Radio className={`w-5 h-5 ${isActivating ? 'animate-pulse' : ''}`} />
                  {isActivating ? 'Activando...' : '🚨 Encender Baliza'}
                </Button>
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    <strong>ℹ️ ¿Qué es la baliza?</strong><br />
                    La baliza alertará al administrador durante 5 minutos. Úsala cuando necesites ayuda urgente.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
