import { z } from 'zod';

/**
 * Optional string that accepts null, undefined, or string from input.
 * Normalizes null → undefined so downstream service signatures typed as
 * `field?: string` keep working without changes.
 *
 * Prefer over `z.string().optional()` in REQUEST BODY schemas — forms
 * commonly serialize empty fields as `null`, which `.optional()` rejects.
 * For URL query params, either works.
 */
export const nullishString = z.string().nullish().transform((v) => v ?? undefined);
