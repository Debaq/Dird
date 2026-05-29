import { create } from 'zustand';

/**
 * Counter monótono que se incrementa cada vez que se escribe en la base
 * SQLite local. Los hooks `useSqlQuery` se suscriben a él para re-ejecutar
 * sus consultas cuando los datos cambian.
 */
interface DbVersionState {
  version: number;
  bump: () => void;
}

export const useDbVersion = create<DbVersionState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

export function bumpDbVersion(): void {
  useDbVersion.getState().bump();
}
