// Spanish labels for all enums used across the system.
// Single source of truth — import from here instead of defining local maps.

export const transactionTypeLabels: Record<string, string> = {
  INCOME: 'Ingreso',
  EXPENSE: 'Gasto',
  TRANSFER: 'Transferencia',
  BANK_FEE: 'Gasto Bancario',
  REVERSAL: 'Anulacion',
  ADJUSTMENT: 'Ajuste',
};

export const transactionStatusLabels: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  REVERSED: 'Anulada',
};

export const accountTypeLabels: Record<string, string> = {
  CASH: 'Efectivo',
  BANK: 'Banco',
  RECEIVABLE: 'Cobrar',
  PAYABLE: 'Pagar',
  EQUITY: 'Patrimonio',
  REVENUE: 'Ingreso',
  EXPENSE: 'Gasto',
};

export const entityTypeLabels: Record<string, string> = {
  COMPANY: 'Sociedad',
  PERSON: 'Persona',
  FIRM: 'Empresa',
  THIRD_PARTY: 'Tercero',
};

export const propertyTypeLabels: Record<string, string> = {
  APARTMENT: 'Departamento',
  COMMERCIAL: 'Comercial',
  OFFICE: 'Oficina',
  PARKING: 'Cochera',
  WAREHOUSE: 'Deposito',
  LAND: 'Terreno',
  OTHER: 'Otro',
};

export const invoiceStatusLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  PAID: 'Cobrado',
  PARTIAL: 'Parcial',
  CANCELLED: 'Cancelado',
};

export const settlementStatusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  APPROVED: 'Aprobada',
  DISTRIBUTED: 'Distribuida',
};

export const reconciliationStatusLabels: Record<string, string> = {
  IN_PROGRESS: 'En Progreso',
  COMPLETED: 'Completa',
  DISCREPANCY: 'Discrepancia',
};

export const entryTypeLabels: Record<string, string> = {
  DEBIT: 'Debito',
  CREDIT: 'Credito',
};

export const paymentMethodLabels: Record<string, string> = {
  CASH: 'Efectivo',
  BANK_TRANSFER: 'Transferencia',
  CHECK: 'Cheque',
};

export const userRoleLabels: Record<string, string> = {
  ADMIN: 'Administrador',
  OPERATOR: 'Operador',
  VIEWER: 'Visualizador',
};

export const periodStatusLabels: Record<string, string> = {
  OPEN: 'Abierto',
  CLOSED: 'Cerrado',
};

export const leaseManagedByLabels: Record<string, string> = {
  DIRECT: 'Directo',
  THIRD_PARTY: 'Rendido por tercero',
};

export const normalBalanceLabels: Record<string, string> = {
  DEBIT: 'Debito',
  CREDIT: 'Credito',
};

/** Generic label lookup — returns the Spanish label or the raw value as fallback. */
export function label(map: Record<string, string>, value: string | null | undefined, fallback = '-'): string {
  if (value == null) return fallback;
  return map[value] ?? value;
}
