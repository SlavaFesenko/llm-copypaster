import { z } from 'zod';

export interface LlmCopypasterUserConfig {
  nonOverrideableSettings?: NonOverrideableSettingsUserConfig;
  coreSettings?: CoreSettingsUserConfig;
  overridesById?: Record<string, OverrideUserConfig>;
}

export interface NonOverrideableSettingsUserConfig {
  allowOutsideWorkspaceRead?: boolean;
  allowOutsideWorkspaceWrite?: boolean;
  vitalParsingAnchors?: VitalParsingAnchorsUserConfig;
}

export interface VitalParsingAnchorsUserConfig {
  PROMPT_DELIMITER_ANCHOR?: string;
  CODE_LISTING_HEADER_ANCHOR?: string;
  FILE_STATUS_ANCHOR?: string;
  FILE_EDITED_FULL_ANCHOR?: string;
  FILE_CREATED_ANCHOR?: string;
  FILE_DELETED_ANCHOR?: string;
  END_OF_OUTPUT_ANCHOR?: string | null;
}

export interface CoreSettingsUserConfig {
  skipInstructions?: boolean;
  skipCodeListings?: boolean;
  ideToLlm?: IdeToLlmUserConfig;
  llmToIde?: LlmToIdeUserConfig;
  postFilePatchActions?: PostFilePatchActionsUserConfig;
  instructionsAndVariables?: InstructionsAndVariablesUserConfig;
  llmToIdeSanitizationRulesById?: Record<string, LlmToIdeSanitizationRuleUserConfig>;
}

export interface PromptLimitsUserConfig {
  skipPromptSizeStatsInCopyNotification?: boolean;
  charsPerToken?: number;
  linesMaxToShowWarning?: number;
  tokensMaxToShowWarning?: number;
}

export interface IdeToLlmUserConfig extends PromptLimitsUserConfig {}

export interface LlmToIdeUserConfig extends PromptLimitsUserConfig {}

export interface PostFilePatchActionsUserConfig {
  enableSaveAfterFilePatch?: boolean;
  enableLintingAfterFilePatch?: boolean;
  enableOpeningPatchedFilesInEditor?: boolean;
}

export interface InstructionsAndVariablesUserConfig {
  instructionsById?: Record<string, InstructionUserConfig>;
  sharedVariablesById?: Record<string, unknown>;
  sharedReferenceVariablesById?: Record<string, string>;
}

export interface InstructionUserConfig {
  path?: string;
  skip?: boolean;
  showInOverrideMode?: boolean;
  showInQuickInstructionMode?: boolean;
}

export interface LlmToIdeSanitizationRuleUserConfig {
  regexPattern?: string;
  replaceWith?: string;
  skipForLanguages?: string[];
  skipForPaths?: string[];
}

export interface OverrideUserConfig {
  description?: string;
  version?: string;
  shouldBeSkipped?: boolean;
  coreSettings?: CoreSettingsUserConfig;
}

// This schema intentionally only enumerates allowed user-config JSON properties,
// so we can verify that the raw user-config JSONC file stays consistent with the TS contract
//
// All specific runtime type validation and business-rule validation must happen later
// on system config / merged config validation, so they should not be duplicated here
//
// Because of that, value nodes here intentionally use unknown/any-like placeholders
// whenever possible and only enforce the allowed object structure / property names
//
// overridesById is intentionally allowed on the root level here,
// but its internal validation will be handled separately
export const llmCopypasterUserConfigSchema = z
  .object({
    nonOverrideableSettings: z.lazy(() => nonOverrideableSettingsUserConfigSchema).optional(),
    coreSettings: z.lazy(() => coreSettingsUserConfigSchema).optional(),
    overridesById: z.unknown().optional(),
  })
  .strict();

export const nonOverrideableSettingsUserConfigSchema = z
  .object({
    allowOutsideWorkspaceRead: z.unknown().optional(),
    allowOutsideWorkspaceWrite: z.unknown().optional(),
    vitalParsingAnchors: z.lazy(() => vitalParsingAnchorsUserConfigSchema).optional(),
  })
  .strict();

export const coreSettingsUserConfigSchema = z
  .object({
    skipInstructions: z.unknown().optional(),
    skipCodeListings: z.unknown().optional(),
    ideToLlm: z.lazy(() => promptLimitsUserConfigSchema).optional(),
    llmToIde: z.lazy(() => promptLimitsUserConfigSchema).optional(),
    postFilePatchActions: z.lazy(() => postFilePatchActionsUserConfigSchema).optional(),
    instructionsAndVariables: z.lazy(() => instructionsAndVariablesUserConfigSchema).optional(),
    llmToIdeSanitizationRulesById: z
      .record(
        z.string(),
        z.lazy(() => llmToIdeSanitizationRuleUserConfigSchema)
      )
      .optional(),
  })
  .strict();

export const vitalParsingAnchorsUserConfigSchema = z
  .object({
    PROMPT_DELIMITER_ANCHOR: z.unknown().optional(),
    CODE_LISTING_HEADER_ANCHOR: z.unknown().optional(),
    FILE_STATUS_ANCHOR: z.unknown().optional(),
    FILE_EDITED_FULL_ANCHOR: z.unknown().optional(),
    FILE_CREATED_ANCHOR: z.unknown().optional(),
    FILE_DELETED_ANCHOR: z.unknown().optional(),
    END_OF_OUTPUT_ANCHOR: z.unknown().optional(),
  })
  .strict();

export const promptLimitsUserConfigSchema = z
  .object({
    skipPromptSizeStatsInCopyNotification: z.unknown().optional(),
    charsPerToken: z.unknown().optional(),
    linesMaxToShowWarning: z.unknown().optional(),
    tokensMaxToShowWarning: z.unknown().optional(),
  })
  .strict();

export const postFilePatchActionsUserConfigSchema = z
  .object({
    enableSaveAfterFilePatch: z.unknown().optional(),
    enableLintingAfterFilePatch: z.unknown().optional(),
    enableOpeningPatchedFilesInEditor: z.unknown().optional(),
  })
  .strict();

export const instructionsAndVariablesUserConfigSchema = z
  .object({
    instructionsById: z
      .record(
        z.string(),
        z.lazy(() => instructionUserConfigSchema)
      )
      .optional(),
    sharedVariablesById: z.record(z.string(), z.unknown()).optional(),
    sharedReferenceVariablesById: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const llmToIdeSanitizationRuleUserConfigSchema = z
  .object({
    regexPattern: z.unknown().optional(),
    replaceWith: z.unknown().optional(),
    skipForLanguages: z.unknown().optional(),
    skipForPaths: z.unknown().optional(),
  })
  .strict();

export const instructionUserConfigSchema = z
  .object({
    path: z.unknown().optional(),
    skip: z.unknown().optional(),
    showInOverrideMode: z.unknown().optional(),
    showInQuickInstructionMode: z.unknown().optional(),
  })
  .strict();
