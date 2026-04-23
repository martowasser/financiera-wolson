'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { isTypingTarget } from './is-typing-target';
import type { Shortcut } from './types';
import { formatKey } from './format-keys';

const CHORD_TIMEOUT_MS = 1500;

type ShortcutContextValue = {
  register: (shortcut: Shortcut) => () => void;
  getAll: () => Shortcut[];
  subscribe: (fn: () => void) => () => void;
};

const ShortcutContext = createContext<ShortcutContextValue | null>(null);

function tokenFromEvent(event: KeyboardEvent): string | null {
  if (event.key === 'Meta' || event.key === 'Control' || event.key === 'Shift' || event.key === 'Alt') {
    return null;
  }
  if (event.metaKey || event.ctrlKey) {
    return `meta+${event.key.toLowerCase()}`;
  }
  const k = event.key;
  return k.length === 1 ? k.toLowerCase() : k;
}

export function ShortcutProvider({ children }: { children: ReactNode }) {
  const registry = useRef<Map<string, Shortcut>>(new Map());
  const listeners = useRef<Set<() => void>>(new Set());
  const chordPrefixRef = useRef<string | null>(null);
  const chordTimerRef = useRef<number | null>(null);
  const [chordHint, setChordHint] = useState<string | null>(null);

  const notify = useCallback(() => {
    listeners.current.forEach((fn) => fn());
  }, []);

  const register = useCallback(
    (shortcut: Shortcut) => {
      registry.current.set(shortcut.id, shortcut);
      notify();
      return () => {
        registry.current.delete(shortcut.id);
        notify();
      };
    },
    [notify],
  );

  const getAll = useCallback(() => Array.from(registry.current.values()), []);

  const subscribe = useCallback((fn: () => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const clearChord = useCallback(() => {
    chordPrefixRef.current = null;
    if (chordTimerRef.current !== null) {
      window.clearTimeout(chordTimerRef.current);
      chordTimerRef.current = null;
    }
    setChordHint(null);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;

      const token = tokenFromEvent(event);
      if (!token) return;

      const isMetaCombo = token.startsWith('meta+');
      if (!isMetaCombo && isTypingTarget(event.target)) return;

      const shortcuts = Array.from(registry.current.values()).filter(
        (s) => !s.when || s.when(),
      );

      const prefix = chordPrefixRef.current;

      if (prefix) {
        const match = shortcuts.find(
          (s) => s.keys.length === 2 && s.keys[0] === prefix && s.keys[1] === token,
        );
        clearChord();
        if (match) {
          event.preventDefault();
          match.run();
        }
        return;
      }

      const singleMatch = shortcuts.find((s) => s.keys.length === 1 && s.keys[0] === token);
      const chordLeader = shortcuts.find((s) => s.keys.length === 2 && s.keys[0] === token);

      if (chordLeader) {
        event.preventDefault();
        chordPrefixRef.current = token;
        setChordHint(formatKey(token));
        chordTimerRef.current = window.setTimeout(() => {
          clearChord();
        }, CHORD_TIMEOUT_MS);
        return;
      }

      if (singleMatch) {
        event.preventDefault();
        singleMatch.run();
      }
    }

    function onBlur() {
      clearChord();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
      if (chordTimerRef.current !== null) window.clearTimeout(chordTimerRef.current);
    };
  }, [clearChord]);

  const value = useMemo<ShortcutContextValue>(
    () => ({ register, getAll, subscribe }),
    [register, getAll, subscribe],
  );

  return (
    <ShortcutContext value={value}>
      {children}
      {chordHint && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-full bg-popover px-3 py-1.5 text-sm shadow-md border">
          <span className="font-mono font-medium">{chordHint}</span>
          <span className="text-muted-foreground"> + …</span>
        </div>
      )}
    </ShortcutContext>
  );
}

export function useShortcutRegistry() {
  const ctx = useContext(ShortcutContext);
  if (!ctx) throw new Error('useShortcutRegistry must be used within ShortcutProvider');
  return ctx;
}
