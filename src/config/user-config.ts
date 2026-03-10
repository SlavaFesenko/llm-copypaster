export interface InstructionUserConfig {
  path?: string;
  skip?: boolean;
}

export interface VitalParsingAnchorsUserConfig {
  PROMPT_DELIMITER_ANCHOR?: string;
  CODE_LISTING_HEADER_ANCHOR?: string;
  FILE_STATUS_ANCHOR?: string;
  FILE_EDITED_FULL_ANCHOR?: string;
  FILE_CREATED_ANCHOR?: string;
  FILE_DELETED_ANCHOR?: string;
  CONFIG_REF_VAR_ANCHOR?: string;

  // old names for reference
  // techPromptDelimiter?: string;
  // codeListingHeaderStartFragment?: string;
  // fileStatusPrefix?: string;
  // filePayloadOperationTypeEditedFull?: string;
  // filePayloadOperationTypeCreated?: string;
  // filePayloadOperationTypeDeleted?: string;
  // configVariablePrefix?: string;
}

export interface InstructionsAndVariablesUserConfig {
  instructionsById?: Record<string, InstructionUserConfig>;
  sharedVariablesById?: Record<string, string>;

  // old names for reference
  // subInstructionsById?: Record<string, PromptInstructionsUserConfig>;
}

export interface LlmToIdeSanitizationRuleUserConfig {
  regexPattern?: string;
  replaceWith?: string;
  skipForLanguages?: string[];
  skipForPaths?: string[];

  // old names for reference
  // pattern?: string;
  // disabledForLanguages?: string[];
  // disabledForPaths?: string[];
}

export interface PromptLimitsUserConfig {
  skipPromptSizeStatsInCopyNotification?: boolean;
  charsPerToken?: number;
  linesMaxToShowWarning?: number;
  tokensMaxToShowWarning?: number;

  // old names for reference
  // promptSizeApproxCharsPerToken?: number;
  // maxLinesCountInContext?: number;
  // maxTokensCountInContext?: number;
}

export interface IdeToLlmUserConfig extends PromptLimitsUserConfig {}

export interface LlmToIdeUserConfig extends PromptLimitsUserConfig {}

export interface PostFilePatchActionsUserConfig {
  enableSaveAfterFilePatch?: boolean;
  enableLintingAfterFilePatch?: boolean;
  enableOpeningPatchedFilesInEditor?: boolean;
}

export interface CoreSettingsUserConfig {
  skipInstructions?: boolean;
  skipCodeListings?: boolean;

  ideToLlm?: IdeToLlmUserConfig;
  llmToIde?: LlmToIdeUserConfig;
  postFilePatchActions?: PostFilePatchActionsUserConfig;
  instructionsAndVariables?: InstructionsAndVariablesUserConfig;
  llmToIdeSanitizationRulesById?: Record<string, LlmToIdeSanitizationRuleUserConfig>;

  // old names for reference
  // ideToLlmConfig?: IdeToLlmContextUserConfig;
  // llmToIdeConfig?: LlmToIdeContextUserConfig;
  // postFilePatchActionsConfig?: PostFilePatchActionsUserConfig;
  // promptInstructionConfig?: PromptInstructionUserConfig;
}

export interface OverrideUserConfig {
  description?: string;
  version?: string;
  shouldBeSkipped?: boolean;
  coreSettings?: CoreSettingsUserConfig;

  // old names for reference
  // coreSettingsConfig?: CoreSettingsUserConfig;
}

export interface LlmCopypasterUserConfig {
  vitalParsingAnchors?: VitalParsingAnchorsUserConfig;
  coreSettings?: CoreSettingsUserConfig;
  overridesById?: Record<string, OverrideUserConfig>;

  // old names for reference
  // coreSettingsConfig?: CoreSettingsUserConfig;
}
