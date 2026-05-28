import { ReactNode, useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { FirstRunWizard } from '@/components/onboarding/FirstRunWizard';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { MigrationWizard } from '@/components/onboarding/MigrationWizard';
import { needsMigration } from '@/lib/db-sql/migrator';

interface AppGateProps {
  children: ReactNode;
}

/**
 * Bloquea el render del árbol normal hasta que la base local esté desbloqueada.
 * Una vez desbloqueada, comprueba si hay datos legacy en IndexedDB pendientes
 * de migración y muestra el wizard correspondiente.
 */
export function AppGate({ children }: AppGateProps) {
  const status = useAuthStore((s) => s.status);
  const [showMigration, setShowMigration] = useState(false);
  const [migrationChecked, setMigrationChecked] = useState(false);

  useEffect(() => {
    if (status !== 'unlocked' || migrationChecked) return;
    void (async () => {
      try {
        if (await needsMigration()) {
          setShowMigration(true);
        }
      } catch (e) {
        console.warn('needsMigration check failed:', e);
      } finally {
        setMigrationChecked(true);
      }
    })();
  }, [status, migrationChecked]);

  if (status === 'checking') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-coal-900">
        <div className="text-white text-sm">Verificando estado de la base...</div>
      </div>
    );
  }

  if (status === 'first-run') return <FirstRunWizard />;
  if (status === 'locked') return <LoginScreen />;

  return (
    <>
      {children}
      {showMigration && <MigrationWizard onDone={() => setShowMigration(false)} />}
    </>
  );
}
