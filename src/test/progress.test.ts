import { describe, it, expect, vi } from 'vitest';
import { atLeast, runWithProgress } from '@/lib/progress';

describe('runWithProgress', () => {
  it('runs every item, in order', async () => {
    const seen: number[] = [];
    await runWithProgress([1, 2, 3], async (n) => { seen.push(n); }, () => {});
    expect(seen).toEqual([1, 2, 3]);
  });

  it('reports the count after each one, ending at the total', async () => {
    const counts: number[] = [];
    await runWithProgress(['a', 'b', 'c'], async () => {}, (done) => counts.push(done));
    expect(counts).toEqual([1, 2, 3]);
  });

  it('passes the index along', async () => {
    const pairs: [string, number][] = [];
    await runWithProgress(['a', 'b'], async (item, i) => { pairs.push([item, i]); }, () => {});
    expect(pairs).toEqual([['a', 0], ['b', 1]]);
  });

  it('lets the browser paint every so often', async () => {
    // Without a real yield the progress bar never moves: awaiting a promise
    // only drains microtasks, and the browser paints between macrotasks.
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    const before = timeout.mock.calls.length;
    await runWithProgress(Array.from({ length: 25 }, (_, i) => i), async () => {}, () => {}, 10);
    expect(timeout.mock.calls.length - before).toBe(2); // after 10 and after 20
    timeout.mockRestore();
  });

  it('does nothing at all for an empty list', async () => {
    const report = vi.fn();
    await runWithProgress([], async () => {}, report);
    expect(report).not.toHaveBeenCalled();
  });

  it('stops and reports the failure instead of finishing quietly', async () => {
    const seen: number[] = [];
    await expect(
      runWithProgress([1, 2, 3], async (n) => {
        if (n === 2) throw new Error('se cayó la base de datos');
        seen.push(n);
      }, () => {}),
    ).rejects.toThrow('se cayó la base de datos');
    expect(seen).toEqual([1]);
  });
});

describe('atLeast', () => {
  it('gives back what the work returned', async () => {
    await expect(atLeast(1, Promise.resolve('hecho'))).resolves.toBe('hecho');
  });

  it('waits out the floor even when the work is instant', async () => {
    const start = Date.now();
    await atLeast(50, Promise.resolve(null));
    expect(Date.now() - start).toBeGreaterThanOrEqual(45);
  });

  it('does not hold back work that already took longer', async () => {
    const start = Date.now();
    await atLeast(10, new Promise((r) => setTimeout(() => r(null), 60)));
    expect(Date.now() - start).toBeLessThan(200);
  });

  it('still lets a failure through', async () => {
    await expect(atLeast(1, Promise.reject(new Error('falló')))).rejects.toThrow('falló');
  });
});
