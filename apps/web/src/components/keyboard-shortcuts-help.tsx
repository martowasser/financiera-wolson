'use client';

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useActiveShortcuts, useKeyboardShortcuts } from '@/lib/shortcuts/use-keyboard-shortcuts';
import { formatKeys } from '@/lib/shortcuts/format-keys';
import type { Shortcut } from '@/lib/shortcuts/types';

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const shortcuts = useActiveShortcuts();

  const helpShortcuts = useMemo<Shortcut[]>(
    () => [
      {
        id: 'global-help',
        keys: ['?'],
        label: 'Mostrar atajos',
        group: 'Global',
        run: () => setOpen((v) => !v),
      },
    ],
    [],
  );
  useKeyboardShortcuts(helpShortcuts);

  const grouped = useMemo(() => {
    const map = new Map<string, Shortcut[]>();
    for (const s of shortcuts) {
      const list = map.get(s.group) ?? [];
      list.push(s);
      map.set(s.group, list);
    }
    const preferredOrder = ['Global', 'Navegación', 'Acciones', 'Movimientos', 'Sociedades', 'Cierre de Caja'];
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ai = preferredOrder.indexOf(a);
      const bi = preferredOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [shortcuts]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Atajos de teclado</DialogTitle>
          <DialogDescription>Presioná <kbd className="rounded bg-muted px-1 font-mono text-xs">?</kbd> en cualquier momento para ver los atajos de la pantalla actual.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1">
          {grouped.map(([group, items]) => (
            <div key={group}>
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">{group}</h3>
              <ul className="space-y-1">
                {items.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-sm">
                    <span>
                      {s.label}
                      {s.tentative && (
                        <span className="ml-2 text-xs text-muted-foreground italic">(tentativo)</span>
                      )}
                    </span>
                    <kbd className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{formatKeys(s.keys)}</kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
