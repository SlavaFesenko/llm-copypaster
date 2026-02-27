import { mergeConfigs } from './utils/config-helpers/config-mergers';
import { readWorkspaceJsonConfigFile } from './utils/config-helpers/config-tech-helpers';
import { LlmCopypasterUserConfig } from './utils/config-helpers/user-config';
import { OutputChannelLogger } from './utils/output-channel-logger';

export interface PromptInstructionsConfig {
  relativePathToSubInstruction: string;
  skipSubInstruction: boolean;
}

export interface LlmToIdeParsingAnchorsConfig {
  techPromptDelimiter: string;
  codeListingHeaderStartFragment: string;
  fileStatusPrefix: string;
  placeholderStartFragment: string;
  placeholderEndFragment: string;
}

export interface PromptInstructionConfig {
  sharedVariablesById: Record<string, string>;
  subInstructionsById: Record<string, PromptInstructionsConfig>;
}

export interface LlmToIdeSanitizationRuleConfig {
  pattern: string;
  replaceWith: string;
  disabledForLanguages: string[];
  disabledForPaths: string[];
}

export interface IdeToLlmContextConfig {
  skipPromptSizeStatsInCopyNotification: boolean;
  promptSizeApproxCharsPerToken: number;
  maxLinesCountInContext: number;
  maxTokensCountInContext: number;
}

export interface PostFilePatchActionsConfig {
  enableSaveAfterFilePatch: boolean;
  enableLintingAfterFilePatch: boolean;
  enableOpeningPatchedFilesInEditor: boolean;
}

export interface ProfileSettingsConfig {
  skipTechPrompt: boolean;
  skipCodeListings: boolean;
  ideToLlmContextConfig: IdeToLlmContextConfig;
  postFilePatchActionsConfig: PostFilePatchActionsConfig;
  promptInstructionConfig: Partial<PromptInstructionConfig>;
  llmToIdeSanitizationRulesById: Record<string, LlmToIdeSanitizationRuleConfig>;
}

export interface ProfileConfig {
  description: string;
  version: string;
  profileSettingsConfig: Partial<ProfileSettingsConfig>;
}

export interface LlmCopypasterConfig {
  llmToIdeParsingAnchors: LlmToIdeParsingAnchorsConfig; // profile-agnostic settings as they have to be singleton
  baseSettings: ProfileSettingsConfig; // this settings may be overwritten ONLY IN RUNTIME by some of profiles['name'].profileSettingsConfig
  profilesById: Record<string, ProfileConfig>;
}

export class ConfigService {
  public constructor(private readonly _logger: OutputChannelLogger) {}

  public async getConfig(): Promise<LlmCopypasterConfig> {
    const systemConfig = this._buildSystemConfig();
    const userFileConfig = await readWorkspaceJsonConfigFile<LlmCopypasterUserConfig>(this._logger);

    const mergedConfig = mergeConfigs(systemConfig, userFileConfig, () => this._buildBaseSettings());

    return mergedConfig;
  }

  private _buildSystemConfig(): LlmCopypasterConfig {
    return {
      llmToIdeParsingAnchors: {
        techPromptDelimiter: '--' + '-',
        codeListingHeaderStartFragment: '## LLM-CPP-FILE:',
        fileStatusPrefix: '#### FILE WAS ',
        placeholderStartFragment: '{{',
        placeholderEndFragment: '}}',
      },
      baseSettings: this._buildBaseSettings(),
      profilesById: {},
    };
  }

  private _buildBaseSettings(): ProfileSettingsConfig {
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
        enableLintingAfterFilePatch: false,
        enableOpeningPatchedFilesInEditor: true,
      },
      promptInstructionConfig: {
        subInstructionsById: {
          'llm-response-rules-prompt': {
            relativePathToSubInstruction: 'prompts/llm-response-rules-prompt.md',
            skipSubInstruction: false,
          },
          'web-git-prompt': {
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
}
