import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * A bar pinned just above the bottom navigation, whatever screen it is used on.
 *
 * It goes through a portal because `position: fixed` does not always mean
 * "fixed to the screen": an ancestor with a transform becomes the anchor
 * instead, and several screens animate themselves in with one. Rendered inline,
 * a bar like this lands at the foot of the page content — for a list of three
 * hundred customers, thousands of pixels below the fold, which is the same as
 * not existing.
 *
 * The offset clears the navigation bar plus the gesture inset, which on some
 * phones makes it taller than its nominal 4rem.
 */
export default function FixedBottomBar({ children }: { children: ReactNode }) {
  return createPortal(
    <div
      className="fixed left-0 right-0 max-w-lg mx-auto px-4 pb-2 z-[60] pointer-events-none"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="pointer-events-auto">{children}</div>
    </div>,
    document.body,
  );
}
