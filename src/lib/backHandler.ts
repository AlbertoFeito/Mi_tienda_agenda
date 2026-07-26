import { useEffect, useRef } from 'react';

/**
 * Global back-navigation stack.
 *
 * Overlays and sub-views (product form, customer form/detail, settings modal,
 * payment sheet, ...) register a close handler while they are open. The native
 * hardware/gesture "back" button pops the most recent handler instead of
 * closing the app, so back always goes to the previous view.
 */

type BackHandler = () => void;

const stack: BackHandler[] = [];

function pushHandler(handler: BackHandler): () => void {
  stack.push(handler);
  return () => {
    const i = stack.lastIndexOf(handler);
    if (i >= 0) stack.splice(i, 1);
  };
}

/**
 * Run the top-most back handler, if any.
 * Returns true when a handler consumed the back action.
 */
export function runTopBackHandler(): boolean {
  const handler = stack[stack.length - 1];
  if (handler) {
    handler();
    return true;
  }
  return false;
}

/**
 * Register `onBack` as the active back handler while `active` is true
 * (defaults to true, i.e. while the component is mounted).
 */
export function useBackHandler(onBack: () => void, active = true): void {
  const ref = useRef(onBack);
  ref.current = onBack;

  useEffect(() => {
    if (!active) return;
    return pushHandler(() => ref.current());
  }, [active]);
}
