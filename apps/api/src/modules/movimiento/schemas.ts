import { z } from 'zod';
import { nullishString } from '../../lib/zod-helpers.js';
import { positiveBigintString } from '../../lib/bigint.js';

const monedaEnum = z.enum(['ARS', 'USD']);
const bucketEnum = z.enum(['CAJA', 'BANCO', 'CUENTA_CORRIENTE']);

export const movimientoTipoEnum = z.enum([
  'ALQUILER_COBRO',
  'GASTO',
  'GASTO_SOCIEDAD',
  'GASTO_PROPIEDAD',
  'INGRESO_VARIO',
  'TRANSFERENCIA',
  'COMISION_BANCARIA',
  'DEBITO_AUTOMATICO',
  'RECUPERO',
  'AJUSTE',
  'OTRO',
  // Fila hija generada al repartir un mov que toca BANCO. No se pasa en createMovimiento.
  'REPARTO_SOCIO',
]);

const repartoEntrySchema = z.object({
  cuentaId: z.string(),
  monto: positiveBigintString,
});
export type RepartoEntry = z.infer<typeof repartoEntrySchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha must be YYYY-MM-DD');

// One unified create schema. Per-tipo rules are enforced in the service so we
// don't need 12 zod variants — validation errors still come back with codes.
export const createMovimientoSchema = z.object({
  fecha: isoDate,
  tipo: movimientoTipoEnum,
  monto: positiveBigintString,
  moneda: monedaEnum,

  origenBucket: bucketEnum.optional(),
  origenBancoId: z.string().optional(),
  origenCuentaId: z.string().optional(),

  destinoBucket: bucketEnum.optional(),
  destinoBancoId: z.string().optional(),
  destinoCuentaId: z.string().optional(),

  sociedadId: z.string().optional(),
  propiedadId: z.string().optional(),
  alquilerId: z.string().optional(),
  cuentaContraparteId: z.string().optional(),

  comprobante: nullishString,
  facturado: z.boolean().optional(),
  notes: nullishString,

  // Reparto a CC de socios. Cuando un mov toca BANCO (origen o destino) y no es
  // ALQUILER_COBRO (que se reparte siempre por alquiler.socios automáticamente),
  // se usa este array para distribuir el monto entre cuentas. Default si se
  // omite: socios de la sociedad del banco prorrateados por percentBps.
  repartoSocios: z.array(repartoEntrySchema).optional(),
});

export const updateMovimientoSchema = z.object({
  notes: nullishString,
  comprobante: nullishString,
  facturado: z.boolean().optional(),
});

export const reversarSchema = z.object({
  motivo: z.string().min(1).max(500),
});

export const listMovimientosQuerySchema = z.object({
  fecha: isoDate.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  sociedadId: z.string().optional(),
  propiedadId: z.string().optional(),
  alquilerId: z.string().optional(),
  bancoId: z.string().optional(),
  cuentaId: z.string().optional(),
  tipo: movimientoTipoEnum.optional(),
  moneda: monedaEnum.optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional(),
});

export type CreateMovimientoInput = z.infer<typeof createMovimientoSchema>;
export type UpdateMovimientoInput = z.infer<typeof updateMovimientoSchema>;
