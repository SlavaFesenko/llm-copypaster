import { z } from 'zod';
import {
  buildNullableVitalAnchorSchema,
  buildVitalAnchorSchema,
} from '../validation/static-rules/vital-parsing-anchors-rules';

const nonEmptyStringSchema = z.string().trim().min(1);
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const positiveFiniteNumberSchema = z.number().finite().positive();

export interface LlmCopypasterConfig {
  nonOverrideableSettings: NonOverrideableSettingsConfig;
  coreSettings: CoreSettingsConfig;
}

export const llmCopypasterConfigSchema = z.object({
  nonOverrideableSettings: z.lazy(() => nonOverrideableSettingsConfigSchema),
  coreSettings: z.lazy(() => coreSettingsConfigSchema),
}) satisfies z.ZodType<LlmCopypasterConfig>;

export interface NonOverrideableSettingsConfig {
  allowOutsideWorkspaceRead: boolean;
  allowOutsideWorkspaceWrite: boolean;
  vitalParsingAnchors: VitalParsingAnchorsConfig;
}

export const nonOverrideableSettingsConfigSchema = z.object({
  allowOutsideWorkspaceRead: z.boolean(),
  allowOutsideWorkspaceWrite: z.boolean(),
  vitalParsingAnchors: z.lazy(() => vitalParsingAnchorsConfigSchema),
}) satisfies z.ZodType<NonOverrideableSettingsConfig>;

export interface VitalParsingAnchorsConfig {
  PROMPT_DELIMITER_ANCHOR: string;
  CODE_LISTING_HEADER_ANCHOR: string;
  FILE_STATUS_ANCHOR: string;
  FILE_EDITED_FULL_ANCHOR: string;
  FILE_CREATED_ANCHOR: string;
  FILE_DELETED_ANCHOR: string;
  END_OF_OUTPUT_ANCHOR: string | null;
  CONFIG_REF_VAR_ANCHOR: string;
}

export const vitalParsingAnchorsConfigSchema = z.object({
  PROMPT_DELIMITER_ANCHOR: buildVitalAnchorSchema(),
  CODE_LISTING_HEADER_ANCHOR: buildVitalAnchorSchema(),
  FILE_STATUS_ANCHOR: buildVitalAnchorSchema(),
  FILE_EDITED_FULL_ANCHOR: buildVitalAnchorSchema(),
  FILE_CREATED_ANCHOR: buildVitalAnchorSchema(),
  FILE_DELETED_ANCHOR: buildVitalAnchorSchema(),
  END_OF_OUTPUT_ANCHOR: buildNullableVitalAnchorSchema(),
  CONFIG_REF_VAR_ANCHOR: buildVitalAnchorSchema(),
}) satisfies z.ZodType<VitalParsingAnchorsConfig>;

export interface CoreSettingsConfig {
  skipInstructions: boolean;
  skipCodeListings: boolean;
  ideToLlm: IdeToLlmConfig;
  llmToIde: LlmToIdeConfig;
  postFilePatchActions: PostFilePatchActionsConfig;
  instructionsAndVariables: InstructionsAndVariablesConfig;
  llmToIdeSanitizationRulesById: Record<string, LlmToIdeSanitizationRuleConfig>;
}

export const coreSettingsConfigSchema = z.object({
  skipInstructions: z.boolean(),
  skipCodeListings: z.boolean(),
  ideToLlm: z.lazy(() => ideToLlmConfigSchema),
  llmToIde: z.lazy(() => llmToIdeConfigSchema),
  postFilePatchActions: z.lazy(() => postFilePatchActionsConfigSchema),
  instructionsAndVariables: z.lazy(() => instructionsAndVariablesConfigSchema),
  llmToIdeSanitizationRulesById: z.record(
    z.string(),
    z.lazy(() => llmToIdeSanitizationRuleConfigSchema)
  ),
}) satisfies z.ZodType<CoreSettingsConfig>;

export interface PromptLimitsConfig {
  skipPromptSizeStatsInCopyNotification: boolean;
  charsPerToken: number;
  linesMaxToShowWarning: number;
  tokensMaxToShowWarning: number;
}

export const promptLimitsConfigSchema = z.object({
  skipPromptSizeStatsInCopyNotification: z.boolean(),
  charsPerToken: positiveFiniteNumberSchema,
  linesMaxToShowWarning: nonNegativeIntegerSchema,
  tokensMaxToShowWarning: nonNegativeIntegerSchema,
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
  enableSaveAfterFilePatch: z.boolean(),
  enableLintingAfterFilePatch: z.boolean(),
  enableOpeningPatchedFilesInEditor: z.boolean(),
}) satisfies z.ZodType<PostFilePatchActionsConfig>;

export interface InstructionsAndVariablesConfig {
  instructionsById: Record<string, InstructionConfig>;
  sharedVariablesById: Record<string, string>;
}

export const instructionsAndVariablesConfigSchema = z.object({
  instructionsById: z.record(
    z.string(),
    z.lazy(() => instructionConfigSchema)
  ),
  sharedVariablesById: z.record(z.string(), z.string()),
}) satisfies z.ZodType<InstructionsAndVariablesConfig>;

export interface InstructionConfig {
  path: string;
  skip: boolean;
  showInOverrideMode: boolean;
  showInQuickInstructionMode: boolean;
}

export const instructionConfigSchema = z.object({
  path: nonEmptyStringSchema,
  skip: z.boolean(),
  showInOverrideMode: z.boolean(),
  showInQuickInstructionMode: z.boolean(),
}) satisfies z.ZodType<InstructionConfig>;

export interface LlmToIdeSanitizationRuleConfig {
  regexPattern: string;
  replaceWith: string;
  skipForLanguages: string[];
  skipForPaths: string[];
}

export const llmToIdeSanitizationRuleConfigSchema = z.object({
  regexPattern: nonEmptyStringSchema,
  replaceWith: z.string(),
  skipForLanguages: z.array(nonEmptyStringSchema),
  skipForPaths: z.array(nonEmptyStringSchema),
}) satisfies z.ZodType<LlmToIdeSanitizationRuleConfig>;
