import { z } from 'zod';
import {
  buildVitalAnchorSchema,
  nonEmptyStringSchema,
  nonNegativeIntegerSchema,
  positiveFiniteNumberSchema,
  regexFlagsSchema,
} from '../helpers/zod-shared-schemas';

// This file intentionally keeps user-config Zod schema isolated from system-config Zod schema
// User config has patch semantics, so every field here must stay explicitly `.optional()`
// Building user schema by traversing system schema and making everything optional is possible, but too clever and brittle
// Isolation is simpler to maintain, and it also leaves room for user-config field names/types to diverge from system-config in the future
// Plus user-config has additional presets section, which system-config doesn't have

export interface UserConfig {
  presetIndependentSettings?: PresetIndependentSettingsUserConfig;
  presetDependentSettings?: PresetDependentSettingsUserConfig;
  presetsById?: Record<string, PresetUserConfig>;
}

// ! After changing zod-schema run manually "npm run compile", which will trigger "postcompile" → "node ./scripts/generate-json-schema.js"

// ! this userConfigSchema + path is hardcoded in "generate-json-schema.js", so be careful, auto-rename won't work!
export const userConfigSchema = z.strictObject({
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

export const presetIndependentSettingsUserConfigSchema = z.strictObject({
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

export const vitalParsingAnchorsUserConfigSchema = z.strictObject({
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

export const notificationSettingsUserConfigSchema = z.strictObject({
  configValidation: z.lazy(() => configValidationNotificationSettingsUserConfigSchema).optional(),
}) satisfies z.ZodType<NotificationSettingsUserConfig>;

export interface ConfigValidationNotificationSettingsUserConfig {
  suppressWarningIssuesToast?: boolean;
  suppressRecommendationIssuesToast?: boolean;
  suppressNoIssuesToast?: boolean;
}

export const configValidationNotificationSettingsUserConfigSchema = z.strictObject({
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
  instructionsSettings?: InstructionsSettingsUserConfig;
  llmToIdeSanitizationRulesById?: Record<string, LlmToIdeSanitizationRuleUserConfig>;
}

export const presetDependentSettingsUserConfigSchema = z.strictObject({
  skipInstructions: z.boolean().optional(),
  skipCodeListings: z.boolean().optional(),
  ideToLlm: z.lazy(() => ideToLlmUserConfigSchema).optional(),
  llmToIde: z.lazy(() => llmToIdeUserConfigSchema).optional(),
  postFilePatchActions: z.lazy(() => postFilePatchActionsUserConfigSchema).optional(),
  instructionsSettings: z.lazy(() => instructionsSettingsUserConfigSchema).optional(),
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

export const promptLimitsUserConfigSchema = z.strictObject({
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

export const postFilePatchActionsUserConfigSchema = z.strictObject({
  enableSaveAfterFilePatch: z.boolean().optional(),
  enableLintingAfterFilePatch: z.boolean().optional(),
  enableOpeningPatchedFilesInEditor: z.boolean().optional(),
}) satisfies z.ZodType<PostFilePatchActionsUserConfig>;

export interface InstructionsSettingsUserConfig {
  instructionsById?: Record<string, InstructionUserConfig>;
  variablesById?: Record<string, unknown>;
  referencesById?: Record<string, string>;
}

export const instructionsSettingsUserConfigSchema = z.strictObject({
  instructionsById: z
    .record(
      z.string(),
      z.lazy(() => instructionUserConfigSchema)
    )
    .optional(),
  variablesById: z.record(z.string(), z.unknown()).optional(),
  referencesById: z.record(z.string(), z.string()).optional(),
}) satisfies z.ZodType<InstructionsSettingsUserConfig>;

export interface InstructionUserConfig {
  path?: string;
  skip?: boolean;
  showInPresetsMode?: boolean;
  showInQuickInstructionMode?: boolean;
}

export const instructionUserConfigSchema = z.strictObject({
  path: nonEmptyStringSchema.optional(),
  skip: z.boolean().optional(),
  showInPresetsMode: z.boolean().optional(),
  showInQuickInstructionMode: z.boolean().optional(),
}) satisfies z.ZodType<InstructionUserConfig>;

export interface LlmToIdeSanitizationRuleUserConfig {
  skip?: boolean;
  regexPattern?: string;
  replaceWith?: string;
  regexFlags?: string | null;
  skipForLanguages?: string[] | null;
  skipForPaths?: string[] | null;
}

export const llmToIdeSanitizationRuleUserConfigSchema = z.strictObject({
  skip: z.boolean().optional(),
  regexPattern: nonEmptyStringSchema.optional(),
  replaceWith: z.string().optional(),
  regexFlags: regexFlagsSchema.nullable().optional(),
  skipForLanguages: z.array(nonEmptyStringSchema).nullable().optional(),
  skipForPaths: z.array(nonEmptyStringSchema).nullable().optional(),
}) satisfies z.ZodType<LlmToIdeSanitizationRuleUserConfig>;

export interface PresetUserConfig {
  description?: string;
  version?: string;
  shouldBeSkipped?: boolean;
  presetDependentSettings?: PresetDependentSettingsUserConfig;
}

export const presetUserConfigSchema = z.strictObject({
  description: z.string().optional(),
  version: z.string().optional(),
  shouldBeSkipped: z.boolean().optional(),
  presetDependentSettings: z.lazy(() => presetDependentSettingsUserConfigSchema).optional(),
}) satisfies z.ZodType<PresetUserConfig>;
