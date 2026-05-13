import { z } from 'zod';
import { nullishString } from '../../lib/zod-helpers.js';
import { bigintString } from '../../lib/bigint.js';

const monedaSchema = z.enum(['ARS', 'USD']);

const socioInputSchema = z.object({
  cuentaId: z.string(),
  percentBps: z.number().int().min(0).max(10000),
});

// ISO date string (YYYY-MM-DD or full ISO); Postgres @db.Date truncates to day.
const isoDateString = z.string().min(1);

export const createAlquilerSchema = z.object({
  propiedadId: z.string(),
  inquilinoId: z.string(),
  monto: bigintString,
  moneda: monedaSchema,
  fechaInicio: isoDateString,
  fechaFin: isoDateString.optional(),
  notes: nullishString,
  socios: z.array(socioInputSchema).optional(),
});

export const updateAlquilerSchema = z.object({
  monto: bigintString.optional(),
  moneda: monedaSchema.optional(),
  fechaInicio: isoDateString.optional(),
  fechaFin: isoDateString.nullish(),
  notes: nullishString,
});

export const replaceAlquilerSociosSchema = z.object({
  socios: z.array(socioInputSchema),
});

export const finalizarAlquilerSchema = z.object({
  finalizadoEn: isoDateString,
  motivoFinalizacion: z.string().min(1),
});

export const listAlquileresQuerySchema = z.object({
  status: z.enum(['ACTIVO', 'FINALIZADO']).optional(),
  propiedadId: z.string().optional(),
  inquilinoId: z.string().optional(),
  sociedadId: z.string().optional(),
  q: z.string().optional(),
  showArchived: z.enum(['true', 'false']).optional(),
});

export const numeroParamSchema = z.object({
  numero: z.string().regex(/^\d+$/, 'must be an integer').transform((s) => parseInt(s, 10)),
});

export type CreateAlquilerInput = z.infer<typeof createAlquilerSchema>;
export type UpdateAlquilerInput = z.infer<typeof updateAlquilerSchema>;
export type ReplaceAlquilerSociosInput = z.infer<typeof replaceAlquilerSociosSchema>;
export type FinalizarAlquilerInput = z.infer<typeof finalizarAlquilerSchema>;
export type ListAlquileresQuery = z.infer<typeof listAlquileresQuerySchema>;
