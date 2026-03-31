import { z } from 'zod';

export const vitalAnchorMinLength = 3;

export function buildVitalAnchorSchema(): z.ZodEffects<z.ZodString, string, string> {
  return z.string().refine(anchorValue => anchorValue.trim().length >= vitalAnchorMinLength, {
    message: `Anchor must be at least ${vitalAnchorMinLength} chars after trim to make parsing more fragile`,
  });
}

export function buildNullableVitalAnchorSchema(): z.ZodNullable<z.ZodEffects<z.ZodString, string, string>> {
  return buildVitalAnchorSchema().nullable();
}
