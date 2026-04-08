import { z } from 'zod';

export const nonEmptyStringSchema = z.string().trim().min(1);
export const nonNegativeIntegerSchema = z.number().int().nonnegative();
export const positiveFiniteNumberSchema = z.number().finite().positive();

export function buildVitalAnchorSchema() {
  const vitalAnchorMinLength = 3;

  return z.string().refine(anchorValue => anchorValue.trim().length >= vitalAnchorMinLength, {
    message: `Anchor must be at least ${vitalAnchorMinLength} chars after trim to make parsing more fragile`,
  });
}
