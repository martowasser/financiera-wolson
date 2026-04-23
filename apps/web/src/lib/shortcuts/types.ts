export type ShortcutGroup = 'Global' | 'Navegación' | 'Acciones' | 'Pantalla' | string;

export type Shortcut = {
  id: string;
  keys: string[];
  label: string;
  group: ShortcutGroup;
  tentative?: boolean;
  run: () => void;
  when?: () => boolean;
};
