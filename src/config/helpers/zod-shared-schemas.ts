import { z } from 'zod';

export const nonEmptyStringSchema = z.string().trim().min(1);
export const nonNegativeIntegerSchema = z.number().int().nonnegative();
export const positiveFiniteNumberSchema = z.number().finite().positive();

// Validate that a string can be used as a JS RegExp pattern
export const regexLikeStringSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    regexPattern => {
      try {
        new RegExp(regexPattern);

        return true;
      } catch {
        return false;
      }
    },
    {
      message: 'Regex pattern must be a valid JavaScript RegExp pattern',
    }
  );

// Validate that a string can be used as JS RegExp flags
export const regexFlagsSchema = z.string().refine(
  regexFlags => {
    try {
      new RegExp('', regexFlags);

      return true;
    } catch {
      return false;
    }
  },
  {
    message: 'Regex flags must be valid JavaScript RegExp flags',
  }
);

export function buildVitalAnchorSchema() {
  const vitalAnchorMinLength = 3;

  return z.string().refine(anchorValue => anchorValue.trim().length >= vitalAnchorMinLength, {
    message: `Anchor must be at least ${vitalAnchorMinLength} chars after trim to make parsing more fragile`,
  });
}
