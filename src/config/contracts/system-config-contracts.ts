import { z } from 'zod';
import { systemConfigFieldPathMap } from './system-config-map';

// !!! After changing zod-schema run manually "npm run compile", which will trigger "postcompile" → "node ./scripts/generate-json-schema.js"

// #region Shared Zod-Helpers (has to be declared before use)

const nonEmptyStringSchema = z.string().trim().min(1);
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const positiveFiniteNumberSchema = z.number().finite().positive();

function buildVitalAnchorSchema() {
  const vitalAnchorMinLength = 3;

  return z.string().refine(anchorValue => anchorValue.trim().length >= vitalAnchorMinLength, {
    message: `Anchor must be at least ${vitalAnchorMinLength} chars after trim to make parsing more fragile`,
  });
}

// #endregion

export interface LlmCopypasterConfig {
  [systemConfigFieldPathMap.nonOverrideableSettings.name]: NonOverrideableSettingsConfig;
  [systemConfigFieldPathMap.coreSettings.name]: CoreSettingsConfig;
}

// ! this llmCopypasterConfigSchema + path is hardcoded in "generate-json-schema.js", so be careful, auto-rename won't work!
export const llmCopypasterConfigSchema = z.object({
  [systemConfigFieldPathMap.nonOverrideableSettings.name]: z.lazy(() => nonOverrideableSettingsConfigSchema),
  [systemConfigFieldPathMap.coreSettings.name]: z.lazy(() => coreSettingsConfigSchema),
}) satisfies z.ZodType<LlmCopypasterConfig>;

export interface NonOverrideableSettingsConfig {
  [systemConfigFieldPathMap.nonOverrideableSettings.allowOutsideWorkspaceRead.name]: boolean;
  [systemConfigFieldPathMap.nonOverrideableSettings.allowOutsideWorkspaceWrite.name]: boolean;
  [systemConfigFieldPathMap.nonOverrideableSettings.vitalParsingAnchors.name]: VitalParsingAnchorsConfig;
}

export const nonOverrideableSettingsConfigSchema = z.object({
  [systemConfigFieldPathMap.nonOverrideableSettings.allowOutsideWorkspaceRead.name]: z.boolean(),
  [systemConfigFieldPathMap.nonOverrideableSettings.allowOutsideWorkspaceWrite.name]: z.boolean(),
  [systemConfigFieldPathMap.nonOverrideableSettings.vitalParsingAnchors.name]: z.lazy(() => vitalParsingAnchorsConfigSchema),
}) satisfies z.ZodType<NonOverrideableSettingsConfig>;

export interface VitalParsingAnchorsConfig {
  [systemConfigFieldPathMap.nonOverrideableSettings.vitalParsingAnchors.PROMPT_DELIMITER_ANCHOR.name]: string;
  [systemConfigFieldPathMap.nonOverrideableSettings.vitalParsingAnchors.CODE_LISTING_HEADER_ANCHOR.name]: string;
  [systemConfigFieldPathMap.nonOverrideableSettings.vitalParsingAnchors.FILE_STATUS_ANCHOR.name]: string;
  [systemConfigFieldPathMap.nonOverrideableSettings.vitalParsingAnchors.FILE_EDITED_FULL_ANCHOR.name]: string;
  [systemConfigFieldPathMap.nonOverrideableSettings.vitalParsingAnchors.FILE_CREATED_ANCHOR.name]: string;
  [systemConfigFieldPathMap.nonOverrideableSettings.vitalParsingAnchors.FILE_DELETED_ANCHOR.name]: string;
  [systemConfigFieldPathMap.nonOverrideableSettings.vitalParsingAnchors.END_OF_OUTPUT_ANCHOR.name]: string | null;
}

export const vitalParsingAnchorsConfigSchema = z.object({
  [systemConfigFieldPathMap.nonOverrideableSettings.vitalParsingAnchors.PROMPT_DELIMITER_ANCHOR.name]:
    buildVitalAnchorSchema(),
  [systemConfigFieldPathMap.nonOverrideableSettings.vitalParsingAnchors.CODE_LISTING_HEADER_ANCHOR.name]:
    buildVitalAnchorSchema(),
  [systemConfigFieldPathMap.nonOverrideableSettings.vitalParsingAnchors.FILE_STATUS_ANCHOR.name]: buildVitalAnchorSchema(),
  [systemConfigFieldPathMap.nonOverrideableSettings.vitalParsingAnchors.FILE_EDITED_FULL_ANCHOR.name]:
    buildVitalAnchorSchema(),
  [systemConfigFieldPathMap.nonOverrideableSettings.vitalParsingAnchors.FILE_CREATED_ANCHOR.name]: buildVitalAnchorSchema(),
  [systemConfigFieldPathMap.nonOverrideableSettings.vitalParsingAnchors.FILE_DELETED_ANCHOR.name]: buildVitalAnchorSchema(),
  [systemConfigFieldPathMap.nonOverrideableSettings.vitalParsingAnchors.END_OF_OUTPUT_ANCHOR.name]:
    buildVitalAnchorSchema().nullable(),
}) satisfies z.ZodType<VitalParsingAnchorsConfig>;

export interface CoreSettingsConfig {
  [systemConfigFieldPathMap.coreSettings.skipInstructions.name]: boolean;
  [systemConfigFieldPathMap.coreSettings.skipCodeListings.name]: boolean;
  [systemConfigFieldPathMap.coreSettings.ideToLlm.name]: IdeToLlmConfig;
  [systemConfigFieldPathMap.coreSettings.llmToIde.name]: LlmToIdeConfig;
  [systemConfigFieldPathMap.coreSettings.postFilePatchActions.name]: PostFilePatchActionsConfig;
  [systemConfigFieldPathMap.coreSettings.instructionsAndVariables.name]: InstructionsAndVariablesConfig;
  [systemConfigFieldPathMap.coreSettings.llmToIdeSanitizationRulesById.name]: Record<string, LlmToIdeSanitizationRuleConfig>;
}

export const coreSettingsConfigSchema = z.object({
  [systemConfigFieldPathMap.coreSettings.skipInstructions.name]: z.boolean(),
  [systemConfigFieldPathMap.coreSettings.skipCodeListings.name]: z.boolean(),
  [systemConfigFieldPathMap.coreSettings.ideToLlm.name]: z.lazy(() => ideToLlmConfigSchema),
  [systemConfigFieldPathMap.coreSettings.llmToIde.name]: z.lazy(() => llmToIdeConfigSchema),
  [systemConfigFieldPathMap.coreSettings.postFilePatchActions.name]: z.lazy(() => postFilePatchActionsConfigSchema),
  [systemConfigFieldPathMap.coreSettings.instructionsAndVariables.name]: z.lazy(() => instructionsAndVariablesConfigSchema),
  [systemConfigFieldPathMap.coreSettings.llmToIdeSanitizationRulesById.name]: z.record(
    z.string(),
    z.lazy(() => llmToIdeSanitizationRuleConfigSchema)
  ),
}) satisfies z.ZodType<CoreSettingsConfig>;

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
  [systemConfigFieldPathMap.coreSettings.postFilePatchActions.enableSaveAfterFilePatch.name]: boolean;
  [systemConfigFieldPathMap.coreSettings.postFilePatchActions.enableLintingAfterFilePatch.name]: boolean;
  [systemConfigFieldPathMap.coreSettings.postFilePatchActions.enableOpeningPatchedFilesInEditor.name]: boolean;
}

export const postFilePatchActionsConfigSchema = z.object({
  [systemConfigFieldPathMap.coreSettings.postFilePatchActions.enableSaveAfterFilePatch.name]: z.boolean(),
  [systemConfigFieldPathMap.coreSettings.postFilePatchActions.enableLintingAfterFilePatch.name]: z.boolean(),
  [systemConfigFieldPathMap.coreSettings.postFilePatchActions.enableOpeningPatchedFilesInEditor.name]: z.boolean(),
}) satisfies z.ZodType<PostFilePatchActionsConfig>;

export interface InstructionsAndVariablesConfig {
  [systemConfigFieldPathMap.coreSettings.instructionsAndVariables.instructionsById.name]: Record<string, InstructionConfig>;
  [systemConfigFieldPathMap.coreSettings.instructionsAndVariables.sharedVariablesById.name]: Record<string, unknown>;
  [systemConfigFieldPathMap.coreSettings.instructionsAndVariables.sharedReferenceVariablesById.name]: Record<
    string,
    unknown
  >;
}

export const instructionsAndVariablesConfigSchema = z.object({
  [systemConfigFieldPathMap.coreSettings.instructionsAndVariables.instructionsById.name]: z.record(
    z.string(),
    z.lazy(() => instructionConfigSchema)
  ),
  [systemConfigFieldPathMap.coreSettings.instructionsAndVariables.sharedVariablesById.name]: z.record(
    z.string(),
    z.unknown()
  ),
  [systemConfigFieldPathMap.coreSettings.instructionsAndVariables.sharedReferenceVariablesById.name]: z.record(
    z.string(),
    z.unknown()
  ),
}) satisfies z.ZodType<InstructionsAndVariablesConfig>;

export interface InstructionConfig {
  [systemConfigFieldPathMap.instruction.path.name]: string;
  [systemConfigFieldPathMap.instruction.skip.name]: boolean;
  [systemConfigFieldPathMap.instruction.showInOverrideMode.name]: boolean;
  [systemConfigFieldPathMap.instruction.showInQuickInstructionMode.name]: boolean;
}

export const instructionConfigSchema = z.object({
  [systemConfigFieldPathMap.instruction.path.name]: nonEmptyStringSchema,
  [systemConfigFieldPathMap.instruction.skip.name]: z.boolean(),
  [systemConfigFieldPathMap.instruction.showInOverrideMode.name]: z.boolean(),
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
