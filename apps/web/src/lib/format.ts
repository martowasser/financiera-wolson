// Montos come from API as numbers (BigInt serialized).
// They represent centavos. Display as pesos/dollars with 2 decimals + thousands separator.

export function formatMoney(centavos: number | string | bigint, currency?: string): string {
  const num = Number(centavos) / 100;
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);

  if (currency === 'USD') return `US$ ${formatted}`;
  if (currency === 'ARS') return `$ ${formatted}`;
  return formatted;
}

export function formatMoneyRaw(centavos: number | string | bigint): number {
  return Number(centavos) / 100;
}

export function centavosToInput(centavos: number | string | bigint): string {
  return (Number(centavos) / 100).toFixed(2);
}

export function inputToCentavos(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return '0';
  return Math.round(num * 100).toString();
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}
