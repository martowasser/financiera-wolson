import { z } from 'zod';
import { nullishString } from '../../lib/zod-helpers.js';

export const createCuentaSchema = z.object({
  name: z.string().min(1).max(200),
  identifier: nullishString.pipe(z.string().min(1).max(50).optional()),
  notes: nullishString,
  isOwner: z.boolean().optional(),
});

export const updateCuentaSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  identifier: nullishString.pipe(z.string().min(1).max(50).optional()),
  notes: nullishString,
  isActive: z.boolean().optional(),
  isOwner: z.boolean().optional(),
});

export const listCuentasQuerySchema = z.object({
  q: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
});

export type CreateCuentaInput = z.infer<typeof createCuentaSchema>;
export type UpdateCuentaInput = z.infer<typeof updateCuentaSchema>;
