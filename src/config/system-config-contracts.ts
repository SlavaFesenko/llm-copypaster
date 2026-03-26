export interface LlmCopypasterConfig {
  nonOverrideableSettings: NonOverrideableSettingsConfig;
  coreSettings: CoreSettingsConfig;
}

export interface NonOverrideableSettingsConfig {
  allowOutsideWorkspaceRead: boolean;
  allowOutsideWorkspaceWrite: boolean;
  shouldAskConfirmationIfOutsideWorkspaceWriteAllowed: boolean;
  vitalParsingAnchors: VitalParsingAnchorsConfig;
}

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

export interface CoreSettingsConfig {
  skipInstructions: boolean;
  skipCodeListings: boolean;
  ideToLlm: IdeToLlmConfig;
  llmToIde: LlmToIdeConfig;
  postFilePatchActions: PostFilePatchActionsConfig;
  instructionsAndVariables: InstructionsAndVariablesConfig;
  llmToIdeSanitizationRulesById: Record<string, LlmToIdeSanitizationRuleConfig>;
}

export interface PromptLimitsConfig {
  skipPromptSizeStatsInCopyNotification: boolean;
  charsPerToken: number;
  linesMaxToShowWarning: number;
  tokensMaxToShowWarning: number;
}

export interface IdeToLlmConfig extends PromptLimitsConfig {}

export interface LlmToIdeConfig extends PromptLimitsConfig {}

export interface PostFilePatchActionsConfig {
  enableSaveAfterFilePatch: boolean;
  enableLintingAfterFilePatch: boolean;
  enableOpeningPatchedFilesInEditor: boolean;
}

export interface InstructionsAndVariablesConfig {
  instructionsById: Record<string, InstructionConfig>;
  sharedVariablesById: Record<string, string>;
}

export interface InstructionConfig {
  path: string;
  skip: boolean;
  showInOverrideMode: boolean;
  showInQuickInstructionMode: boolean;
}

export interface LlmToIdeSanitizationRuleConfig {
  regexPattern: string;
  replaceWith: string;
  skipForLanguages: string[];
  skipForPaths: string[];
}
