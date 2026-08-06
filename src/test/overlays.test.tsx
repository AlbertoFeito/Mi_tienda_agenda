import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import Portal from '@/components/Portal';
import FixedBottomBar from '@/components/FixedBottomBar';
import ConfirmDialog from '@/components/ConfirmDialog';

/**
 * Every floating window has to hang off the document, not off the screen that
 * opened it.
 *
 * `position: fixed` only means "fixed to the viewport" while no ancestor has a
 * transform. If one does, that ancestor becomes the anchor — and the screens
 * here animate themselves in, which leaves exactly that. A dialog written to
 * sit in the middle of the screen then sits in the middle of the *list*, and a
 * bar meant to sit above the bottom nav ends up past the end of the content.
 * With three hundred customers that is thousands of pixels below the fold.
 */

/** Screens that replace the whole app rather than float over a page. */
const APP_LEVEL = ['AuthGate.tsx', 'LicenseScreen.tsx', 'LockScreen.tsx', 'Onboarding.tsx'];

/** Chrome that lives directly in the app shell, where nothing can trap it. */
const SHELL = ['BottomNav.tsx', 'Header.tsx', 'Toast.tsx', 'Portal.tsx'];

function sourceFiles(): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  for (const dir of ['src/components', 'src/pages']) {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.tsx')) continue;
      out.push({ name, text: readFileSync(join(dir, name), 'utf8') });
    }
  }
  return out;
}

describe('floating windows', () => {
  it('all go through Portal', () => {
    const offenders = sourceFiles()
      .filter(({ name }) => !APP_LEVEL.includes(name) && !SHELL.includes(name))
      .filter(({ text }) => /className=["{`][^"`]*\bfixed\b/.test(text))
      .filter(({ text }) => !text.includes("from '@/components/Portal'"))
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });

  it('the list of exemptions is real, so it cannot quietly grow', () => {
    const names = sourceFiles().map((f) => f.name);
    for (const exempt of [...APP_LEVEL, ...SHELL]) {
      expect(names).toContain(exempt);
    }
  });
});

/** A screen that animates itself in — which is what traps `fixed` children. */
function AnimatedScreen({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="pantalla" className="animate-fade-in-up">
      <p>una lista larguísima</p>
      {children}
    </div>
  );
}

describe('Portal', () => {
  it('puts its children outside the screen that rendered them', () => {
    render(
      <AnimatedScreen>
        <Portal>
          <span>flotante</span>
        </Portal>
      </AnimatedScreen>,
    );
    const hijo = screen.getByText('flotante');
    expect(screen.getByTestId('pantalla').contains(hijo)).toBe(false);
    expect(document.body.contains(hijo)).toBe(true);
  });
});

describe('FixedBottomBar', () => {
  it('escapes the animated screen', () => {
    render(
      <AnimatedScreen>
        <FixedBottomBar>
          <button>Eliminar 3 cliente(s)</button>
        </FixedBottomBar>
      </AnimatedScreen>,
    );
    const boton = screen.getByRole('button', { name: 'Eliminar 3 cliente(s)' });
    expect(screen.getByTestId('pantalla').contains(boton)).toBe(false);
  });
});

describe('ConfirmDialog', () => {
  it('escapes the animated screen, so it centres on the screen and not on the list', () => {
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
