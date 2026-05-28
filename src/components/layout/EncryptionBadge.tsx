import { useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';

/**
 * Indicador visible del estado de cifrado at-rest.
 * Visibilidad permanente alineada con el indicador 9A del DPG Standard
 * (Data Privacy & Security): el usuario debe poder verificar en cualquier
 * momento que sus datos clínicos están cifrados localmente.
 */
export function EncryptionBadge() {
  const [open, setOpen] = useState(false);
  const status = useAuthStore((s) => s.status);
  const exportPassphrase = useAuthStore((s) => s.exportPassphrase);

  const unlocked = status === 'unlocked';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
          unlocked
            ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200'
            : 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-200',
        )}
        title="Estado del cifrado at-rest (DPG 9A)"
      >
        {unlocked ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">{unlocked ? 'Cifrado' : 'Bloqueado'}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-coal-900/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-coal-800 rounded-lg shadow-strong p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-blue-600" />
                <div>
                  <h2 className="text-lg font-semibold text-coal-900 dark:text-dark-text">
                    Cifrado at-rest
                  </h2>
                  <p className="text-xs text-smoke-600 dark:text-dark-textSecondary">
                    Estado del cifrado local (DPG Standard 9A)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-smoke-500 hover:text-coal-800 dark:hover:text-white"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid gap-3">
              <Row label="Base de datos local">
                {unlocked ? 'Cifrada y desbloqueada' : 'Cifrada (bloqueada)'}
              </Row>
              <Row label="Algoritmo de cifrado">AES-256-GCM (autenticado)</Row>
              <Row label="Motor SQL">SQLCipher (página 4 KiB)</Row>
              <Row label="Derivación de clave (KDF)">
                Argon2id <span className="text-xs text-smoke-500">m=64 MiB · t=3 · p=4</span>
                <br />
                <span className="text-xs text-smoke-500">Parámetros OWASP 2025 · RFC 9106</span>
              </Row>
              <Row label="Exportaciones .dird">
                {exportPassphrase
                  ? 'Cifrado v2.0 activo en esta sesión (AES-256-GCM)'
                  : 'Sin contraseña de exportación — configurar en Ajustes → Seguridad'}
              </Row>
              <Row label="Procesamiento">100% local — sin transmisión a servidores externos</Row>
            </div>

            <div className="border-t border-smoke-200 dark:border-coal-700 pt-4 text-xs text-smoke-600 dark:text-dark-textSecondary space-y-1">
              <p>
                Sin recuperación de contraseña. DIRD+ no almacena ni transmite las contraseñas que
                eliges; perderlas hace inaccesibles los datos cifrados.
              </p>
            </div>

            <div className="flex justify-between items-center pt-2">
              <a
                href="https://github.com/Debaq/Dird#-digital-public-goods-standard-compliance"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                Ver cumplimiento DPG Standard <ExternalLink className="w-3 h-3" />
              </a>
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-smoke-600 dark:text-dark-textSecondary flex-shrink-0">{label}</span>
      <span className="text-right text-coal-900 dark:text-dark-text">{children}</span>
    </div>
  );
}
