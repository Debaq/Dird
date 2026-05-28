import { useState } from 'react';
import { Shield, Lock, KeyRound, AlertTriangle, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';

const MIN_PASSWORD_LEN = 12;

export function SecuritySettings() {
  const [newLoginPw, setNewLoginPw] = useState('');
  const [newLoginPw2, setNewLoginPw2] = useState('');
  const [changing, setChanging] = useState(false);
  const [newExportPw, setNewExportPw] = useState('');

  const changeLoginPassword = useAuthStore((s) => s.changeLoginPassword);
  const lock = useAuthStore((s) => s.lock);
  const setExportPassphrase = useAuthStore((s) => s.setExportPassphrase);
  const exportPassphrase = useAuthStore((s) => s.exportPassphrase);

  const canChangeLogin =
    newLoginPw.length >= MIN_PASSWORD_LEN && newLoginPw === newLoginPw2;

  const handleChangeLogin = async () => {
    setChanging(true);
    try {
      await changeLoginPassword(newLoginPw);
      toast.success('Contraseña de aplicación actualizada.');
      setNewLoginPw('');
      setNewLoginPw2('');
    } catch (e) {
      toast.error('Error: ' + String(e));
    } finally {
      setChanging(false);
    }
  };

  const handleSetExport = () => {
    if (newExportPw.length < MIN_PASSWORD_LEN) {
      toast.error(`Mínimo ${MIN_PASSWORD_LEN} caracteres.`);
      return;
    }
    setExportPassphrase(newExportPw);
    setNewExportPw('');
    toast.success('Contraseña de exportación actualizada para esta sesión.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-coal-900 dark:text-dark-text">
          Seguridad y cifrado
        </h2>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-coal-900 dark:text-dark-text">
            Cambiar contraseña de la aplicación
          </h3>
        </div>
        <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
          Re-cifra la base local con la nueva clave. La operación es atómica.
        </p>
        <div className="space-y-2">
          <Label htmlFor="new-login">Nueva contraseña</Label>
          <Input
            id="new-login"
            type="password"
            value={newLoginPw}
            onChange={(e) => setNewLoginPw(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-login-2">Repetir</Label>
          <Input
            id="new-login-2"
            type="password"
            value={newLoginPw2}
            onChange={(e) => setNewLoginPw2(e.target.value)}
          />
          {newLoginPw2.length > 0 && newLoginPw !== newLoginPw2 && (
            <p className="text-xs text-red-600">No coinciden.</p>
          )}
        </div>
        <div className="flex gap-3 items-start p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            La contraseña anterior dejará de funcionar inmediatamente. No hay recuperación.
          </p>
        </div>
        <Button onClick={handleChangeLogin} disabled={!canChangeLogin || changing} className="w-full">
          {changing ? 'Actualizando...' : 'Cambiar contraseña'}
        </Button>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-coal-900 dark:text-dark-text">
            Contraseña de exportación
          </h3>
        </div>
        <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
          Solo se guarda en memoria durante esta sesión. Se usa para cifrar archivos <code>.dird</code> exportados.
        </p>
        <div className="space-y-2">
          <Label htmlFor="new-export">
            {exportPassphrase ? 'Reemplazar contraseña' : 'Establecer contraseña'}
          </Label>
          <Input
            id="new-export"
            type="password"
            value={newExportPw}
            onChange={(e) => setNewExportPw(e.target.value)}
          />
        </div>
        <Button onClick={handleSetExport} className="w-full">
          {exportPassphrase ? 'Actualizar' : 'Establecer'}
        </Button>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <LogOut className="w-5 h-5 text-red-600" />
          <h3 className="font-semibold text-coal-900 dark:text-dark-text">
            Bloquear sesión
          </h3>
        </div>
        <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
          Cierra la base cifrada y vuelve a la pantalla de login.
        </p>
        <Button onClick={() => void lock()} variant="outline" className="w-full">
          Bloquear ahora
        </Button>
      </Card>
    </div>
  );
}
