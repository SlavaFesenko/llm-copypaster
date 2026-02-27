export interface PromptInstructionsUserConfig {
  relativePathToSubInstruction?: string;
  ignore?: boolean;
}

export interface LlmToIdeParsingAnchorsUserConfig {
  techPromptDelimiter?: string;
  codeListingHeaderStartFragment?: string;
  fileStatusPrefix?: string;
  placeholderStartFragment?: string;
  placeholderEndFragment?: string;
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

export interface PostFilePatchActionsUserConfig {
  enableSaveAfterFilePatch?: boolean;
  enableLintingAfterFilePatch?: boolean;
  enableOpeningPatchedFilesInEditor?: boolean;
}

export interface ProfileSettingsUserConfig {
  skipTechPrompt?: boolean;
  skipCodeListings?: boolean;

  ideToLlmContextConfig?: IdeToLlmContextUserConfig;
  postFilePatchActionsConfig?: PostFilePatchActionsUserConfig;

  promptInstructionConfig?: PromptInstructionUserConfig;

  // if true - remove all base stuff, then (if needed) add override stuff (to avoid need of manual iteration of all base stuff)
  onMergeIgnoreAll_llmToIdeSanitizationRulesById?: boolean;
  llmToIdeSanitizationRulesById?: Record<string, LlmToIdeSanitizationRuleUserConfig>;
}

export interface ProfileUserConfig {
  description?: string;
  version?: string;
  profileSettingsConfig?: ProfileSettingsUserConfig;
}

export interface LlmCopypasterUserConfig {
  llmToIdeParsingAnchors?: LlmToIdeParsingAnchorsUserConfig;
  baseSettings?: ProfileSettingsUserConfig;

  // if true - remove all base stuff, then (if needed) add override stuff (to avoid need of manual iteration of all base stuff)
  onMergeIgnoreAll_profilesById?: boolean;
  profilesById?: Record<string, ProfileUserConfig>;
}
