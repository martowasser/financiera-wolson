import type { PaletteCommand } from './types';

type Router = { push: (href: string) => void };

const NAV_ITEMS: { href: string; label: string; keywords?: string[] }[] = [
  { href: '/dashboard',   label: 'Dashboard',    keywords: ['inicio', 'home'] },
  { href: '/cuentas',     label: 'Cuentas',      keywords: ['cuenta corriente', 'socios', 'inquilinos'] },
  { href: '/sociedades',  label: 'Sociedades',   keywords: ['empresas', 'da', 'mr'] },
  { href: '/propiedades', label: 'Propiedades',  keywords: ['inmuebles', 'propiedad'] },
  { href: '/contratos',   label: 'Contratos',    keywords: ['alquileres', 'leases'] },
  { href: '/caja',        label: 'Caja',         keywords: ['cierre', 'efectivo', 'dia'] },
  { href: '/movimientos', label: 'Movimientos',  keywords: ['transacciones', 'asientos', 'cobros', 'pagos'] },
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
