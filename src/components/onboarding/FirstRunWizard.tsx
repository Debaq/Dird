import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Lock, KeyRound, AlertTriangle, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';

type Step = 'welcome' | 'login' | 'export' | 'confirm';

const MIN_PASSWORD_LEN = 12;

function strengthHint(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= MIN_PASSWORD_LEN) score++;
  if (pw.length >= 16) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['muy débil', 'débil', 'aceptable', 'buena', 'fuerte', 'muy fuerte'];
  return { score, label: labels[Math.min(score, 5)] };
}

export function FirstRunWizard() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('welcome');
  const [loginPw, setLoginPw] = useState('');
  const [loginPw2, setLoginPw2] = useState('');
  const [exportPw, setExportPw] = useState('');
  const [exportPw2, setExportPw2] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setupFirstRun = useAuthStore((s) => s.setupFirstRun);

  const loginStrength = strengthHint(loginPw);
  const exportStrength = strengthHint(exportPw);

  const canAdvanceLogin =
    loginPw.length >= MIN_PASSWORD_LEN && loginPw === loginPw2 && loginStrength.score >= 3;
  const canAdvanceExport =
    exportPw.length >= MIN_PASSWORD_LEN && exportPw === exportPw2 && exportStrength.score >= 3;

  const handleFinish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await setupFirstRun(loginPw, exportPw);
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-coal-900/80 p-4">
      <Card className="w-full max-w-2xl p-8 space-y-6 bg-white dark:bg-coal-800">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-coal-900 dark:text-dark-text">
              {t('wizard.title', 'Configuración inicial de DIRD+')}
            </h1>
            <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
              {t('wizard.subtitle', 'Paso {{n}} de 4', { n: ['welcome','login','export','confirm'].indexOf(step) + 1 })}
            </p>
          </div>
        </div>

        {step === 'welcome' && (
          <div className="space-y-4">
            <p className="text-coal-800 dark:text-dark-text">
              Antes de empezar configuraremos dos contraseñas que protegen tus datos clínicos:
            </p>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-coal-900 dark:text-dark-text">Contraseña de la aplicación.</strong>
                  <p className="text-sm text-smoke-700 dark:text-dark-textSecondary">
                    Cifra la base local con AES-256 (SQLCipher). Se pide en cada inicio.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <KeyRound className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-coal-900 dark:text-dark-text">Contraseña de exportación.</strong>
                  <p className="text-sm text-smoke-700 dark:text-dark-textSecondary">
                    Cifra los archivos <code>.dird</code> que exportes para compartir o respaldar.
                  </p>
                </div>
              </li>
            </ul>
            <div className="flex gap-3 items-start p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                No existe recuperación de contraseña. Si las pierdes, tus datos cifrados quedarán inaccesibles permanentemente.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep('login')} className="gap-2">
                Continuar <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 'login' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-coal-900 dark:text-dark-text">
              Contraseña de la aplicación
            </h2>
            <div className="space-y-2">
              <Label htmlFor="login-pw">Contraseña (mín. {MIN_PASSWORD_LEN} caracteres)</Label>
              <Input
                id="login-pw"
                type="password"
                value={loginPw}
                onChange={(e) => setLoginPw(e.target.value)}
                autoFocus
              />
              {loginPw.length > 0 && (
                <p className="text-xs text-smoke-600 dark:text-dark-textSecondary">
                  Fortaleza: <strong>{loginStrength.label}</strong>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-pw-2">Repetir contraseña</Label>
              <Input
                id="login-pw-2"
                type="password"
                value={loginPw2}
                onChange={(e) => setLoginPw2(e.target.value)}
              />
              {loginPw2.length > 0 && loginPw !== loginPw2 && (
                <p className="text-xs text-red-600">Las contraseñas no coinciden.</p>
              )}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('welcome')} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Atrás
              </Button>
              <Button onClick={() => setStep('export')} disabled={!canAdvanceLogin} className="gap-2">
                Continuar <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 'export' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-coal-900 dark:text-dark-text">
              Contraseña de exportación
            </h2>
            <p className="text-sm text-smoke-700 dark:text-dark-textSecondary">
              Recomendado: distinta a la de la aplicación. Se usa para cifrar los archivos
              <code className="mx-1">.dird</code> que envíes a colegas o subas a respaldos.
            </p>
            <div className="space-y-2">
              <Label htmlFor="export-pw">Contraseña</Label>
              <Input
                id="export-pw"
                type="password"
                value={exportPw}
                onChange={(e) => setExportPw(e.target.value)}
                autoFocus
              />
              {exportPw.length > 0 && (
                <p className="text-xs text-smoke-600 dark:text-dark-textSecondary">
                  Fortaleza: <strong>{exportStrength.label}</strong>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="export-pw-2">Repetir contraseña</Label>
              <Input
                id="export-pw-2"
                type="password"
                value={exportPw2}
                onChange={(e) => setExportPw2(e.target.value)}
              />
              {exportPw2.length > 0 && exportPw !== exportPw2 && (
                <p className="text-xs text-red-600">Las contraseñas no coinciden.</p>
              )}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('login')} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Atrás
              </Button>
              <Button onClick={() => setStep('confirm')} disabled={!canAdvanceExport} className="gap-2">
                Continuar <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-coal-900 dark:text-dark-text">
              Confirmación
            </h2>
            <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg space-y-2">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm text-red-800 dark:text-red-200">
                  <p><strong>Sin recuperación.</strong> Anthropic, los desarrolladores de DIRD+ ni nadie puede recuperar contraseñas perdidas.</p>
                  <p>Si olvidas la contraseña de la aplicación, los datos clínicos almacenados quedarán inaccesibles. Sin excepciones.</p>
                  <p>Guarda ambas en un gestor de contraseñas (Bitwarden, KeePassXC) antes de continuar.</p>
                </div>
              </div>
            </div>
            <label className="flex gap-3 items-start cursor-pointer p-3 border border-smoke-300 dark:border-coal-600 rounded-lg">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-coal-800 dark:text-dark-text">
                Entiendo que si pierdo las contraseñas perderé el acceso a los datos cifrados permanentemente.
              </span>
            </label>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('export')} disabled={submitting} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Atrás
              </Button>
              <Button
                onClick={handleFinish}
                disabled={!acknowledged || submitting}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                {submitting ? 'Configurando...' : <><Check className="w-4 h-4" /> Crear base cifrada</>}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
