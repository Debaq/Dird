import { useEffect, useState } from 'react';
import { ArrowDown, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { migrateAll, type MigrationProgress } from '@/lib/db-sql/migrator';
import { useAuthStore } from '@/stores/auth-store';
import { exportAllData, downloadDirdFile } from '@/lib/export/dird-exporter';

interface MigrationWizardProps {
  onDone: () => void;
}

type Phase = 'intro' | 'backup' | 'migrating' | 'done' | 'error';

export function MigrationWizard({ onDone }: MigrationWizardProps) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [progress, setProgress] = useState<MigrationProgress>({
    step: 'init', current: 0, total: 0, message: 'Preparando…',
  });
  const [error, setError] = useState<string | null>(null);

  const exportPassphrase = useAuthStore((s) => s.exportPassphrase);

  const handleStart = async () => {
    setPhase('backup');
    setError(null);
    try {
      // 1) Backup .dird cifrado antes de tocar nada.
      if (!exportPassphrase) {
        throw new Error(
          'Configura primero la contraseña de exportación en Ajustes → Seguridad para poder generar el respaldo cifrado.',
        );
      }
      const blob = await exportAllData(exportPassphrase);
      downloadDirdFile(blob, `dird_pre_migration_backup_${Date.now()}`);

      // 2) Migración Dexie → SQLite.
      setPhase('migrating');
      await migrateAll((p) => setProgress(p));

      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  useEffect(() => {
    if (phase !== 'done') return;
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-coal-900/80 p-4">
      <Card className="w-full max-w-2xl p-8 space-y-6 bg-white dark:bg-coal-800">
        <h1 className="text-2xl font-bold text-coal-900 dark:text-dark-text">
          Migración a base cifrada
        </h1>

        {phase === 'intro' && (
          <div className="space-y-4">
            <p className="text-coal-800 dark:text-dark-text">
              Hemos detectado datos clínicos de una versión anterior de DIRD+ guardados sin cifrado
              en este equipo (IndexedDB). DIRD+ v2.0 los moverá a una base SQLite cifrada con
              AES-256 (SQLCipher) protegida por tu contraseña.
            </p>
            <div className="flex items-center justify-center py-2">
              <div className="text-center text-sm text-smoke-600 dark:text-dark-textSecondary">
                IndexedDB (plano)
                <ArrowDown className="w-6 h-6 mx-auto my-1 text-blue-600" />
                SQLite + SQLCipher
              </div>
            </div>
            <div className="flex gap-3 items-start p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg">
              <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <p>Antes de migrar, DIRD+ generará un <strong>respaldo cifrado .dird</strong> con todos tus datos actuales.</p>
                <p>El respaldo se descargará automáticamente; guárdalo en un lugar seguro.</p>
              </div>
            </div>
            {!exportPassphrase && (
              <div className="flex gap-3 items-start p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Necesitas configurar la contraseña de exportación en Ajustes → Seguridad antes
                  de iniciar la migración.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onDone}>Más tarde</Button>
              <Button onClick={handleStart} disabled={!exportPassphrase}>
                Iniciar migración
              </Button>
            </div>
          </div>
        )}

        {phase === 'backup' && (
          <div className="space-y-3 text-center">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" />
            <p className="text-coal-800 dark:text-dark-text">Generando respaldo cifrado .dird…</p>
          </div>
        )}

        {phase === 'migrating' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <p className="text-coal-800 dark:text-dark-text">{progress.message}</p>
            </div>
            <div className="w-full h-2 bg-smoke-200 dark:bg-coal-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-smoke-600 dark:text-dark-textSecondary text-right">
              {progress.current} / {progress.total} ({pct}%)
            </p>
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-3 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-green-600" />
            <p className="text-lg font-semibold text-coal-900 dark:text-dark-text">
              Migración completada
            </p>
            <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
              Tus datos ahora están cifrados en SQLCipher. Cerrando este diálogo…
            </p>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-3">
            <div className="flex gap-3 items-start p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 dark:text-red-200">Error en la migración</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onDone}>Cancelar</Button>
              <Button onClick={handleStart}>Reintentar</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
