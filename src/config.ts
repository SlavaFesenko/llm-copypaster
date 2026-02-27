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
  baseSettings: ProfileSettingsConfig; // this settings may be overritten ONLY IN RUNTIME by some of profiles['name'].profileSettingsConfig
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
    llmToIdeSanitizationRulesById: {
      'strip-codefence': {
        pattern: '`{3}[^\r\n]*',
        replaceWith: '',
        disabledForLanguages: ['markdown'],
        disabledForPaths: ['docs/'],
      },
    },
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
    profilesById: {
      'Work Project XXX + Ollama': {
        description: 'Work project profile with Ollama defaults',
        version: '1',
        profileSettingsConfig: {
          promptInstructionConfig: {
            subInstructionsById: {
              [WEB_GIT_PROMPT_ID]: {
                relativePathToSubInstruction: 'prompts/web-git-prompt.md',
                skipSubInstruction: true,
              },
            },
            sharedVariablesById: {
              BRANCH_NAME: 'master',
            },
          },
        },
      },
      'Gemini for pet-project': {
        description: 'Minimal overrides for pet-project with Gemini',
        version: '1',
        profileSettingsConfig: {
          promptInstructionConfig: {
            subInstructionsById: {
              [WEB_GIT_PROMPT_ID]: {
                relativePathToSubInstruction: 'prompts/web-git-prompt.md',
                skipSubInstruction: true,
              },
            },
          },
        },
      },
    },
  };
}

export class ConfigService {
  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _logger: OutputChannelLogger
  ) {}

  public async getConfig(): Promise<LlmCopypasterConfig> {
    const defaultConfig = buildLlmCopypasterConfig();

    // settingsConfig and fileConfig are not read for now, just for a structure
    const settingsConfig = this._readSettingsConfig(defaultConfig);
    const fileConfig = await this._readWorkspaceJsonConfigFile(this._logger);

    const mergedConfig = this._mergeConfigs(defaultConfig, settingsConfig, fileConfig);

    return mergedConfig;
  }

  private _mergeConfigs(
    defaultConfig: LlmCopypasterConfig,
    settingsConfig: LlmCopypasterUserConfig,
    fileConfig: LlmCopypasterUserConfig | null
  ): LlmCopypasterConfig {
    return defaultConfig; // for now it's fine, we don't work with configs yet
  }

  private _readSettingsConfig(defaultConfig: LlmCopypasterConfig): LlmCopypasterUserConfig {
    return defaultConfig; // for now it's fine, we don't work with configs yet
  }

  private async _readWorkspaceJsonConfigFile(logger: OutputChannelLogger): Promise<LlmCopypasterUserConfig | null> {
    const workspaceConfigFileName = '.llm-copypaster.json';

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
      return null;
    }

    const configUri = vscode.Uri.joinPath(workspaceFolder.uri, workspaceConfigFileName);

    try {
      const bytes = await vscode.workspace.fs.readFile(configUri);
      const jsonText = Buffer.from(bytes).toString('utf8');
      const parsed = JSON.parse(jsonText) as LlmCopypasterUserConfig;

      return parsed;
    } catch (error) {
      logger.debug(`Workspace config not loaded: ${String(error)}`);
      return null;
    }
  }
}
