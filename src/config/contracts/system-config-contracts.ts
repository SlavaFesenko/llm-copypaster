import { z } from 'zod';
import {
  buildVitalAnchorSchema,
  nonEmptyStringSchema,
  nonNegativeIntegerSchema,
  positiveFiniteNumberSchema,
} from '../helpers/zod-shared-schemas';
import { systemConfigPropsMap } from './system-config-map';

export interface SystemConfig {
  presetIndependentSettings: PresetIndependentSettingsConfig;
  presetDependentSettings: PresetDependentSettingsConfig;
}

export const llmCopypasterConfigSchema = z.object({
  [systemConfigPropsMap.presetIndependentSettings.name]: z.lazy(() => presetIndependentSettingsConfigSchema),
  [systemConfigPropsMap.presetDependentSettings.name]: z.lazy(() => presetDependentSettingsConfigSchema),
}) satisfies z.ZodType<SystemConfig>;

export interface PresetIndependentSettingsConfig {
  allowOutsideWorkspaceRead: boolean;
  allowOutsideWorkspaceWrite: boolean;
  vitalParsingAnchors: VitalParsingAnchorsConfig;
  notificationSettings: NotificationSettingsConfig;
}

export const presetIndependentSettingsConfigSchema = z.object({
  [systemConfigPropsMap.presetIndependentSettings.allowOutsideWorkspaceRead.name]: z.boolean(),
  [systemConfigPropsMap.presetIndependentSettings.allowOutsideWorkspaceWrite.name]: z.boolean(),
  [systemConfigPropsMap.presetIndependentSettings.vitalParsingAnchors.name]: z.lazy(() => vitalParsingAnchorsConfigSchema),
  [systemConfigPropsMap.presetIndependentSettings.notificationSettings.name]: z.lazy(() => notificationSettingsConfigSchema),
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
  [systemConfigPropsMap.presetIndependentSettings.vitalParsingAnchors.PROMPT_DELIMITER_ANCHOR.name]:
    buildVitalAnchorSchema(),
  [systemConfigPropsMap.presetIndependentSettings.vitalParsingAnchors.CODE_LISTING_HEADER_ANCHOR.name]:
    buildVitalAnchorSchema(),
  [systemConfigPropsMap.presetIndependentSettings.vitalParsingAnchors.FILE_STATUS_ANCHOR.name]: buildVitalAnchorSchema(),
  [systemConfigPropsMap.presetIndependentSettings.vitalParsingAnchors.FILE_EDITED_FULL_ANCHOR.name]:
    buildVitalAnchorSchema(),
  [systemConfigPropsMap.presetIndependentSettings.vitalParsingAnchors.FILE_CREATED_ANCHOR.name]: buildVitalAnchorSchema(),
  [systemConfigPropsMap.presetIndependentSettings.vitalParsingAnchors.FILE_DELETED_ANCHOR.name]: buildVitalAnchorSchema(),
  [systemConfigPropsMap.presetIndependentSettings.vitalParsingAnchors.END_OF_OUTPUT_ANCHOR.name]:
    buildVitalAnchorSchema().nullable(),
}) satisfies z.ZodType<VitalParsingAnchorsConfig>;

export interface NotificationSettingsConfig {
  configValidation: ConfigValidationNotificationSettingsConfig;
}

export const notificationSettingsConfigSchema = z.object({
  [systemConfigPropsMap.presetIndependentSettings.notificationSettings.configValidation.name]: z.lazy(
    () => configValidationNotificationSettingsConfigSchema
  ),
}) satisfies z.ZodType<NotificationSettingsConfig>;

export interface ConfigValidationNotificationSettingsConfig {
  suppressWarningIssuesToast: boolean;
  suppressRecommendationIssuesToast: boolean;
  suppressNoIssuesToast: boolean;
}

export const configValidationNotificationSettingsConfigSchema = z.object({
  [systemConfigPropsMap.presetIndependentSettings.notificationSettings.configValidation.suppressWarningIssuesToast.name]:
    z.boolean(),
  [systemConfigPropsMap.presetIndependentSettings.notificationSettings.configValidation.suppressRecommendationIssuesToast
    .name]: z.boolean(),
  [systemConfigPropsMap.presetIndependentSettings.notificationSettings.configValidation.suppressNoIssuesToast.name]:
    z.boolean(),
}) satisfies z.ZodType<ConfigValidationNotificationSettingsConfig>;

export interface PresetDependentSettingsConfig {
  skipInstructions: boolean;
  skipCodeListings: boolean;
  ideToLlm: IdeToLlmConfig;
  llmToIde: LlmToIdeConfig;
  postFilePatchActions: PostFilePatchActionsConfig;
  instructionsAndVariables: InstructionsAndVariablesConfig;
  llmToIdeSanitizationRulesById: Record<string, LlmToIdeSanitizationRuleConfig>;
}

export const presetDependentSettingsConfigSchema = z.object({
  [systemConfigPropsMap.presetDependentSettings.skipInstructions.name]: z.boolean(),
  [systemConfigPropsMap.presetDependentSettings.skipCodeListings.name]: z.boolean(),
  [systemConfigPropsMap.presetDependentSettings.ideToLlm.name]: z.lazy(() => ideToLlmConfigSchema),
  [systemConfigPropsMap.presetDependentSettings.llmToIde.name]: z.lazy(() => llmToIdeConfigSchema),
  [systemConfigPropsMap.presetDependentSettings.postFilePatchActions.name]: z.lazy(() => postFilePatchActionsConfigSchema),
  [systemConfigPropsMap.presetDependentSettings.instructionsAndVariables.name]: z.lazy(
    () => instructionsAndVariablesConfigSchema
  ),
  [systemConfigPropsMap.presetDependentSettings.llmToIdeSanitizationRulesById.name]: z.record(
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
  [systemConfigPropsMap.promptLimits.skipPromptSizeStatsInCopyNotification.name]: z.boolean(),
  [systemConfigPropsMap.promptLimits.charsPerToken.name]: positiveFiniteNumberSchema,
  [systemConfigPropsMap.promptLimits.linesMaxToShowWarning.name]: nonNegativeIntegerSchema,
  [systemConfigPropsMap.promptLimits.tokensMaxToShowWarning.name]: nonNegativeIntegerSchema,
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
  [systemConfigPropsMap.presetDependentSettings.postFilePatchActions.enableSaveAfterFilePatch.name]: z.boolean(),
  [systemConfigPropsMap.presetDependentSettings.postFilePatchActions.enableLintingAfterFilePatch.name]: z.boolean(),
  [systemConfigPropsMap.presetDependentSettings.postFilePatchActions.enableOpeningPatchedFilesInEditor.name]: z.boolean(),
}) satisfies z.ZodType<PostFilePatchActionsConfig>;

export interface InstructionsAndVariablesConfig {
  instructionsById: Record<string, InstructionConfig>;
  sharedVariablesById: Record<string, unknown>;
  sharedReferenceVariablesById: Record<string, unknown>;
}

export const instructionsAndVariablesConfigSchema = z.object({
  [systemConfigPropsMap.presetDependentSettings.instructionsAndVariables.instructionsById.name]: z.record(
    z.string(),
    z.lazy(() => instructionConfigSchema)
  ),
  [systemConfigPropsMap.presetDependentSettings.instructionsAndVariables.sharedVariablesById.name]: z.record(
    z.string(),
    z.unknown()
  ),
  [systemConfigPropsMap.presetDependentSettings.instructionsAndVariables.sharedReferenceVariablesById.name]: z.record(
    z.string(),
    z.unknown()
  ),
}) satisfies z.ZodType<InstructionsAndVariablesConfig>;

export interface InstructionConfig {
  path: string;
  skip: boolean;
  showInPresetsMode: boolean;
  showInQuickInstructionMode: boolean;
}

export const instructionConfigSchema = z.object({
  [systemConfigPropsMap.instruction.path.name]: nonEmptyStringSchema,
  [systemConfigPropsMap.instruction.skip.name]: z.boolean(),
  [systemConfigPropsMap.instruction.showInPresetsMode.name]: z.boolean(),
  [systemConfigPropsMap.instruction.showInQuickInstructionMode.name]: z.boolean(),
}) satisfies z.ZodType<InstructionConfig>;

export interface LlmToIdeSanitizationRuleConfig {
  regexPattern: string;
  replaceWith: string;
  skipForLanguages: string[];
  skipForPaths: string[];
}

export const llmToIdeSanitizationRuleConfigSchema = z.object({
  [systemConfigPropsMap.llmToIdeSanitizationRule.regexPattern.name]: nonEmptyStringSchema,
  [systemConfigPropsMap.llmToIdeSanitizationRule.replaceWith.name]: z.string(),
  [systemConfigPropsMap.llmToIdeSanitizationRule.skipForLanguages.name]: z.array(nonEmptyStringSchema),
  [systemConfigPropsMap.llmToIdeSanitizationRule.skipForPaths.name]: z.array(nonEmptyStringSchema),
}) satisfies z.ZodType<LlmToIdeSanitizationRuleConfig>;
