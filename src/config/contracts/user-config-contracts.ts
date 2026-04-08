import { z } from 'zod';
import {
  buildVitalAnchorSchema,
  nonEmptyStringSchema,
  nonNegativeIntegerSchema,
  positiveFiniteNumberSchema,
} from '../helpers/zod-shared-schemas';

// This file intentionally keeps user-config Zod schema isolated from system-config Zod schema
// User config has patch semantics, so every field here must stay explicitly `.optional()`
// Building user schema by traversing system schema and making everything optional is possible, but too clever and brittle
// Isolation is simpler to maintain, and it also leaves room for user-config field names/types to diverge from system-config in the future
// Plus user-config has additional presets section, which system-config doesn't have

// ! After changing zod-schema run manually "npm run compile", which will trigger "postcompile" → "node ./scripts/generate-json-schema.js"

export interface UserConfig {
  presetIndependentSettings?: PresetIndependentSettingsUserConfig;
  presetDependentSettings?: PresetDependentSettingsUserConfig;
  presetsById?: Record<string, PresetUserConfig>;
}

// ! this userConfigSchema + path is hardcoded in "generate-json-schema.js", so be careful, auto-rename won't work!
export const userConfigSchema = z.object({
  presetIndependentSettings: z.lazy(() => presetIndependentSettingsUserConfigSchema).optional(),
  presetDependentSettings: z.lazy(() => presetDependentSettingsUserConfigSchema).optional(),
  presetsById: z
    .record(
      z.string(),
      z.lazy(() => presetUserConfigSchema)
    )
    .optional(),
}) satisfies z.ZodType<UserConfig>;

export interface PresetIndependentSettingsUserConfig {
  allowOutsideWorkspaceRead?: boolean;
  allowOutsideWorkspaceWrite?: boolean;
  vitalParsingAnchors?: VitalParsingAnchorsUserConfig;
  notificationSettings?: NotificationSettingsUserConfig;
}

export const presetIndependentSettingsUserConfigSchema = z.object({
  allowOutsideWorkspaceRead: z.boolean().optional(),
  allowOutsideWorkspaceWrite: z.boolean().optional(),
  vitalParsingAnchors: z.lazy(() => vitalParsingAnchorsUserConfigSchema).optional(),
  notificationSettings: z.lazy(() => notificationSettingsUserConfigSchema).optional(),
}) satisfies z.ZodType<PresetIndependentSettingsUserConfig>;

export interface VitalParsingAnchorsUserConfig {
  PROMPT_DELIMITER_ANCHOR?: string;
  CODE_LISTING_HEADER_ANCHOR?: string;
  FILE_STATUS_ANCHOR?: string;
  FILE_EDITED_FULL_ANCHOR?: string;
  FILE_CREATED_ANCHOR?: string;
  FILE_DELETED_ANCHOR?: string;
  END_OF_OUTPUT_ANCHOR?: string | null;
}

export const vitalParsingAnchorsUserConfigSchema = z.object({
  PROMPT_DELIMITER_ANCHOR: buildVitalAnchorSchema().optional(),
  CODE_LISTING_HEADER_ANCHOR: buildVitalAnchorSchema().optional(),
  FILE_STATUS_ANCHOR: buildVitalAnchorSchema().optional(),
  FILE_EDITED_FULL_ANCHOR: buildVitalAnchorSchema().optional(),
  FILE_CREATED_ANCHOR: buildVitalAnchorSchema().optional(),
  FILE_DELETED_ANCHOR: buildVitalAnchorSchema().optional(),
  END_OF_OUTPUT_ANCHOR: buildVitalAnchorSchema().nullable().optional(),
}) satisfies z.ZodType<VitalParsingAnchorsUserConfig>;

export interface NotificationSettingsUserConfig {
  configValidation?: ConfigValidationNotificationSettingsUserConfig;
}

export const notificationSettingsUserConfigSchema = z.object({
  configValidation: z.lazy(() => configValidationNotificationSettingsUserConfigSchema).optional(),
}) satisfies z.ZodType<NotificationSettingsUserConfig>;

export interface ConfigValidationNotificationSettingsUserConfig {
  suppressWarningIssuesToast?: boolean;
  suppressRecommendationIssuesToast?: boolean;
  suppressNoIssuesToast?: boolean;
}

export const configValidationNotificationSettingsUserConfigSchema = z.object({
  suppressWarningIssuesToast: z.boolean().optional(),
  suppressRecommendationIssuesToast: z.boolean().optional(),
  suppressNoIssuesToast: z.boolean().optional(),
}) satisfies z.ZodType<ConfigValidationNotificationSettingsUserConfig>;

export interface PresetDependentSettingsUserConfig {
  skipInstructions?: boolean;
  skipCodeListings?: boolean;
  ideToLlm?: IdeToLlmUserConfig;
  llmToIde?: LlmToIdeUserConfig;
  postFilePatchActions?: PostFilePatchActionsUserConfig;
  instructionsAndVariables?: InstructionsAndVariablesUserConfig;
  llmToIdeSanitizationRulesById?: Record<string, LlmToIdeSanitizationRuleUserConfig>;
}

export const presetDependentSettingsUserConfigSchema = z.object({
  skipInstructions: z.boolean().optional(),
  skipCodeListings: z.boolean().optional(),
  ideToLlm: z.lazy(() => ideToLlmUserConfigSchema).optional(),
  llmToIde: z.lazy(() => llmToIdeUserConfigSchema).optional(),
  postFilePatchActions: z.lazy(() => postFilePatchActionsUserConfigSchema).optional(),
  instructionsAndVariables: z.lazy(() => instructionsAndVariablesUserConfigSchema).optional(),
  llmToIdeSanitizationRulesById: z
    .record(
      z.string(),
      z.lazy(() => llmToIdeSanitizationRuleUserConfigSchema)
    )
    .optional(),
}) satisfies z.ZodType<PresetDependentSettingsUserConfig>;

export interface PromptLimitsUserConfig {
  skipPromptSizeStatsInCopyNotification?: boolean;
  charsPerToken?: number;
  linesMaxToShowWarning?: number;
  tokensMaxToShowWarning?: number;
}

export const promptLimitsUserConfigSchema = z.object({
  skipPromptSizeStatsInCopyNotification: z.boolean().optional(),
  charsPerToken: positiveFiniteNumberSchema.optional(),
  linesMaxToShowWarning: nonNegativeIntegerSchema.optional(),
  tokensMaxToShowWarning: nonNegativeIntegerSchema.optional(),
}) satisfies z.ZodType<PromptLimitsUserConfig>;

export interface IdeToLlmUserConfig extends PromptLimitsUserConfig {}

export const ideToLlmUserConfigSchema = promptLimitsUserConfigSchema satisfies z.ZodType<IdeToLlmUserConfig>;

export interface LlmToIdeUserConfig extends PromptLimitsUserConfig {}

export const llmToIdeUserConfigSchema = promptLimitsUserConfigSchema satisfies z.ZodType<LlmToIdeUserConfig>;

export interface PostFilePatchActionsUserConfig {
  enableSaveAfterFilePatch?: boolean;
  enableLintingAfterFilePatch?: boolean;
  enableOpeningPatchedFilesInEditor?: boolean;
}

export const postFilePatchActionsUserConfigSchema = z.object({
  enableSaveAfterFilePatch: z.boolean().optional(),
  enableLintingAfterFilePatch: z.boolean().optional(),
  enableOpeningPatchedFilesInEditor: z.boolean().optional(),
}) satisfies z.ZodType<PostFilePatchActionsUserConfig>;

export interface InstructionsAndVariablesUserConfig {
  instructionsById?: Record<string, InstructionUserConfig>;
  sharedVariablesById?: Record<string, unknown>;
  sharedReferenceVariablesById?: Record<string, string>;
}

export const instructionsAndVariablesUserConfigSchema = z.object({
  instructionsById: z
    .record(
      z.string(),
      z.lazy(() => instructionUserConfigSchema)
    )
    .optional(),
  sharedVariablesById: z.record(z.string(), z.unknown()).optional(),
  sharedReferenceVariablesById: z.record(z.string(), z.string()).optional(),
}) satisfies z.ZodType<InstructionsAndVariablesUserConfig>;

export interface InstructionUserConfig {
  path?: string;
  skip?: boolean;
  showInPresetsMode?: boolean;
  showInQuickInstructionMode?: boolean;
}

export const instructionUserConfigSchema = z.object({
  path: nonEmptyStringSchema.optional(),
  skip: z.boolean().optional(),
  showInPresetsMode: z.boolean().optional(),
  showInQuickInstructionMode: z.boolean().optional(),
}) satisfies z.ZodType<InstructionUserConfig>;

export interface LlmToIdeSanitizationRuleUserConfig {
  regexPattern?: string;
  replaceWith?: string;
  skipForLanguages?: string[];
  skipForPaths?: string[];
}

export const llmToIdeSanitizationRuleUserConfigSchema = z.object({
  regexPattern: nonEmptyStringSchema.optional(),
  replaceWith: z.string().optional(),
  skipForLanguages: z.array(nonEmptyStringSchema).optional(),
  skipForPaths: z.array(nonEmptyStringSchema).optional(),
}) satisfies z.ZodType<LlmToIdeSanitizationRuleUserConfig>;

export interface PresetUserConfig {
  description?: string;
  version?: string;
  shouldBeSkipped?: boolean;
  presetDependentSettings?: PresetDependentSettingsUserConfig;
}

export const presetUserConfigSchema = z.object({
  description: z.string().optional(),
  version: z.string().optional(),
  shouldBeSkipped: z.boolean().optional(),
  presetDependentSettings: z.lazy(() => presetDependentSettingsUserConfigSchema).optional(),
}) satisfies z.ZodType<PresetUserConfig>;
