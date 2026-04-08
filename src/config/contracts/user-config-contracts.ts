import { z } from 'zod';
import {
  coreSettingsUserConfigSchema,
  ideToLlmUserConfigSchema,
  instructionUserConfigSchema,
  instructionsAndVariablesUserConfigSchema,
  llmCopypasterUserConfigBaseSchema,
  llmToIdeSanitizationRuleUserConfigSchema,
  llmToIdeUserConfigSchema,
  nonOverrideableSettingsUserConfigSchema,
  postFilePatchActionsUserConfigSchema,
  promptLimitsUserConfigSchema,
  vitalParsingAnchorsUserConfigSchema,
} from './config-descriptors';

export const overrideUserConfigSchema = z.object({
  description: z.string().optional(),
  version: z.string().optional(),
  shouldBeSkipped: z.boolean().optional(),
  coreSettings: coreSettingsUserConfigSchema.optional(),
});

export const llmCopypasterUserConfigSchema = z.object({
  nonOverrideableSettings: nonOverrideableSettingsUserConfigSchema.optional(),
  coreSettings: coreSettingsUserConfigSchema.optional(),
  overridesById: z.record(z.string(), overrideUserConfigSchema).optional(),
});

// The user contract is derived from the same descriptor-based source as the system config
export type LlmCopypasterUserConfig = z.infer<typeof llmCopypasterUserConfigSchema>;
export type NonOverrideableSettingsUserConfig = z.infer<typeof nonOverrideableSettingsUserConfigSchema>;
export type CoreSettingsUserConfig = z.infer<typeof coreSettingsUserConfigSchema>;
export type OverrideUserConfig = z.infer<typeof overrideUserConfigSchema>;
export type VitalParsingAnchorsUserConfig = z.infer<typeof vitalParsingAnchorsUserConfigSchema>;
export type IdeToLlmUserConfig = z.infer<typeof ideToLlmUserConfigSchema>;
export type LlmToIdeUserConfig = z.infer<typeof llmToIdeUserConfigSchema>;
export type PromptLimitsUserConfig = z.infer<typeof promptLimitsUserConfigSchema>;
export type PostFilePatchActionsUserConfig = z.infer<typeof postFilePatchActionsUserConfigSchema>;
export type InstructionsAndVariablesUserConfig = z.infer<typeof instructionsAndVariablesUserConfigSchema>;
export type LlmToIdeSanitizationRuleUserConfig = z.infer<typeof llmToIdeSanitizationRuleUserConfigSchema>;
export type InstructionUserConfig = z.infer<typeof instructionUserConfigSchema>;

// Keep this exported alias so other files can still consume the base user-shape if needed later
export type LlmCopypasterUserConfigBase = z.infer<typeof llmCopypasterUserConfigBaseSchema>;
