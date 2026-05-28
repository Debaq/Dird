import { useState, FormEvent } from 'react';
import { Shield, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';

export function LoginScreen() {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const unlock = useAuthStore((s) => s.unlock);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    clearError();
    try {
      await unlock(password);
      setPassword('');
    } catch {
      // error está en el store
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-coal-900/80 p-4">
      <Card className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-coal-800">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-coal-900 dark:text-dark-text">DIRD+</h1>
            <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
              Desbloquear base cifrada
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pw" className="flex items-center gap-2">
              <Lock className="w-4 h-4" /> Contraseña de la aplicación
            </Label>
            <Input
              id="pw"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) clearError();
              }}
              autoFocus
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button
            type="submit"
            disabled={!password || submitting}
            className="w-full"
          >
            {submitting ? 'Desbloqueando...' : 'Desbloquear'}
          </Button>
        </form>

        <p className="text-xs text-center text-smoke-500 dark:text-dark-textSecondary">
          DIRD+ no guarda tu contraseña en ningún lugar. Sin recuperación posible.
        </p>
      </Card>
    </div>
  );
}
