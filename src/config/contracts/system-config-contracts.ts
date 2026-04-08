import { z } from 'zod';
import {
  buildVitalAnchorSchema,
  nonEmptyStringSchema,
  nonNegativeIntegerSchema,
  positiveFiniteNumberSchema,
} from '../helpers/zod-shared-schemas';
import { systemConfigFieldPathMap } from './system-config-map';

export interface SystemConfig {
  [systemConfigFieldPathMap.presetIndependentSettings.name]: PresetIndependentSettingsConfig;
  [systemConfigFieldPathMap.presetDependentSettings.name]: PresetDependentSettingsConfig;
}

export const llmCopypasterConfigSchema = z.object({
  [systemConfigFieldPathMap.presetIndependentSettings.name]: z.lazy(() => presetIndependentSettingsConfigSchema),
  [systemConfigFieldPathMap.presetDependentSettings.name]: z.lazy(() => presetDependentSettingsConfigSchema),
}) satisfies z.ZodType<SystemConfig>;

export interface PresetIndependentSettingsConfig {
  [systemConfigFieldPathMap.presetIndependentSettings.allowOutsideWorkspaceRead.name]: boolean;
  [systemConfigFieldPathMap.presetIndependentSettings.allowOutsideWorkspaceWrite.name]: boolean;
  [systemConfigFieldPathMap.presetIndependentSettings.vitalParsingAnchors.name]: VitalParsingAnchorsConfig;
  [systemConfigFieldPathMap.presetIndependentSettings.notificationSettings.name]: NotificationSettingsConfig;
}

export const presetIndependentSettingsConfigSchema = z.object({
  [systemConfigFieldPathMap.presetIndependentSettings.allowOutsideWorkspaceRead.name]: z.boolean(),
  [systemConfigFieldPathMap.presetIndependentSettings.allowOutsideWorkspaceWrite.name]: z.boolean(),
  [systemConfigFieldPathMap.presetIndependentSettings.vitalParsingAnchors.name]: z.lazy(
    () => vitalParsingAnchorsConfigSchema
  ),
  [systemConfigFieldPathMap.presetIndependentSettings.notificationSettings.name]: z.lazy(
    () => notificationSettingsConfigSchema
  ),
}) satisfies z.ZodType<PresetIndependentSettingsConfig>;

export interface VitalParsingAnchorsConfig {
  [systemConfigFieldPathMap.presetIndependentSettings.vitalParsingAnchors.PROMPT_DELIMITER_ANCHOR.name]: string;
  [systemConfigFieldPathMap.presetIndependentSettings.vitalParsingAnchors.CODE_LISTING_HEADER_ANCHOR.name]: string;
  [systemConfigFieldPathMap.presetIndependentSettings.vitalParsingAnchors.FILE_STATUS_ANCHOR.name]: string;
  [systemConfigFieldPathMap.presetIndependentSettings.vitalParsingAnchors.FILE_EDITED_FULL_ANCHOR.name]: string;
  [systemConfigFieldPathMap.presetIndependentSettings.vitalParsingAnchors.FILE_CREATED_ANCHOR.name]: string;
  [systemConfigFieldPathMap.presetIndependentSettings.vitalParsingAnchors.FILE_DELETED_ANCHOR.name]: string;
  [systemConfigFieldPathMap.presetIndependentSettings.vitalParsingAnchors.END_OF_OUTPUT_ANCHOR.name]: string | null;
}

export const vitalParsingAnchorsConfigSchema = z.object({
  [systemConfigFieldPathMap.presetIndependentSettings.vitalParsingAnchors.PROMPT_DELIMITER_ANCHOR.name]:
    buildVitalAnchorSchema(),
  [systemConfigFieldPathMap.presetIndependentSettings.vitalParsingAnchors.CODE_LISTING_HEADER_ANCHOR.name]:
    buildVitalAnchorSchema(),
  [systemConfigFieldPathMap.presetIndependentSettings.vitalParsingAnchors.FILE_STATUS_ANCHOR.name]: buildVitalAnchorSchema(),
  [systemConfigFieldPathMap.presetIndependentSettings.vitalParsingAnchors.FILE_EDITED_FULL_ANCHOR.name]:
    buildVitalAnchorSchema(),
  [systemConfigFieldPathMap.presetIndependentSettings.vitalParsingAnchors.FILE_CREATED_ANCHOR.name]:
    buildVitalAnchorSchema(),
  [systemConfigFieldPathMap.presetIndependentSettings.vitalParsingAnchors.FILE_DELETED_ANCHOR.name]:
    buildVitalAnchorSchema(),
  [systemConfigFieldPathMap.presetIndependentSettings.vitalParsingAnchors.END_OF_OUTPUT_ANCHOR.name]:
    buildVitalAnchorSchema().nullable(),
}) satisfies z.ZodType<VitalParsingAnchorsConfig>;

export interface NotificationSettingsConfig {
  [systemConfigFieldPathMap.presetIndependentSettings.notificationSettings.configValidation
    .name]: ConfigValidationNotificationSettingsConfig;
}

export const notificationSettingsConfigSchema = z.object({
  [systemConfigFieldPathMap.presetIndependentSettings.notificationSettings.configValidation.name]: z.lazy(
    () => configValidationNotificationSettingsConfigSchema
  ),
}) satisfies z.ZodType<NotificationSettingsConfig>;

export interface ConfigValidationNotificationSettingsConfig {
  [systemConfigFieldPathMap.presetIndependentSettings.notificationSettings.configValidation.suppressWarningIssuesToast
    .name]: boolean;
  [systemConfigFieldPathMap.presetIndependentSettings.notificationSettings.configValidation.suppressRecommendationIssuesToast
    .name]: boolean;
  [systemConfigFieldPathMap.presetIndependentSettings.notificationSettings.configValidation.suppressNoIssuesToast
    .name]: boolean;
}

export const configValidationNotificationSettingsConfigSchema = z.object({
  [systemConfigFieldPathMap.presetIndependentSettings.notificationSettings.configValidation.suppressWarningIssuesToast.name]:
    z.boolean(),
  [systemConfigFieldPathMap.presetIndependentSettings.notificationSettings.configValidation.suppressRecommendationIssuesToast
    .name]: z.boolean(),
  [systemConfigFieldPathMap.presetIndependentSettings.notificationSettings.configValidation.suppressNoIssuesToast.name]:
    z.boolean(),
}) satisfies z.ZodType<ConfigValidationNotificationSettingsConfig>;

export interface PresetDependentSettingsConfig {
  [systemConfigFieldPathMap.presetDependentSettings.skipInstructions.name]: boolean;
  [systemConfigFieldPathMap.presetDependentSettings.skipCodeListings.name]: boolean;
  [systemConfigFieldPathMap.presetDependentSettings.ideToLlm.name]: IdeToLlmConfig;
  [systemConfigFieldPathMap.presetDependentSettings.llmToIde.name]: LlmToIdeConfig;
  [systemConfigFieldPathMap.presetDependentSettings.postFilePatchActions.name]: PostFilePatchActionsConfig;
  [systemConfigFieldPathMap.presetDependentSettings.instructionsAndVariables.name]: InstructionsAndVariablesConfig;
  [systemConfigFieldPathMap.presetDependentSettings.llmToIdeSanitizationRulesById.name]: Record<
    string,
    LlmToIdeSanitizationRuleConfig
  >;
}

export const presetDependentSettingsConfigSchema = z.object({
  [systemConfigFieldPathMap.presetDependentSettings.skipInstructions.name]: z.boolean(),
  [systemConfigFieldPathMap.presetDependentSettings.skipCodeListings.name]: z.boolean(),
  [systemConfigFieldPathMap.presetDependentSettings.ideToLlm.name]: z.lazy(() => ideToLlmConfigSchema),
  [systemConfigFieldPathMap.presetDependentSettings.llmToIde.name]: z.lazy(() => llmToIdeConfigSchema),
  [systemConfigFieldPathMap.presetDependentSettings.postFilePatchActions.name]: z.lazy(
    () => postFilePatchActionsConfigSchema
  ),
  [systemConfigFieldPathMap.presetDependentSettings.instructionsAndVariables.name]: z.lazy(
    () => instructionsAndVariablesConfigSchema
  ),
  [systemConfigFieldPathMap.presetDependentSettings.llmToIdeSanitizationRulesById.name]: z.record(
    z.string(),
    z.lazy(() => llmToIdeSanitizationRuleConfigSchema)
  ),
}) satisfies z.ZodType<PresetDependentSettingsConfig>;

export interface PromptLimitsConfig {
  [systemConfigFieldPathMap.promptLimits.skipPromptSizeStatsInCopyNotification.name]: boolean;
  [systemConfigFieldPathMap.promptLimits.charsPerToken.name]: number;
  [systemConfigFieldPathMap.promptLimits.linesMaxToShowWarning.name]: number;
  [systemConfigFieldPathMap.promptLimits.tokensMaxToShowWarning.name]: number;
}

export const promptLimitsConfigSchema = z.object({
  [systemConfigFieldPathMap.promptLimits.skipPromptSizeStatsInCopyNotification.name]: z.boolean(),
  [systemConfigFieldPathMap.promptLimits.charsPerToken.name]: positiveFiniteNumberSchema,
  [systemConfigFieldPathMap.promptLimits.linesMaxToShowWarning.name]: nonNegativeIntegerSchema,
  [systemConfigFieldPathMap.promptLimits.tokensMaxToShowWarning.name]: nonNegativeIntegerSchema,
}) satisfies z.ZodType<PromptLimitsConfig>;

export interface IdeToLlmConfig extends PromptLimitsConfig {}

export const ideToLlmConfigSchema = promptLimitsConfigSchema satisfies z.ZodType<IdeToLlmConfig>;

export interface LlmToIdeConfig extends PromptLimitsConfig {}

export const llmToIdeConfigSchema = promptLimitsConfigSchema satisfies z.ZodType<LlmToIdeConfig>;

export interface PostFilePatchActionsConfig {
  [systemConfigFieldPathMap.presetDependentSettings.postFilePatchActions.enableSaveAfterFilePatch.name]: boolean;
  [systemConfigFieldPathMap.presetDependentSettings.postFilePatchActions.enableLintingAfterFilePatch.name]: boolean;
  [systemConfigFieldPathMap.presetDependentSettings.postFilePatchActions.enableOpeningPatchedFilesInEditor.name]: boolean;
}

export const postFilePatchActionsConfigSchema = z.object({
  [systemConfigFieldPathMap.presetDependentSettings.postFilePatchActions.enableSaveAfterFilePatch.name]: z.boolean(),
  [systemConfigFieldPathMap.presetDependentSettings.postFilePatchActions.enableLintingAfterFilePatch.name]: z.boolean(),
  [systemConfigFieldPathMap.presetDependentSettings.postFilePatchActions.enableOpeningPatchedFilesInEditor.name]:
    z.boolean(),
}) satisfies z.ZodType<PostFilePatchActionsConfig>;

export interface InstructionsAndVariablesConfig {
  [systemConfigFieldPathMap.presetDependentSettings.instructionsAndVariables.instructionsById.name]: Record<
    string,
    InstructionConfig
  >;
  [systemConfigFieldPathMap.presetDependentSettings.instructionsAndVariables.sharedVariablesById.name]: Record<
    string,
    unknown
  >;
  [systemConfigFieldPathMap.presetDependentSettings.instructionsAndVariables.sharedReferenceVariablesById.name]: Record<
    string,
    unknown
  >;
}

export const instructionsAndVariablesConfigSchema = z.object({
  [systemConfigFieldPathMap.presetDependentSettings.instructionsAndVariables.instructionsById.name]: z.record(
    z.string(),
    z.lazy(() => instructionConfigSchema)
  ),
  [systemConfigFieldPathMap.presetDependentSettings.instructionsAndVariables.sharedVariablesById.name]: z.record(
    z.string(),
    z.unknown()
  ),
  [systemConfigFieldPathMap.presetDependentSettings.instructionsAndVariables.sharedReferenceVariablesById.name]: z.record(
    z.string(),
    z.unknown()
  ),
}) satisfies z.ZodType<InstructionsAndVariablesConfig>;

export interface InstructionConfig {
  [systemConfigFieldPathMap.instruction.path.name]: string;
  [systemConfigFieldPathMap.instruction.skip.name]: boolean;
  [systemConfigFieldPathMap.instruction.showInPresetsMode.name]: boolean;
  [systemConfigFieldPathMap.instruction.showInQuickInstructionMode.name]: boolean;
}

export const instructionConfigSchema = z.object({
  [systemConfigFieldPathMap.instruction.path.name]: nonEmptyStringSchema,
  [systemConfigFieldPathMap.instruction.skip.name]: z.boolean(),
  [systemConfigFieldPathMap.instruction.showInPresetsMode.name]: z.boolean(),
  [systemConfigFieldPathMap.instruction.showInQuickInstructionMode.name]: z.boolean(),
}) satisfies z.ZodType<InstructionConfig>;

export interface LlmToIdeSanitizationRuleConfig {
  [systemConfigFieldPathMap.llmToIdeSanitizationRule.regexPattern.name]: string;
  [systemConfigFieldPathMap.llmToIdeSanitizationRule.replaceWith.name]: string;
  [systemConfigFieldPathMap.llmToIdeSanitizationRule.skipForLanguages.name]: string[];
  [systemConfigFieldPathMap.llmToIdeSanitizationRule.skipForPaths.name]: string[];
}

export const llmToIdeSanitizationRuleConfigSchema = z.object({
  [systemConfigFieldPathMap.llmToIdeSanitizationRule.regexPattern.name]: nonEmptyStringSchema,
  [systemConfigFieldPathMap.llmToIdeSanitizationRule.replaceWith.name]: z.string(),
  [systemConfigFieldPathMap.llmToIdeSanitizationRule.skipForLanguages.name]: z.array(nonEmptyStringSchema),
  [systemConfigFieldPathMap.llmToIdeSanitizationRule.skipForPaths.name]: z.array(nonEmptyStringSchema),
}) satisfies z.ZodType<LlmToIdeSanitizationRuleConfig>;
