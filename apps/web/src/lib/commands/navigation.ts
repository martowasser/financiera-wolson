import type { PaletteCommand } from './types';

type Router = { push: (href: string) => void };

const NAV_ITEMS: { href: string; label: string; keywords?: string[] }[] = [
  { href: '/dashboard', label: 'Dashboard', keywords: ['inicio', 'home'] },
  { href: '/transactions', label: 'Movimientos', keywords: ['transacciones', 'asientos'] },
  { href: '/period', label: 'Cierre de Caja', keywords: ['cierre', 'periodo', 'caja'] },
  { href: '/entities?tab=sociedades', label: 'Sociedades', keywords: ['entidades', 'empresas'] },
  { href: '/entities?tab=personas', label: 'Personas', keywords: ['entidades', 'persona', 'financiera', 'tercero'] },
  { href: '/accounts', label: 'Cuentas', keywords: ['plan de cuentas', 'accounts'] },
  { href: '/properties', label: 'Propiedades', keywords: ['inmuebles'] },
  { href: '/leases', label: 'Contratos', keywords: ['alquileres', 'leases'] },
  { href: '/invoices', label: 'Cobro Alquileres', keywords: ['invoices', 'facturas', 'cobros'] },
  { href: '/settlements', label: 'Distribución a Socios', keywords: ['socios', 'distribucion', 'liquidacion'] },
  { href: '/reconciliation', label: 'Conciliación', keywords: ['reconciliacion', 'match'] },
];

export function navigationCommands(router: Router): PaletteCommand[] {
  return NAV_ITEMS.map((item) => ({
    id: `nav-${item.href}`,
    label: `Ir a ${item.label}`,
    group: 'Navegación',
    keywords: item.keywords,
    run: () => router.push(item.href),
  }));
}
