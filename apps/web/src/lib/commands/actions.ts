import type { PaletteCommand } from './types';

type Router = { push: (href: string) => void };

export function actionCommands(router: Router): PaletteCommand[] {
  return [
    {
      id: 'action-new-movimiento',
      label: 'Nuevo Movimiento',
      group: 'Acciones',
      keywords: ['cobro', 'pago', 'gasto', 'transferencia', 'crear'],
      run: () => router.push('/movimientos?new=1'),
    },
    {
      id: 'action-new-cuenta',
      label: 'Nueva Cuenta',
      group: 'Acciones',
      keywords: ['cuenta corriente', 'socio', 'inquilino', 'crear'],
      run: () => router.push('/cuentas?new=1'),
    },
    {
      id: 'action-new-sociedad',
      label: 'Nueva Sociedad',
      group: 'Acciones',
      keywords: ['sociedad', 'empresa', 'crear'],
      run: () => router.push('/sociedades?new=1'),
    },
    {
      id: 'action-new-propiedad',
      label: 'Nueva Propiedad',
      group: 'Acciones',
      keywords: ['inmueble', 'crear'],
      run: () => router.push('/propiedades?new=1'),
    },
    {
      id: 'action-new-contrato',
      label: 'Nuevo Contrato',
      group: 'Acciones',
      keywords: ['alquiler', 'crear'],
      run: () => router.push('/contratos?new=1'),
    },
    {
      id: 'action-cerrar-caja',
      label: 'Cerrar Caja',
      group: 'Acciones',
      keywords: ['cierre', 'dia'],
      run: () => router.push('/caja'),
    },
  ];
}
