import { create } from 'zustand';
import { dbOpen, dbClose, dbExists, dbIsOpen, dbChangePassword } from '@/lib/db-sql/client';

export type AuthStatus = 'checking' | 'first-run' | 'locked' | 'unlocked';

interface AuthState {
  status: AuthStatus;
  error: string | null;
  /** Cifrado pass para exports/imports `.dird`. Solo en memoria durante la sesión. */
  exportPassphrase: string | null;
  checkBoot: () => Promise<void>;
  unlock: (password: string) => Promise<void>;
  setupFirstRun: (loginPassword: string, exportPassword: string) => Promise<void>;
  lock: () => Promise<void>;
  changeLoginPassword: (newPassword: string) => Promise<void>;
  setExportPassphrase: (p: string | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'checking',
  error: null,
  exportPassphrase: null,

  checkBoot: async () => {
    try {
      if (await dbIsOpen()) {
        set({ status: 'unlocked', error: null });
        return;
      }
      const exists = await dbExists();
      set({ status: exists ? 'locked' : 'first-run', error: null });
    } catch (e) {
      set({ status: 'locked', error: String(e) });
    }
  },

  unlock: async (password) => {
    try {
      await dbOpen(password);
      set({ status: 'unlocked', error: null });
    } catch (e) {
      set({ error: 'Contraseña incorrecta o base de datos corrupta.' });
      throw e;
    }
  },

  setupFirstRun: async (loginPassword, exportPassword) => {
    await dbOpen(loginPassword);
    set({
      status: 'unlocked',
      error: null,
      exportPassphrase: exportPassword || null,
    });
  },

  lock: async () => {
    await dbClose();
    set({ status: 'locked', exportPassphrase: null });
  },

  changeLoginPassword: async (newPassword) => {
    await dbChangePassword(newPassword);
  },

  setExportPassphrase: (p) => set({ exportPassphrase: p }),
  clearError: () => set({ error: null }),
}));

// Auto-check al cargar el módulo.
if (typeof window !== 'undefined') {
  void useAuthStore.getState().checkBoot();
}
