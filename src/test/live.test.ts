import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { batch, getDataVersion, notifyChange, useLiveQuery } from '@/lib/live';
import { db } from '@/lib/db';

/**
 * Every write notifies, and every notification re-runs *all* the live queries
 * mounted in the app. Importing three hundred customers one at a time would
 * mean three hundred full reloads, which on a phone is a frozen screen.
 * `batch` exists to make that one reload.
 *
 * These count how many times a real `useLiveQuery` re-runs, because that is
 * the cost the batching is there to avoid.
 */
function countingQuery() {
  let runs = 0;
  const hook = renderHook(() =>
    useLiveQuery(() => {
      runs += 1;
      return Promise.resolve(runs);
    }, []),
  );
  return { hook, runs: () => runs };
}

describe('batch', () => {
  beforeEach(async () => {
    await db.customers.clear();
  });

  it('refreshes once for many writes instead of once each', async () => {
    const { hook, runs } = countingQuery();
    await waitFor(() => expect(runs()).toBe(1)); // the first, on mount

    await act(async () => {
      await batch(async () => {
        for (let i = 0; i < 20; i++) {
          await db.customers.add({ name: `Cliente ${i}`, createdAt: new Date() });
        }
      });
    });

    await waitFor(() => expect(runs()).toBe(2));
    expect(runs()).toBe(2);
    hook.unmount();
  });

  it('without a batch, every write refreshes', async () => {
    const { hook, runs } = countingQuery();
    await waitFor(() => expect(runs()).toBe(1));

    await act(async () => {
      await db.customers.add({ name: 'Ana', createdAt: new Date() });
      await db.customers.add({ name: 'Yeni', createdAt: new Date() });
    });

    await waitFor(() => expect(runs()).toBe(3));
    hook.unmount();
  });

  it('a batch inside a batch still refreshes only at the very end', async () => {
    const { hook, runs } = countingQuery();
    await waitFor(() => expect(runs()).toBe(1));

    await act(async () => {
      await batch(async () => {
        await batch(async () => {
          await db.customers.add({ name: 'Ana', createdAt: new Date() });
        });
        await db.customers.add({ name: 'Yeni', createdAt: new Date() });
      });
    });

    await waitFor(() => expect(runs()).toBe(2));
    expect(runs()).toBe(2);
    hook.unmount();
  });

  it('does not refresh at all when the batch wrote nothing', async () => {
    const { hook, runs } = countingQuery();
    await waitFor(() => expect(runs()).toBe(1));

    await act(async () => {
      await batch(async () => {
        await db.customers.toArray();
      });
    });

    expect(runs()).toBe(1);
    hook.unmount();
  });

  it('the writes really happened', async () => {
    await batch(async () => {
      await db.customers.add({ name: 'Yeni', createdAt: new Date() });
      await db.customers.add({ name: 'Dayana', createdAt: new Date() });
    });
    expect(await db.customers.toArray()).toHaveLength(2);
  });

  it('returns what the body returns', async () => {
    await expect(batch(async () => 'listo')).resolves.toBe('listo');
  });

  it('lets an error out and still closes the batch behind it', async () => {
    await expect(
      batch(async () => {
        await db.customers.add({ name: 'Ana', createdAt: new Date() });
        throw new Error('falló a media importación');
      }),
    ).rejects.toThrow('falló a media importación');

    // If the batch had stayed open, nothing would ever refresh again.
    const before = getDataVersion();
    notifyChange();
    expect(getDataVersion()).toBe(before + 1);
  });
});
