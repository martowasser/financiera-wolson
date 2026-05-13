import { z } from 'zod';
import { nullishString } from '../../lib/zod-helpers.js';

const socioInputSchema = z.object({
  cuentaId: z.string(),
  percentBps: z.number().int().min(0).max(10000),
});

export const createSociedadSchema = z.object({
  name: z.string().min(1).max(200),
  notes: nullishString,
  socios: z.array(socioInputSchema).optional(),
});

export const updateSociedadSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  notes: nullishString,
  isActive: z.boolean().optional(),
});

export const replaceSociosSchema = z.object({
  socios: z.array(socioInputSchema),
});

export const listSociedadesQuerySchema = z.object({
  q: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
  showArchived: z.enum(['true', 'false']).optional(),
  includeSocios: z.enum(['true', 'false']).optional(),
  includeBanco: z.enum(['true', 'false']).optional(),
  includePropiedades: z.enum(['true', 'false']).optional(),
});

export type CreateSociedadInput = z.infer<typeof createSociedadSchema>;
export type UpdateSociedadInput = z.infer<typeof updateSociedadSchema>;
export type ReplaceSociosInput = z.infer<typeof replaceSociosSchema>;
