// Spanish labels for all enums used across the system.

export const movimientoTipoLabels: Record<string, string> = {
  ALQUILER_COBRO:    'Cobro de alquiler',
  GASTO:             'Gasto',
  GASTO_SOCIEDAD:    'Gasto de sociedad',
  GASTO_PROPIEDAD:   'Gasto de propiedad',
  INGRESO_VARIO:     'Ingreso vario',
  TRANSFERENCIA:     'Transferencia',
  COMISION_BANCARIA: 'Comisión bancaria',
  DEBITO_AUTOMATICO: 'Débito automático',
  RECUPERO:          'Recupero',
  AJUSTE:            'Ajuste',
  OTRO:              'Otro',
  REPARTO_SOCIO:     'Reparto a socio',
};

export const bucketLabels: Record<string, string> = {
  CAJA:             'Caja',
  BANCO:            'Banco',
  CUENTA_CORRIENTE: 'Cuenta corriente',
};

export const alquilerStatusLabels: Record<string, string> = {
  ACTIVO:     'Activo',
  FINALIZADO: 'Finalizado',
};

export const cajaStatusLabels: Record<string, string> = {
  OPEN:   'Abierta',
  CLOSED: 'Cerrada',
};

export const monedaLabels: Record<string, string> = {
  ARS: 'Pesos',
  USD: 'Dólares',
};

export const userRoleLabels: Record<string, string> = {
  ADMIN:  'Administrador',
  VIEWER: 'Visualizador',
};

export const estadoDelMesLabels: Record<string, string> = {
  AL_DIA:        'Al día',
  SIN_FACTURAR:  'Sin facturar',
  PENDIENTE:     'Pendiente',
  NO_APLICA:     '—',
};

/** Generic label lookup — returns the Spanish label or the raw value as fallback. */
export function label(map: Record<string, string>, value: string | null | undefined, fallback = '-'): string {
  if (value == null) return fallback;
  return map[value] ?? value;
}
