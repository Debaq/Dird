import { useEffect, useState } from 'react';
import { useDbVersion } from './version-store';

/**
 * Drop-in replacement for `dexie-react-hooks`'s `useLiveQuery`.
 *
 * Reactivamente re-ejecuta `query()` cuando:
 *  - cambian las dependencias `deps`
 *  - cambia el contador global de escrituras (`useDbVersion`)
 *
 * No utiliza el sistema de live queries de Dexie. La reactividad se basa
 * en un counter que el shim incrementa en cada `add/put/update/delete/
 * bulkAdd/bulkPut/transaction`.
 */
export function useSqlQuery<T>(
  query: () => Promise<T> | T,
  deps: ReadonlyArray<unknown> = [],
  defaultValue?: T,
): T | undefined {
  const version = useDbVersion((s) => s.version);
  const [value, setValue] = useState<T | undefined>(defaultValue);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(query())
      .then((r) => {
        if (!cancelled) setValue(r);
      })
      .catch((e) => {
        if (!cancelled) {
          console.warn('useSqlQuery error:', e);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);

  return value;
}

/** Alias compatible con el nombre de Dexie. */
export const useLiveQuery = useSqlQuery;
