export interface LlmCopypasterConfig {
  vitalParsingAnchors: VitalParsingAnchorsConfig;
  coreSettings: CoreSettingsConfig;
}

// ex PromptInstructionsConfig
export interface InstructionConfig {
  path: string; // ex relativePathToSubInstruction
  skip: boolean; // ex ignore
}

export interface VitalParsingAnchorsConfig {
  PROMPT_DELIMITER_ANCHOR: string; // ex techPromptDelimiter
  CODE_LISTING_HEADER_ANCHOR: string; // ex codeListingHeaderStartFragment
  FILE_STATUS_ANCHOR: string; // ex fileStatusPrefix
  FILE_EDITED_FULL_ANCHOR: string; // ex filePayloadOperationTypeEditedFull
  FILE_CREATED_ANCHOR: string; // ex filePayloadOperationTypeCreated
  FILE_DELETED_ANCHOR: string; // ex filePayloadOperationTypeDeleted
  CONFIG_REF_VAR_ANCHOR: string; // ex configVariablePrefix
}

export interface InstructionsAndVariablesConfig {
  instructionsById: Record<string, InstructionConfig>; // ex subInstructionsById
  sharedVariablesById: Record<string, string>;
}

export interface LlmToIdeSanitizationRuleConfig {
  regexPattern: string; // ex pattern
  replaceWith: string;
  skipForLanguages: string[]; // ex disableForLanguages
  skipForPaths: string[]; // ex disableForPaths
}

export interface PromptLimitsConfig {
  skipPromptSizeStatsInCopyNotification: boolean;
  charsPerToken: number;
  linesMaxToShowWarning: number;
  tokensMaxToShowWarning: number;
}

// ex IdeToLlmContextConfig
export interface IdeToLlmConfig extends PromptLimitsConfig {}

// ex LlmToIdeContextConfig
export interface LlmToIdeConfig extends PromptLimitsConfig {}

export interface PostFilePatchActionsConfig {
  enableSaveAfterFilePatch: boolean;
  enableLintingAfterFilePatch: boolean;
  enableOpeningPatchedFilesInEditor: boolean;
}

export interface CoreSettingsConfig {
  skipInstructions: boolean;
  skipCodeListings: boolean;
  ideToLlm: IdeToLlmConfig; // ex ideToLlmContextConfig
  llmToIde: LlmToIdeConfig; // ex llmToIdeContextConfig
  postFilePatchActions: PostFilePatchActionsConfig; // ex postFilePatchActionsConfig
  instructionsAndVariables: InstructionsAndVariablesConfig; // ex promptInstructionConfig
  llmToIdeSanitizationRulesById: Record<string, LlmToIdeSanitizationRuleConfig>;
}
