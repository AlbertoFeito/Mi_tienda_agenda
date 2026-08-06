/**
 * Running a long job without freezing the screen.
 *
 * Awaiting a database call is not enough to let the browser repaint: those
 * promises settle as microtasks, and the browser only paints between
 * macrotasks. So a loop of nine hundred `await`s runs start to finish without
 * a single frame — the progress bar would stay at zero and then vanish, which
 * is exactly the frozen app the bar is there to avoid.
 *
 * Yielding properly costs a few milliseconds every so often, which is nothing
 * next to the work itself and buys a screen that visibly moves.
 */

/** Hand control back to the browser so it can paint what changed. */
function letItPaint(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Run `each` over every item, reporting how many are done as it goes.
 *
 * `report` fires after each item; the screen is given a chance to repaint every
 * `everyN`. Errors are not swallowed — a job that fails half way through should
 * say so rather than quietly stop.
 */
export async function runWithProgress<T>(
  items: T[],
  each: (item: T, index: number) => Promise<void>,
  report: (done: number) => void,
  everyN = 10,
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    await each(items[i], i);
    report(i + 1);
    if ((i + 1) % everyN === 0) await letItPaint();
  }
}

/**
 * Show something for at least this long.
 *
 * A flash of "Eliminando..." that disappears in 30ms reads as a glitch, not as
 * feedback. Only used for jobs small enough to finish instantly.
 */
export async function atLeast<T>(ms: number, work: Promise<T>): Promise<T> {
  const [result] = await Promise.all([work, new Promise((r) => setTimeout(r, ms))]);
  return result;
}
