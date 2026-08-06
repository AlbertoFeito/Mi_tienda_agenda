import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FixedBottomBar from '@/components/FixedBottomBar';
import ConfirmDialog from '@/components/ConfirmDialog';

/**
 * `position: fixed` only means "fixed to the screen" while no ancestor has a
 * transform. Several screens animate themselves in with one, and that makes the
 * animated element the anchor instead — so a bar meant to sit above the bottom
 * nav lands at the foot of the page content. With three hundred customers in
 * the list that is thousands of pixels below the fold, which is how the delete
 * button came to be invisible.
 *
 * jsdom does not lay anything out, so these check the thing that actually fixes
 * it: the markup leaves the transformed subtree altogether.
 */
function AnimatedScreen({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="pantalla" className="animate-fade-in-up">
      <p>lista larguísima</p>
      {children}
    </div>
  );
}

describe('FixedBottomBar', () => {
  it('renders outside the animated screen, not inside it', () => {
    render(
      <AnimatedScreen>
        <FixedBottomBar>
          <button>Eliminar 3 cliente(s)</button>
        </FixedBottomBar>
      </AnimatedScreen>,
    );

    const boton = screen.getByRole('button', { name: 'Eliminar 3 cliente(s)' });
    expect(boton).toBeTruthy();
    // The point of the portal: the screen that would trap it is not an ancestor.
    expect(screen.getByTestId('pantalla').contains(boton)).toBe(false);
    expect(document.body.contains(boton)).toBe(true);
  });
});

describe('ConfirmDialog', () => {
  it('also escapes the animated screen', () => {
    render(
      <AnimatedScreen>
        <ConfirmDialog title="¿Eliminar 3 cliente(s)?" onConfirm={() => {}} onCancel={() => {}} />
      </AnimatedScreen>,
    );

    const titulo = screen.getByText('¿Eliminar 3 cliente(s)?');
    expect(screen.getByTestId('pantalla').contains(titulo)).toBe(false);
    expect(document.body.contains(titulo)).toBe(true);
  });
});
