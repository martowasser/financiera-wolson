'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CommandPalette } from './command-palette';
import { useKeyboardShortcuts } from '@/lib/shortcuts/use-keyboard-shortcuts';
import { navigationCommands } from '@/lib/commands/navigation';
import { actionCommands } from '@/lib/commands/actions';
import { usePaletteData } from '@/lib/commands/use-palette-data';
import type { PaletteCommand } from '@/lib/commands/types';
import type { Shortcut } from '@/lib/shortcuts/types';

type CommandPaletteContextValue = {
  open: () => void;
  close: () => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const dataCommands = usePaletteData(isOpen);
  const commands: PaletteCommand[] = useMemo(
    () => [...actionCommands(router), ...navigationCommands(router), ...dataCommands],
    [router, dataCommands],
  );

  const navChordShortcuts: Shortcut[] = useMemo(() => {
    const chords: { keys: [string, string]; href: string; label: string; tentative?: boolean }[] = [
      { keys: ['g', 'd'], href: '/dashboard',   label: 'Ir a Resumen' },
      { keys: ['g', 'm'], href: '/movimientos', label: 'Ir a Movimientos' },
      { keys: ['g', 'c'], href: '/caja',        label: 'Ir a Caja' },
      { keys: ['g', 's'], href: '/sociedades',  label: 'Ir a Sociedades' },
      { keys: ['g', 'u'], href: '/cuentas',     label: 'Ir a Cuentas' },
      { keys: ['g', 'p'], href: '/propiedades', label: 'Ir a Propiedades' },
      { keys: ['g', 'r'], href: '/alquileres',  label: 'Ir a Alquileres' },
    ];
    return chords.map((c) => ({
      id: `chord-${c.keys.join('-')}`,
      keys: c.keys,
      label: c.label,
      group: 'Navegación',
      tentative: c.tentative,
      run: () => router.push(c.href),
    }));
  }, [router]);

  const globalShortcuts: Shortcut[] = useMemo(
    () => [
      {
        id: 'global-palette',
        keys: ['meta+k'],
        label: 'Abrir paleta de comandos',
        group: 'Global',
        run: () => setIsOpen((v) => !v),
      },
      ...navChordShortcuts,
    ],
    [navChordShortcuts],
  );

  useKeyboardShortcuts(globalShortcuts);

  const value = useMemo<CommandPaletteContextValue>(() => ({ open, close }), [open, close]);

  return (
    <CommandPaletteContext value={value}>
      {children}
      <CommandPalette open={isOpen} onOpenChange={setIsOpen} commands={commands} />
    </CommandPaletteContext>
  );
}

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error('useCommandPalette must be used within CommandPaletteProvider');
  return ctx;
}
