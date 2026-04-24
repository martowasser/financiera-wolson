import { z } from 'zod';
import { nullishString } from '../../lib/zod-helpers.js';

export const createBancoSchema = z.object({
  sociedadId: z.string().min(1),
  nombre: z.string().min(1).max(200),
  numero: z.string().min(1).max(50),
  notes: nullishString,
});

export const updateBancoSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  numero: z.string().min(1).max(50).optional(),
  notes: nullishString,
});

export const listBancosQuerySchema = z.object({
  sociedadId: z.string().optional(),
  q: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
});

export type CreateBancoInput = z.infer<typeof createBancoSchema>;
export type UpdateBancoInput = z.infer<typeof updateBancoSchema>;
