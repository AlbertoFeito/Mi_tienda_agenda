import type { ReactNode } from 'react';
import Portal from '@/components/Portal';

/**
 * A solid bar of actions pinned just above the bottom navigation.
 *
 * It goes through a portal because `position: fixed` does not always mean
 * "fixed to the screen": an ancestor with a transform becomes the anchor
 * instead, and several screens animate themselves in with one. Rendered inline,
 * a bar like this lands at the foot of the page content — for a list of three
 * hundred customers, thousands of pixels below the fold, which is the same as
 * not existing.
 *
 * It has its own background on purpose. Floating buttons over a long list let
 * the list show through the gaps between them, which reads as a glitch rather
 * than as a toolbar.
 *
 * The offset clears the navigation bar plus the gesture inset, which on some
 * phones makes it taller than its nominal 4rem.
 */
export default function FixedBottomBar({ children }: { children: ReactNode }) {
  return (
    <Portal>
      <div
        className="above-nav fixed left-0 right-0 max-w-lg mx-auto z-[60] bg-white border-t border-[#E2E8F0] px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
      >
        {children}
      </div>
    </Portal>
  );
}
