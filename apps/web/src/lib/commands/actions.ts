import type { PaletteCommand } from './types';

type Router = { push: (href: string) => void };

export function actionCommands(router: Router): PaletteCommand[] {
  return [
    {
      id: 'action-new-transaction',
      label: 'Nuevo Movimiento',
      group: 'Acciones',
      keywords: ['transaccion', 'asiento', 'crear'],
      hint: 'C',
      run: () => router.push('/transactions?new=1'),
    },
    {
      id: 'action-new-sociedad',
      label: 'Nueva Sociedad',
      group: 'Acciones',
      keywords: ['sociedad', 'empresa', 'crear'],
      hint: 'C',
      run: () => router.push('/entities?tab=sociedades&new=1'),
    },
    {
      id: 'action-new-persona',
      label: 'Nueva Persona',
      group: 'Acciones',
      keywords: ['persona', 'financiera', 'tercero', 'crear'],
      hint: 'C',
      run: () => router.push('/entities?tab=personas&new=1'),
    },
    {
      id: 'action-close-period',
      label: 'Cerrar Caja',
      group: 'Acciones',
      keywords: ['cierre', 'periodo', 'cerrar'],
      run: () => router.push('/period'),
    },
  ];
}
