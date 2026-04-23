import type { ReactNode } from 'react';

export type PaletteCommand = {
  id: string;
  label: string;
  group: string;
  hint?: string;
  icon?: ReactNode;
  keywords?: string[];
  run: () => void;
};
