import { z } from 'zod';
import { nullishString } from '../../lib/zod-helpers.js';

export const createPropiedadSchema = z.object({
  sociedadId: z.string().min(1),
  nombre: z.string().min(1).max(200),
  direccion: z.string().min(1).max(300),
  descripcion: nullishString,
  notes: nullishString,
});

export const updatePropiedadSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  direccion: z.string().min(1).max(300).optional(),
  descripcion: nullishString,
  notes: nullishString,
  isActive: z.boolean().optional(),
});

export const listPropiedadesQuerySchema = z.object({
  sociedadId: z.string().optional(),
  q: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
});

export type CreatePropiedadInput = z.infer<typeof createPropiedadSchema>;
export type UpdatePropiedadInput = z.infer<typeof updatePropiedadSchema>;
export type ListPropiedadesQuery = z.infer<typeof listPropiedadesQuerySchema>;
