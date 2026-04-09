import { z } from 'zod';
import {
  buildVitalAnchorSchema,
  nonEmptyStringSchema,
  nonNegativeIntegerSchema,
  positiveFiniteNumberSchema,
} from '../helpers/zod-shared-schemas';
import { systemConfigMap } from './system-config-map';

export interface SystemConfig {
  presetIndependentSettings: PresetIndependentSettingsConfig;
  presetDependentSettings: PresetDependentSettingsConfig;
}

export const systemConfigSchema = z.object({
  [systemConfigMap.presetIndependentSettings.name]: z.lazy(() => presetIndependentSettingsConfigSchema),
  [systemConfigMap.presetDependentSettings.name]: z.lazy(() => presetDependentSettingsConfigSchema),
}) satisfies z.ZodType<SystemConfig>;

export interface PresetIndependentSettingsConfig {
  allowOutsideWorkspaceRead: boolean;
  allowOutsideWorkspaceWrite: boolean;
  vitalParsingAnchors: VitalParsingAnchorsConfig;
  notificationSettings: NotificationSettingsConfig;
}

export const presetIndependentSettingsConfigSchema = z.object({
  [systemConfigMap.presetIndependentSettings.allowOutsideWorkspaceRead.name]: z.boolean(),
  [systemConfigMap.presetIndependentSettings.allowOutsideWorkspaceWrite.name]: z.boolean(),
  [systemConfigMap.presetIndependentSettings.vitalParsingAnchors.name]: z.lazy(() => vitalParsingAnchorsConfigSchema),
  [systemConfigMap.presetIndependentSettings.notificationSettings.name]: z.lazy(() => notificationSettingsConfigSchema),
}) satisfies z.ZodType<PresetIndependentSettingsConfig>;

export interface VitalParsingAnchorsConfig {
  PROMPT_DELIMITER_ANCHOR: string;
  CODE_LISTING_HEADER_ANCHOR: string;
  FILE_STATUS_ANCHOR: string;
  FILE_EDITED_FULL_ANCHOR: string;
  FILE_CREATED_ANCHOR: string;
  FILE_DELETED_ANCHOR: string;
  END_OF_OUTPUT_ANCHOR: string | null;
}

export const vitalParsingAnchorsConfigSchema = z.object({
  [systemConfigMap.presetIndependentSettings.vitalParsingAnchors.PROMPT_DELIMITER_ANCHOR.name]: buildVitalAnchorSchema(),
  [systemConfigMap.presetIndependentSettings.vitalParsingAnchors.CODE_LISTING_HEADER_ANCHOR.name]: buildVitalAnchorSchema(),
  [systemConfigMap.presetIndependentSettings.vitalParsingAnchors.FILE_STATUS_ANCHOR.name]: buildVitalAnchorSchema(),
  [systemConfigMap.presetIndependentSettings.vitalParsingAnchors.FILE_EDITED_FULL_ANCHOR.name]: buildVitalAnchorSchema(),
  [systemConfigMap.presetIndependentSettings.vitalParsingAnchors.FILE_CREATED_ANCHOR.name]: buildVitalAnchorSchema(),
  [systemConfigMap.presetIndependentSettings.vitalParsingAnchors.FILE_DELETED_ANCHOR.name]: buildVitalAnchorSchema(),
  [systemConfigMap.presetIndependentSettings.vitalParsingAnchors.END_OF_OUTPUT_ANCHOR.name]:
    buildVitalAnchorSchema().nullable(),
}) satisfies z.ZodType<VitalParsingAnchorsConfig>;

export interface NotificationSettingsConfig {
  configValidation: ConfigValidationNotificationSettingsConfig;
}

export const notificationSettingsConfigSchema = z.object({
  [systemConfigMap.presetIndependentSettings.notificationSettings.configValidation.name]: z.lazy(
    () => configValidationNotificationSettingsConfigSchema
  ),
}) satisfies z.ZodType<NotificationSettingsConfig>;

export interface ConfigValidationNotificationSettingsConfig {
  suppressWarningIssuesToast: boolean;
  suppressRecommendationIssuesToast: boolean;
  suppressNoIssuesToast: boolean;
}

export const configValidationNotificationSettingsConfigSchema = z.object({
  [systemConfigMap.presetIndependentSettings.notificationSettings.configValidation.suppressWarningIssuesToast.name]:
    z.boolean(),
  [systemConfigMap.presetIndependentSettings.notificationSettings.configValidation.suppressRecommendationIssuesToast.name]:
    z.boolean(),
  [systemConfigMap.presetIndependentSettings.notificationSettings.configValidation.suppressNoIssuesToast.name]: z.boolean(),
}) satisfies z.ZodType<ConfigValidationNotificationSettingsConfig>;

export interface PresetDependentSettingsConfig {
  skipInstructions: boolean;
  skipCodeListings: boolean;
  ideToLlm: IdeToLlmConfig;
  llmToIde: LlmToIdeConfig;
  postFilePatchActions: PostFilePatchActionsConfig;
  instructionsSettings: InstructionsConfig;
  llmToIdeSanitizationRulesById: Record<string, LlmToIdeSanitizationRuleConfig>;
}

export const presetDependentSettingsConfigSchema = z.object({
  [systemConfigMap.presetDependentSettings.skipInstructions.name]: z.boolean(),
  [systemConfigMap.presetDependentSettings.skipCodeListings.name]: z.boolean(),
  [systemConfigMap.presetDependentSettings.ideToLlm.name]: z.lazy(() => ideToLlmConfigSchema),
  [systemConfigMap.presetDependentSettings.llmToIde.name]: z.lazy(() => llmToIdeConfigSchema),
  [systemConfigMap.presetDependentSettings.postFilePatchActions.name]: z.lazy(() => postFilePatchActionsConfigSchema),
  [systemConfigMap.presetDependentSettings.instructionsSettings.name]: z.lazy(() => instructionsSettingsConfigSchema),
  [systemConfigMap.presetDependentSettings.llmToIdeSanitizationRulesById.name]: z.record(
    z.string(),
    z.lazy(() => llmToIdeSanitizationRuleConfigSchema)
  ),
}) satisfies z.ZodType<PresetDependentSettingsConfig>;

export interface PromptLimitsConfig {
  skipPromptSizeStatsInCopyNotification: boolean;
  charsPerToken: number;
  linesMaxToShowWarning: number;
  tokensMaxToShowWarning: number;
}

export const promptLimitsConfigSchema = z.object({
  [systemConfigMap.promptLimits.skipPromptSizeStatsInCopyNotification.name]: z.boolean(),
  [systemConfigMap.promptLimits.charsPerToken.name]: positiveFiniteNumberSchema,
  [systemConfigMap.promptLimits.linesMaxToShowWarning.name]: nonNegativeIntegerSchema,
  [systemConfigMap.promptLimits.tokensMaxToShowWarning.name]: nonNegativeIntegerSchema,
}) satisfies z.ZodType<PromptLimitsConfig>;

export interface IdeToLlmConfig extends PromptLimitsConfig {}

export const ideToLlmConfigSchema = promptLimitsConfigSchema satisfies z.ZodType<IdeToLlmConfig>;

export interface LlmToIdeConfig extends PromptLimitsConfig {}

export const llmToIdeConfigSchema = promptLimitsConfigSchema satisfies z.ZodType<LlmToIdeConfig>;

export interface PostFilePatchActionsConfig {
  enableSaveAfterFilePatch: boolean;
  enableLintingAfterFilePatch: boolean;
  enableOpeningPatchedFilesInEditor: boolean;
}

export const postFilePatchActionsConfigSchema = z.object({
  [systemConfigMap.presetDependentSettings.postFilePatchActions.enableSaveAfterFilePatch.name]: z.boolean(),
  [systemConfigMap.presetDependentSettings.postFilePatchActions.enableLintingAfterFilePatch.name]: z.boolean(),
  [systemConfigMap.presetDependentSettings.postFilePatchActions.enableOpeningPatchedFilesInEditor.name]: z.boolean(),
}) satisfies z.ZodType<PostFilePatchActionsConfig>;

export interface InstructionsConfig {
  instructionsById: Record<string, InstructionConfig>;
  variablesById: Record<string, unknown>;
  referencesById: Record<string, unknown>;
}

export const instructionsSettingsConfigSchema = z.object({
  [systemConfigMap.presetDependentSettings.instructionsSettings.instructionsById.name]: z.record(
    z.string(),
    z.lazy(() => instructionConfigSchema)
  ),
  [systemConfigMap.presetDependentSettings.instructionsSettings.variablesById.name]: z.record(z.string(), z.unknown()),
  [systemConfigMap.presetDependentSettings.instructionsSettings.referencesById.name]: z.record(z.string(), z.unknown()),
}) satisfies z.ZodType<InstructionsConfig>;

export interface InstructionConfig {
  path: string;
  skip: boolean;
  showInPresetsMode: boolean;
  showInQuickInstructionMode: boolean;
}

export const instructionConfigSchema = z.object({
  [systemConfigMap.instruction.path.name]: nonEmptyStringSchema,
  [systemConfigMap.instruction.skip.name]: z.boolean(),
  [systemConfigMap.instruction.showInPresetsMode.name]: z.boolean(),
  [systemConfigMap.instruction.showInQuickInstructionMode.name]: z.boolean(),
}) satisfies z.ZodType<InstructionConfig>;

export interface LlmToIdeSanitizationRuleConfig {
  regexPattern: string;
  replaceWith: string;
  skipForLanguages: string[];
  skipForPaths: string[];
}

export const llmToIdeSanitizationRuleConfigSchema = z.object({
  [systemConfigMap.llmToIdeSanitizationRule.regexPattern.name]: nonEmptyStringSchema,
  [systemConfigMap.llmToIdeSanitizationRule.replaceWith.name]: z.string(),
  [systemConfigMap.llmToIdeSanitizationRule.skipForLanguages.name]: z.array(nonEmptyStringSchema),
  [systemConfigMap.llmToIdeSanitizationRule.skipForPaths.name]: z.array(nonEmptyStringSchema),
}) satisfies z.ZodType<LlmToIdeSanitizationRuleConfig>;
