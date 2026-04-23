const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

export function formatKey(token: string): string {
  if (token.startsWith('meta+')) {
    return `${MOD}${token.slice(5).toUpperCase()}`;
  }
  if (token.length === 1) return token.toUpperCase();
  return token;
}

export function formatKeys(keys: string[]): string {
  return keys.map(formatKey).join(' then ');
}
