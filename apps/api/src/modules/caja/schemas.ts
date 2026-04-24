import { z } from 'zod';
import { nullishString } from '../../lib/zod-helpers.js';

// YYYY-MM-DD used for @db.Date path params; reject anything else at the edge so
// downstream code can rely on a clean UTC-midnight Date.
export const fechaParamSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe tener formato YYYY-MM-DD');

export const listCajasQuerySchema = z.object({
  from: fechaParamSchema.optional(),
  to: fechaParamSchema.optional(),
});

export const cerrarCajaSchema = z.object({
  notes: nullishString,
});

export type ListCajasQuery = z.infer<typeof listCajasQuerySchema>;
export type CerrarCajaInput = z.infer<typeof cerrarCajaSchema>;
