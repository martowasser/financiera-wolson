import { z } from 'zod';

// BigInt arrives in JSON as a string (since native JSON has no BigInt).
// Validate non-negative decimal-integer strings, transform to BigInt.
export const bigintString = z
  .string()
  .regex(/^-?\d+$/, 'must be an integer string')
  .transform((s) => BigInt(s));

// Same but rejects negative.
export const positiveBigintString = z
  .string()
  .regex(/^[1-9]\d*$/, 'must be a positive integer string')
  .transform((s) => BigInt(s));

export const nonNegativeBigintString = z
  .string()
  .regex(/^\d+$/, 'must be a non-negative integer string')
  .transform((s) => BigInt(s));
