import { z } from 'zod';

// ─── Auth ────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'VIEWER']),
});
