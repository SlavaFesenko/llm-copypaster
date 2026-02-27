import * as vscode from 'vscode';

import { OutputChannelLogger } from './utils/output-channel-logger';

export const LLM_RESPONSE_RULES_PROMPT_ID = 'llm-response-rules';
export const WEB_GIT_PROMPT_ID = 'web-git-prompt';

export interface PromptInstructionsConfig {
  relativePathToSubInstruction: string;
  skipSubInstruction: boolean;
}

export interface PromptInstructionsUserConfig {
  relativePathToSubInstruction?: string;
  skipSubInstruction?: boolean;
}

export interface LlmToIdeParsingAnchorsConfig {
  techPromptDelimiter: string;
  codeListingHeaderStartFragment: string;
  codeListingHeaderStartFragmentWithSpace: string;
  codeListingHeaderRegex: string;
  placeholderRegexPattern: string;
  fileStatusPrefix: string;
}

export interface LlmToIdeParsingAnchorsUserConfig {
  techPromptDelimiter?: string;
  codeListingHeaderStartFragment?: string;
  codeListingHeaderStartFragmentWithSpace?: string;
  codeListingHeaderRegex?: string;
  placeholderRegexPattern?: string;
  fileStatusPrefix?: string;
}

export interface PromptInstructionConfig {
  sharedVariablesById: Record<string, string>;
  subInstructionsById: Record<string, PromptInstructionsConfig>;
}

export interface PromptInstructionUserConfig {
  // if true - remove all base stuff, then (if needed) add override stuff (to avoid need of manual iteration of all base stuff)
  onMergeIgnoreAll_sharedVariablesById?: boolean;
  sharedVariablesById?: Record<string, string>;

  // if true - remove all base stuff, then (if needed) add override stuff (to avoid need of manual iteration of all base stuff)
  onMergeIgnoreAll_subInstructionsById?: boolean;
  subInstructionsById?: Record<string, PromptInstructionsUserConfig>;
}

export interface LlmToIdeSanitizationRuleConfig {
  pattern: string;
  replaceWith: string;
  disabledForLanguages: string[];
  disabledForPaths: string[];
}

export interface LlmToIdeSanitizationRuleUserConfig {
  pattern?: string;
  replaceWith?: string;
  disabledForLanguages?: string[];
  disabledForPaths?: string[];
}

export interface IdeToLlmContextConfig {
  skipPromptSizeStatsInCopyNotification: boolean;
  promptSizeApproxCharsPerToken: number;
  maxLinesCountInContext: number;
  maxTokensCountInContext: number;
}

export interface IdeToLlmContextUserConfig {
  skipPromptSizeStatsInCopyNotification?: boolean;
  promptSizeApproxCharsPerToken?: number;
  maxLinesCountInContext?: number;
  maxTokensCountInContext?: number;
}

export interface PostFilePatchActionsConfig {
  enableSaveAfterFilePatch: boolean;
  enableLintingAfterFilePatch: boolean;
  enableOpeningPatchedFilesInEditor: boolean;
}

export interface PostFilePatchActionsUserConfig {
  enableSaveAfterFilePatch?: boolean;
  enableLintingAfterFilePatch?: boolean;
  enableOpeningPatchedFilesInEditor?: boolean;
}

export interface ProfileSettingsConfig {
  skipTechPrompt: boolean;
  skipCodeListings: boolean;
  ideToLlmContextConfig: IdeToLlmContextConfig;
  postFilePatchActionsConfig: PostFilePatchActionsConfig;
  promptInstructionConfig: Partial<PromptInstructionConfig>;
  llmToIdeSanitizationRulesById: Record<string, LlmToIdeSanitizationRuleConfig>;
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

export interface ProfileConfig {
  description: string;
  version: string;
  profileSettingsConfig: Partial<ProfileSettingsConfig>;
}

export interface ProfileUserConfig {
  description?: string;
  version?: string;
  profileSettingsConfig?: ProfileSettingsUserConfig;
}

export interface LlmCopypasterConfig {
  llmToIdeParsingAnchors: LlmToIdeParsingAnchorsConfig; // profile-agnostic settings as they have to be singleton
  baseSettings: ProfileSettingsConfig; // this settings may be overwritten ONLY IN RUNTIME by some of profiles['name'].profileSettingsConfig
  profilesById: Record<string, ProfileConfig>;
}

export interface LlmCopypasterUserConfig {
  llmToIdeParsingAnchors?: LlmToIdeParsingAnchorsUserConfig;
  baseSettings?: ProfileSettingsUserConfig;

  // if true - remove all base stuff, then (if needed) add override stuff (to avoid need of manual iteration of all base stuff)
  onMergeIgnoreAll_profilesById?: boolean;
  profilesById?: Record<string, ProfileUserConfig>;
}

export function buildBaseSettings(): ProfileSettingsConfig {
  return {
    skipTechPrompt: false,
    skipCodeListings: false,
    ideToLlmContextConfig: {
      skipPromptSizeStatsInCopyNotification: false,
      promptSizeApproxCharsPerToken: 3.5,
      maxLinesCountInContext: 1000,
      maxTokensCountInContext: 12000,
    },
    llmToIdeSanitizationRulesById: {},
    postFilePatchActionsConfig: {
      enableSaveAfterFilePatch: true,
      enableLintingAfterFilePatch: false, // if settings have "editor.formatOnSave": true, no need to do it again
      enableOpeningPatchedFilesInEditor: true,
    },

    promptInstructionConfig: {
      subInstructionsById: {
        [LLM_RESPONSE_RULES_PROMPT_ID]: {
          relativePathToSubInstruction: 'prompts/llm-response-rules-prompt.md',
          skipSubInstruction: false,
        },
        [WEB_GIT_PROMPT_ID]: {
          relativePathToSubInstruction: 'prompts/web-git-prompt.md',
          skipSubInstruction: false,
        },
      },
      sharedVariablesById: {
        BRANCH_NAME: 'master',
        RAW_GITHUB_BASE_URL: 'https://raw.githubusercontent.com/',
        BLOB_GITHUB_BASE_URL: 'https://github.com/',
        AUTHOR_REPO: 'SlavaFesenko/llm-copypaster/',
        WEB_GIT_PROMPT_NAME: 'Web Git Prompt',
      },
    },
  };
}

export function buildLlmCopypasterConfig(): LlmCopypasterConfig {
  // such symbols selected to highlight file-header in LLM-interface + to be quite unique
  const codeListingHeaderStartFragmentSymbols = '## LLM-CPP-FILE:';

  return {
    llmToIdeParsingAnchors: {
      techPromptDelimiter: '--' + '-',
      codeListingHeaderStartFragment: codeListingHeaderStartFragmentSymbols,
      codeListingHeaderStartFragmentWithSpace: codeListingHeaderStartFragmentSymbols + ' ',
      codeListingHeaderRegex: String.raw`^${codeListingHeaderStartFragmentSymbols}\s+(.+)\s*$`,
      placeholderRegexPattern: String.raw`{{([a-zA-Z0-9*_]+)}}`, // {{placeholder}}
      fileStatusPrefix: '#### FILE WAS ',
    },
    baseSettings: buildBaseSettings(),
    profilesById: {},
  };
}

export class ConfigService {
  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _logger: OutputChannelLogger
  ) {}

  public async getConfig(): Promise<LlmCopypasterConfig> {
    const defaultConfig = buildLlmCopypasterConfig();

    const settingsConfig = this._readSettingsConfig();
    const fileConfig = await this._readWorkspaceJsonConfigFile(this._logger);

    const mergedConfig = this._mergeConfigs(defaultConfig, settingsConfig, fileConfig);

    return mergedConfig;
  }

  private _mergeConfigs(
    defaultConfig: LlmCopypasterConfig,
    settingsConfig: LlmCopypasterUserConfig,
    fileConfig: LlmCopypasterUserConfig | null
  ): LlmCopypasterConfig {
    const mergedWithSettings = this._applyUserConfig(defaultConfig, settingsConfig);
    if (!fileConfig) return mergedWithSettings;

    return this._applyUserConfig(mergedWithSettings, fileConfig);
  }

  private _applyUserConfig(baseConfig: LlmCopypasterConfig, userConfig: LlmCopypasterUserConfig): LlmCopypasterConfig {
    const nextConfig: LlmCopypasterConfig = {
      llmToIdeParsingAnchors: this._mergeLlmToIdeParsingAnchors(
        baseConfig.llmToIdeParsingAnchors,
        userConfig.llmToIdeParsingAnchors
      ),
      baseSettings: this._mergeProfileSettingsConfig(baseConfig.baseSettings, userConfig.baseSettings),
      profilesById: this._mergeProfilesById(baseConfig.profilesById, userConfig),
    };

    return nextConfig;
  }

  private _mergeLlmToIdeParsingAnchors(
    baseAnchors: LlmToIdeParsingAnchorsConfig,
    userAnchors: LlmToIdeParsingAnchorsUserConfig | undefined
  ): LlmToIdeParsingAnchorsConfig {
    if (!userAnchors) return baseAnchors;

    return {
      techPromptDelimiter: userAnchors.techPromptDelimiter ?? baseAnchors.techPromptDelimiter,
      codeListingHeaderStartFragment:
        userAnchors.codeListingHeaderStartFragment ?? baseAnchors.codeListingHeaderStartFragment,
      codeListingHeaderStartFragmentWithSpace:
        userAnchors.codeListingHeaderStartFragmentWithSpace ?? baseAnchors.codeListingHeaderStartFragmentWithSpace,
      codeListingHeaderRegex: userAnchors.codeListingHeaderRegex ?? baseAnchors.codeListingHeaderRegex,
      placeholderRegexPattern: userAnchors.placeholderRegexPattern ?? baseAnchors.placeholderRegexPattern,
      fileStatusPrefix: userAnchors.fileStatusPrefix ?? baseAnchors.fileStatusPrefix,
    };
  }

  private _mergeProfileSettingsConfig(
    baseSettings: ProfileSettingsConfig,
    userSettings: ProfileSettingsUserConfig | undefined
  ): ProfileSettingsConfig {
    if (!userSettings) return baseSettings;

    const nextSettings: ProfileSettingsConfig = {
      skipTechPrompt: userSettings.skipTechPrompt ?? baseSettings.skipTechPrompt,
      skipCodeListings: userSettings.skipCodeListings ?? baseSettings.skipCodeListings,
      ideToLlmContextConfig: this._mergeIdeToLlmContextConfig(
        baseSettings.ideToLlmContextConfig,
        userSettings.ideToLlmContextConfig
      ),
      postFilePatchActionsConfig: this._mergePostFilePatchActionsConfig(
        baseSettings.postFilePatchActionsConfig,
        userSettings.postFilePatchActionsConfig
      ),
      promptInstructionConfig: this._mergePromptInstructionConfig(
        baseSettings.promptInstructionConfig,
        userSettings.promptInstructionConfig
      ),
      llmToIdeSanitizationRulesById: this._mergeLlmToIdeSanitizationRulesById(
        baseSettings.llmToIdeSanitizationRulesById,
        userSettings
      ),
    };

    return nextSettings;
  }

  private _mergeIdeToLlmContextConfig(
    baseConfig: IdeToLlmContextConfig,
    userConfig: IdeToLlmContextUserConfig | undefined
  ): IdeToLlmContextConfig {
    if (!userConfig) return baseConfig;

    return {
      skipPromptSizeStatsInCopyNotification:
        userConfig.skipPromptSizeStatsInCopyNotification ?? baseConfig.skipPromptSizeStatsInCopyNotification,
      promptSizeApproxCharsPerToken: userConfig.promptSizeApproxCharsPerToken ?? baseConfig.promptSizeApproxCharsPerToken,
      maxLinesCountInContext: userConfig.maxLinesCountInContext ?? baseConfig.maxLinesCountInContext,
      maxTokensCountInContext: userConfig.maxTokensCountInContext ?? baseConfig.maxTokensCountInContext,
    };
  }

  private _mergePostFilePatchActionsConfig(
    baseConfig: PostFilePatchActionsConfig,
    userConfig: PostFilePatchActionsUserConfig | undefined
  ): PostFilePatchActionsConfig {
    if (!userConfig) return baseConfig;

    return {
      enableSaveAfterFilePatch: userConfig.enableSaveAfterFilePatch ?? baseConfig.enableSaveAfterFilePatch,
      enableLintingAfterFilePatch: userConfig.enableLintingAfterFilePatch ?? baseConfig.enableLintingAfterFilePatch,
      enableOpeningPatchedFilesInEditor:
        userConfig.enableOpeningPatchedFilesInEditor ?? baseConfig.enableOpeningPatchedFilesInEditor,
    };
  }

  private _mergePromptInstructionConfig(
    baseConfig: Partial<PromptInstructionConfig>,
    userConfig: PromptInstructionUserConfig | undefined
  ): Partial<PromptInstructionConfig> {
    if (!userConfig) return baseConfig;

    const baseSharedVariablesById = baseConfig.sharedVariablesById ?? {};
    const baseSubInstructionsById = baseConfig.subInstructionsById ?? {};

    const nextSharedVariablesById = userConfig.onMergeIgnoreAll_sharedVariablesById
      ? (userConfig.sharedVariablesById ?? {})
      : { ...baseSharedVariablesById, ...(userConfig.sharedVariablesById ?? {}) };

    const nextSubInstructionsById = userConfig.onMergeIgnoreAll_subInstructionsById
      ? this._mapSubInstructionsById({}, userConfig.subInstructionsById ?? {})
      : this._mapSubInstructionsById(baseSubInstructionsById, userConfig.subInstructionsById ?? {});

    return {
      sharedVariablesById: nextSharedVariablesById,
      subInstructionsById: nextSubInstructionsById,
    };
  }

  private _mapSubInstructionsById(
    baseSubInstructionsById: Record<string, PromptInstructionsConfig>,
    userSubInstructionsById: Record<string, PromptInstructionsUserConfig>
  ): Record<string, PromptInstructionsConfig> {
    const nextSubInstructionsById: Record<string, PromptInstructionsConfig> = { ...baseSubInstructionsById };

    for (const subInstructionId of Object.keys(userSubInstructionsById)) {
      const baseSubInstruction = baseSubInstructionsById[subInstructionId];
      const userSubInstruction = userSubInstructionsById[subInstructionId];

      if (!baseSubInstruction) {
        if (!userSubInstruction.relativePathToSubInstruction || userSubInstruction.skipSubInstruction === undefined)
          continue;

        nextSubInstructionsById[subInstructionId] = {
          relativePathToSubInstruction: userSubInstruction.relativePathToSubInstruction,
          skipSubInstruction: userSubInstruction.skipSubInstruction,
        };

        continue;
      }

      nextSubInstructionsById[subInstructionId] = {
        relativePathToSubInstruction:
          userSubInstruction.relativePathToSubInstruction ?? baseSubInstruction.relativePathToSubInstruction,
        skipSubInstruction: userSubInstruction.skipSubInstruction ?? baseSubInstruction.skipSubInstruction,
      };
    }

    return nextSubInstructionsById;
  }

  private _mergeLlmToIdeSanitizationRulesById(
    baseRulesById: Record<string, LlmToIdeSanitizationRuleConfig>,
    userSettings: ProfileSettingsUserConfig
  ): Record<string, LlmToIdeSanitizationRuleConfig> {
    const userRulesById = userSettings.llmToIdeSanitizationRulesById;
    if (!userRulesById) return baseRulesById;

    if (userSettings.onMergeIgnoreAll_llmToIdeSanitizationRulesById)
      return this._mapLlmToIdeSanitizationRulesById({}, userRulesById);

    return this._mapLlmToIdeSanitizationRulesById(baseRulesById, userRulesById);
  }

  private _mapLlmToIdeSanitizationRulesById(
    baseRulesById: Record<string, LlmToIdeSanitizationRuleConfig>,
    userRulesById: Record<string, LlmToIdeSanitizationRuleUserConfig>
  ): Record<string, LlmToIdeSanitizationRuleConfig> {
    const nextRulesById: Record<string, LlmToIdeSanitizationRuleConfig> = { ...baseRulesById };

    for (const ruleId of Object.keys(userRulesById)) {
      const baseRule = baseRulesById[ruleId];
      const userRule = userRulesById[ruleId];

      if (!baseRule) {
        if (
          !userRule.pattern ||
          userRule.replaceWith === undefined ||
          !userRule.disabledForLanguages ||
          !userRule.disabledForPaths
        )
          continue;

        nextRulesById[ruleId] = {
          pattern: userRule.pattern,
          replaceWith: userRule.replaceWith,
          disabledForLanguages: userRule.disabledForLanguages,
          disabledForPaths: userRule.disabledForPaths,
        };

        continue;
      }

      nextRulesById[ruleId] = {
        pattern: userRule.pattern ?? baseRule.pattern,
        replaceWith: userRule.replaceWith ?? baseRule.replaceWith,
        disabledForLanguages: userRule.disabledForLanguages ?? baseRule.disabledForLanguages,
        disabledForPaths: userRule.disabledForPaths ?? baseRule.disabledForPaths,
      };
    }

    return nextRulesById;
  }

  private _mergeProfilesById(
    baseProfilesById: Record<string, ProfileConfig>,
    userConfig: LlmCopypasterUserConfig
  ): Record<string, ProfileConfig> {
    const userProfilesById = userConfig.profilesById;
    if (!userProfilesById) return baseProfilesById;

    if (userConfig.onMergeIgnoreAll_profilesById) return this._mapProfilesById({}, userProfilesById);

    return this._mapProfilesById(baseProfilesById, userProfilesById);
  }

  private _mapProfilesById(
    baseProfilesById: Record<string, ProfileConfig>,
    userProfilesById: Record<string, ProfileUserConfig>
  ): Record<string, ProfileConfig> {
    const nextProfilesById: Record<string, ProfileConfig> = { ...baseProfilesById };

    for (const profileId of Object.keys(userProfilesById)) {
      const baseProfile = baseProfilesById[profileId];
      const userProfile = userProfilesById[profileId];

      if (!baseProfile) {
        if (!userProfile.description || !userProfile.version) continue;

        nextProfilesById[profileId] = {
          description: userProfile.description,
          version: userProfile.version,
          profileSettingsConfig: userProfile.profileSettingsConfig
            ? this._mergeProfileSettingsConfig(buildBaseSettings(), userProfile.profileSettingsConfig)
            : {},
        };

        continue;
      }

      nextProfilesById[profileId] = {
        description: userProfile.description ?? baseProfile.description,
        version: userProfile.version ?? baseProfile.version,
        profileSettingsConfig: userProfile.profileSettingsConfig
          ? this._mergeProfileSettingsConfig(
              { ...buildBaseSettings(), ...baseProfile.profileSettingsConfig } as ProfileSettingsConfig,
              userProfile.profileSettingsConfig
            )
          : baseProfile.profileSettingsConfig,
      };
    }

    return nextProfilesById;
  }

  private _readSettingsConfig(): LlmCopypasterUserConfig {
    return {};
  }

  private async _readWorkspaceJsonConfigFile(logger: OutputChannelLogger): Promise<LlmCopypasterUserConfig | null> {
    const workspaceConfigFileName = 'llm-copypaster.config.jsonc';

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
      return null;
    }

    const configUri = vscode.Uri.joinPath(workspaceFolder.uri, workspaceConfigFileName);

    try {
      const bytes = await vscode.workspace.fs.readFile(configUri);
      const jsonText = Buffer.from(bytes).toString('utf8');
      const jsonTextWithoutComments = this._stripJsoncComments(jsonText);
      const jsonTextWithoutTrailingCommas = this._stripJsoncTrailingCommas(jsonTextWithoutComments);
      const parsed = JSON.parse(jsonTextWithoutTrailingCommas) as LlmCopypasterUserConfig;

      return parsed;
    } catch (error) {
      logger.debug(`Workspace config not loaded: ${String(error)}`);
      return null;
    }
  }

  private _stripJsoncComments(jsonText: string): string {
    let result = '';

    let isInsideString = false;
    let isEscaped = false;

    let isInsideLineComment = false;
    let isInsideBlockComment = false;

    for (let index = 0; index < jsonText.length; index++) {
      const currentChar = jsonText[index];
      const nextChar = index + 1 < jsonText.length ? jsonText[index + 1] : '';

      if (isInsideLineComment) {
        if (currentChar === '\n') {
          isInsideLineComment = false;
          result += currentChar;
        }

        continue;
      }

      if (isInsideBlockComment) {
        if (currentChar === '*' && nextChar === '/') {
          isInsideBlockComment = false;
          index++;
        }

        continue;
      }

      if (!isInsideString && currentChar === '/' && nextChar === '/') {
        isInsideLineComment = true;
        index++;
        continue;
      }

      if (!isInsideString && currentChar === '/' && nextChar === '*') {
        isInsideBlockComment = true;
        index++;
        continue;
      }

      if (currentChar === '"' && !isEscaped) isInsideString = !isInsideString;

      if (currentChar === '\\' && isInsideString) isEscaped = !isEscaped;
      else isEscaped = false;

      result += currentChar;
    }

    return result;
  }

  private _stripJsoncTrailingCommas(jsonText: string): string {
    let result = '';

    let isInsideString = false;
    let isEscaped = false;

    for (let index = 0; index < jsonText.length; index++) {
      const currentChar = jsonText[index];

      if (currentChar === '"' && !isEscaped) isInsideString = !isInsideString;

      if (currentChar === '\\' && isInsideString) isEscaped = !isEscaped;
      else isEscaped = false;

      if (isInsideString) {
        result += currentChar;
        continue;
      }

      if (currentChar !== ',') {
        result += currentChar;
        continue;
      }

      let lookAheadIndex = index + 1;
      while (lookAheadIndex < jsonText.length && /\s/.test(jsonText[lookAheadIndex])) lookAheadIndex++;

      const nextNonSpaceChar = lookAheadIndex < jsonText.length ? jsonText[lookAheadIndex] : '';

      if (nextNonSpaceChar === '}' || nextNonSpaceChar === ']') continue;

      result += currentChar;
    }

    return result;
  }
}
