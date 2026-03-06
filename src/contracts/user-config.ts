export interface PromptInstructionsUserConfig {
  relativePathToSubInstruction?: string;
  ignore?: boolean;
}

export interface VitalParsingAnchorsUserConfig {
  techPromptDelimiter?: string;
  codeListingHeaderStartFragment?: string;
  fileStatusPrefix?: string;
  placeholderStartFragment?: string;
  placeholderEndFragment?: string;
  filePayloadOperationTypeEditedFull?: string;
  filePayloadOperationTypeCreated?: string;
  filePayloadOperationTypeDeleted?: string;
  configVariablePrefix: string;
}

export interface PromptInstructionUserConfig {
  sharedVariablesById?: Record<string, string>;
  subInstructionsById?: Record<string, PromptInstructionsUserConfig>;
}

export interface LlmToIdeSanitizationRuleUserConfig {
  pattern?: string;
  replaceWith?: string;
  disabledForLanguages?: string[];
  disabledForPaths?: string[];
}

export interface IdeToLlmContextUserConfig {
  skipPromptSizeStatsInCopyNotification?: boolean;
  promptSizeApproxCharsPerToken?: number;
  maxLinesCountInContext?: number;
  maxTokensCountInContext?: number;
}

export interface LlmToIdeContextUserConfig {
  promptSizeApproxCharsPerToken?: number;
  maxLinesCountInContext?: number;
  maxTokensCountInContext?: number;
}

export interface PostFilePatchActionsUserConfig {
  enableSaveAfterFilePatch?: boolean;
  enableLintingAfterFilePatch?: boolean;
  enableOpeningPatchedFilesInEditor?: boolean;
}

export interface CoreSettingsUserConfig {
  skipInstructions?: boolean;
  skipCodeListings?: boolean;

  ideToLlmContextConfig?: IdeToLlmContextUserConfig;
  llmToIdeContextConfig?: LlmToIdeContextUserConfig;
  postFilePatchActionsConfig?: PostFilePatchActionsUserConfig;

  promptInstructionConfig?: PromptInstructionUserConfig;
  llmToIdeSanitizationRulesById?: Record<string, LlmToIdeSanitizationRuleUserConfig>;
}

export interface OverrideUserConfig {
  description?: string;
  version?: string;
  shouldBeSkipped?: boolean;
  coreSettings?: CoreSettingsUserConfig;
}

export interface LlmCopypasterUserConfig {
  vitalParsingAnchors?: VitalParsingAnchorsUserConfig;
  coreSettings?: CoreSettingsUserConfig;
  overridesById?: Record<string, OverrideUserConfig>;
}
