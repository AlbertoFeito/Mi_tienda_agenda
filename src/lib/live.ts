import { useEffect, useRef, useState } from 'react';

/**
 * Lightweight reactive layer that replaces `dexie-react-hooks`.
 *
 * The native SQLite backend (and the localStorage dev fallback) are not
 * reactive on their own, so every write bumps a global version counter and
 * notifies subscribers. `useLiveQuery` re-runs its async query whenever the
 * data changes or its dependencies change. For a single-user local app this
 * coarse-grained invalidation is more than fast enough.
 */

let version = 0;
const listeners = new Set<() => void>();

let batchDepth = 0;
let batchPending = false;

/** Called by the data layer after every write so live queries refresh. */
export function notifyChange(): void {
  version++;
  if (batchDepth > 0) {
    batchPending = true;
    return;
  }
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* ignore listener errors */
    }
  }
}

/**
 * Run many writes behind a single refresh.
 *
 * Every write notifies, and every notification re-runs *all* the live queries
 * mounted in the app. Importing three hundred customers one by one would mean
 * three hundred full reloads, which on a phone means a frozen screen. Nesting
 * is counted, so a batch inside a batch still refreshes once, at the end.
 */
export async function batch<T>(fn: () => Promise<T>): Promise<T> {
  batchDepth++;
  try {
    return await fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0 && batchPending) {
      batchPending = false;
      notifyChange();
    }
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Drop-in replacement for dexie-react-hooks' `useLiveQuery`.
 * Runs `querier` and returns its result, re-running on any DB write or when
 * one of `deps` changes.
 */
export function useLiveQuery<T>(
  querier: () => Promise<T> | T,
  deps: unknown[] = [],
): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  const querierRef = useRef(querier);
  querierRef.current = querier;

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      Promise.resolve(querierRef.current())
        .then((result) => {
          if (!cancelled) setValue(result);
        })
        .catch((err) => {
          if (!cancelled) console.error('useLiveQuery error:', err);
        });
    };

    run();
    const unsubscribe = subscribe(run);
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}

/** Current data version — exposed mainly for debugging/testing. */
export function getDataVersion(): number {
  return version;
}
