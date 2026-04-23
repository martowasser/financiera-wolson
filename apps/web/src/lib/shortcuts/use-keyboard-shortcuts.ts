'use client';

import { useEffect, useState } from 'react';
import { useShortcutRegistry } from './shortcut-context';
import type { Shortcut } from './types';

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const { register } = useShortcutRegistry();

  useEffect(() => {
    const unregisters = shortcuts.map((s) => register(s));
    return () => {
      unregisters.forEach((u) => u());
    };
  }, [register, shortcuts]);
}

export function useActiveShortcuts(): Shortcut[] {
  const { getAll, subscribe } = useShortcutRegistry();
  const [, setTick] = useState(0);

  useEffect(() => subscribe(() => setTick((t) => t + 1)), [subscribe]);

  return getAll();
}
