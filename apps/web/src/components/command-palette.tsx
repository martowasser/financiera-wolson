'use client';

import { useMemo } from 'react';
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '@/components/ui/command';
import type { PaletteCommand } from '@/lib/commands/types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: PaletteCommand[];
};

export function CommandPalette({ open, onOpenChange, commands }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, PaletteCommand[]>();
    for (const cmd of commands) {
      const list = map.get(cmd.group) ?? [];
      list.push(cmd);
      map.set(cmd.group, list);
    }
    return Array.from(map.entries());
  }, [commands]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Buscar o ejecutar" description="Escribí para buscar o usar una acción">
      <Command>
        <CommandInput placeholder="Buscar o ejecutar..." />
        <CommandList>
          <CommandEmpty>Sin resultados.</CommandEmpty>
          {grouped.map(([group, items]) => (
            <CommandGroup key={group} heading={group}>
              {items.map((cmd) => (
                <CommandItem
                  key={cmd.id}
                  value={`${cmd.label} ${(cmd.keywords ?? []).join(' ')}`}
                  onSelect={() => {
                    onOpenChange(false);
                    cmd.run();
                  }}
                >
                  {cmd.icon}
                  <span>{cmd.label}</span>
                  {cmd.hint && <CommandShortcut>{cmd.hint}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
