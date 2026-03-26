export interface LlmCopypasterUserConfig {
  nonOverrideableSettings?: NonOverrideableSettingsUserConfig;
  coreSettings?: CoreSettingsUserConfig;
  overridesById?: Record<string, OverrideUserConfig>;
}

export interface NonOverrideableSettingsUserConfig {
  allowOutsideWorkspaceRead?: boolean;
  allowOutsideWorkspaceWrite?: boolean;
  shouldAskConfirmationIfOutsideWorkspaceWriteAllowed?: boolean;
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
  CONFIG_REF_VAR_ANCHOR?: string;
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
  sharedVariablesById?: Record<string, string>;
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
