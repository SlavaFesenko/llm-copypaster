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
  // if true - remove all base stuff, then (if needed) add override stuff (to avoid need of manual iteration of all base stuff)
  onMergeIgnoreAll_sharedVariablesById?: boolean;
  sharedVariablesById?: Record<string, string>;

  // if true - remove all base stuff, then (if needed) add override stuff (to avoid need of manual iteration of all base stuff)
  onMergeIgnoreAll_subInstructionsById?: boolean;
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

  // if true - remove all base stuff, then (if needed) add override stuff (to avoid need of manual iteration of all base stuff)
  onMergeIgnoreAll_llmToIdeSanitizationRulesById?: boolean;
  llmToIdeSanitizationRulesById?: Record<string, LlmToIdeSanitizationRuleUserConfig>;
}

export interface OverrideUserConfig {
  description?: string;
  version?: string;
  coreSettings?: CoreSettingsUserConfig;
}

export interface LlmCopypasterUserConfig {
  vitalParsingAnchors?: VitalParsingAnchorsUserConfig;
  coreSettings?: CoreSettingsUserConfig;

  // if true - remove all base stuff, then (if needed) add override stuff (to avoid need of manual iteration of all base stuff)
  onMergeIgnoreAll_overridesById?: boolean;
  overridesById?: Record<string, OverrideUserConfig>;
}
