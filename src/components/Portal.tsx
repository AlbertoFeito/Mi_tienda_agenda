import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders its children at the top of the document, outside whatever screen
 * asked for them.
 *
 * Every floating window in the app — dialogs, bottom sheets, the image viewer —
 * needs this, and it is not decoration. `position: fixed` only means "fixed to
 * the screen" while no ancestor has a transform; if one does, that ancestor
 * becomes the anchor instead. The screens here animate themselves in, and those
 * animations leave a transform in place, so a dialog written to sit in the
 * middle of the screen ends up in the middle of the *list* — and a bar meant to
 * sit above the bottom nav ends up past the end of the content, which with
 * three hundred customers is nowhere anyone will find it.
 *
 * The app-level screens (lock, licence, onboarding) do not use this: they
 * replace the whole app rather than float over a page, so nothing can trap
 * them.
 */
export default function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
