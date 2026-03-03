import { mergeConfigs } from './utils/config-helpers/config-mergers';
import { readWorkspaceJsonConfigFile } from './utils/config-helpers/config-tech-helpers';
import { LlmCopypasterUserConfig } from './utils/config-helpers/user-config';
import { OutputChannelLogger } from './utils/output-channel-logger';

export interface PromptInstructionsConfig {
  relativePathToSubInstruction: string;
  isSystemBundledFile: boolean;
  ignore: boolean;
}

export interface LlmToIdeParsingAnchorsConfig {
  techPromptDelimiter: string;
  codeListingHeaderStartFragment: string;
  fileStatusPrefix: string;
  placeholderStartFragment: string;
  placeholderEndFragment: string;
  filePayloadOperationTypeEditedFull: string;
  filePayloadOperationTypeCreated: string;
  filePayloadOperationTypeDeleted: string;
  configVariablePrefix: string;
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

export interface LlmToIdeContextConfig {
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
  llmToIdeContextConfig: LlmToIdeContextConfig;
  postFilePatchActionsConfig: PostFilePatchActionsConfig;
  promptInstructionConfig: Partial<PromptInstructionConfig>;
  llmToIdeSanitizationRulesById: Record<string, LlmToIdeSanitizationRuleConfig>;
}

export interface ProfileConfig {
  description: string;
  version?: string;
  profileSettingsConfig: Partial<ProfileSettingsConfig>;
}

export interface LlmCopypasterConfig {
  llmToIdeParsingAnchors: LlmToIdeParsingAnchorsConfig; // profile-agnostic settings as they have to be singleton
  baseSettings: ProfileSettingsConfig;
  profilesById?: Record<string, ProfileConfig>;
}

export class ConfigService {
  public constructor(private readonly _logger: OutputChannelLogger) {}

  public buildSystemConfig(): LlmCopypasterConfig {
    return {
      llmToIdeParsingAnchors: {
        techPromptDelimiter: '--' + '-',
        codeListingHeaderStartFragment: '## LLM-CPP-FILE:',
        fileStatusPrefix: '#### FILE WAS ',
        placeholderStartFragment: '{{',
        placeholderEndFragment: '}}',
        filePayloadOperationTypeEditedFull: 'EDITED_FULL',
        filePayloadOperationTypeCreated: 'CREATED',
        filePayloadOperationTypeDeleted: 'DELETED',
        configVariablePrefix: 'LLM_CPP_CFG.', // this exact anchor will be parsed by regex (including dot at the end)
      },
      baseSettings: this._buildBaseSettings(),
      profilesById: {
        'Drop ALL Instructions': {
          description: 'Runs without any prompt-instructions',
          profileSettingsConfig: {
            skipTechPrompt: true,
          },
        },
      },
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
      llmToIdeContextConfig: {
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
            relativePathToSubInstruction: '.sys-prompts/llm-response-rules-prompt.md',
            isSystemBundledFile: true,
            ignore: false,
          },
        },
        sharedVariablesById: {
          CODE_LISTING_HEADER_START_FRAGMENT: 'LLM_CPP_CFG.llmToIdeParsingAnchors.codeListingHeaderStartFragment',
          FILE_STATUS_PREFIX: 'LLM_CPP_CFG.llmToIdeParsingAnchors.fileStatusPrefix',
          FILE_PAYLOAD_OPERATION_TYPE_EDITED_FULL: 'LLM_CPP_CFG.llmToIdeParsingAnchors.filePayloadOperationTypeEditedFull',
          FILE_PAYLOAD_OPERATION_TYPE_CREATED: 'LLM_CPP_CFG.llmToIdeParsingAnchors.filePayloadOperationTypeCreated',
          FILE_PAYLOAD_OPERATION_TYPE_DELETED: 'LLM_CPP_CFG.llmToIdeParsingAnchors.filePayloadOperationTypeDeleted',
        },
      },
    };
  }

  public async getConfig(): Promise<LlmCopypasterConfig> {
    const systemConfig = this.buildSystemConfig();
    const userFileConfig = await readWorkspaceJsonConfigFile<LlmCopypasterUserConfig>(this._logger);

    const mergedConfig = mergeConfigs(systemConfig, userFileConfig, () => this._buildBaseSettings());

    return mergedConfig;
  }

  public async getProfilesById(config?: LlmCopypasterConfig): Promise<Record<string, ProfileConfig>> {
    const effectiveConfig = await this._getConfigOrUseOverride(config);
    return effectiveConfig.profilesById ?? {};
  }

  public async hasAvailableProfiles(config?: LlmCopypasterConfig): Promise<boolean> {
    const profilesById = await this.getProfilesById(config);
    return Object.keys(profilesById).length > 0;
  }

  public async buildEffectiveConfigForProfileId(
    profileId: string,
    config?: LlmCopypasterConfig
  ): Promise<LlmCopypasterConfig> {
    return await this.buildEffectiveConfigForProfileIds([profileId], config);
  }

  public async buildEffectiveConfigForProfileIds(
    profileIds: string[],
    config?: LlmCopypasterConfig
  ): Promise<LlmCopypasterConfig> {
    const effectiveConfig = await this._getConfigOrUseOverride(config);

    const normalizedProfileIds = (profileIds ?? []).filter(Boolean);

    const hasAnyNonDefaultProfile = normalizedProfileIds.some(profileId => profileId !== 'Default');

    if (!hasAnyNonDefaultProfile) return effectiveConfig;

    const profilesById = effectiveConfig.profilesById ?? {};

    let effectiveBaseSettings = effectiveConfig.baseSettings;

    for (const profileId of normalizedProfileIds) {
      if (profileId === 'Default') continue;

      const profile = profilesById[profileId];
      if (!profile?.profileSettingsConfig) continue;

      effectiveBaseSettings = this._mergeProfileSettingsConfig(effectiveBaseSettings, profile.profileSettingsConfig);
    }

    return {
      ...effectiveConfig,
      baseSettings: effectiveBaseSettings,
    };
  }

  private async _getConfigOrUseOverride(config?: LlmCopypasterConfig): Promise<LlmCopypasterConfig> {
    if (config) return config;
    return await this.getConfig();
  }

  private _mergeProfileSettingsConfig(
    baseSettings: ProfileSettingsConfig,
    profileSettingsConfig: Partial<ProfileSettingsConfig>
  ): ProfileSettingsConfig {
    return {
      skipTechPrompt: profileSettingsConfig.skipTechPrompt ?? baseSettings.skipTechPrompt,
      skipCodeListings: profileSettingsConfig.skipCodeListings ?? baseSettings.skipCodeListings,
      ideToLlmContextConfig: {
        skipPromptSizeStatsInCopyNotification:
          profileSettingsConfig.ideToLlmContextConfig?.skipPromptSizeStatsInCopyNotification ??
          baseSettings.ideToLlmContextConfig.skipPromptSizeStatsInCopyNotification,
        promptSizeApproxCharsPerToken:
          profileSettingsConfig.ideToLlmContextConfig?.promptSizeApproxCharsPerToken ??
          baseSettings.ideToLlmContextConfig.promptSizeApproxCharsPerToken,
        maxLinesCountInContext:
          profileSettingsConfig.ideToLlmContextConfig?.maxLinesCountInContext ??
          baseSettings.ideToLlmContextConfig.maxLinesCountInContext,
        maxTokensCountInContext:
          profileSettingsConfig.ideToLlmContextConfig?.maxTokensCountInContext ??
          baseSettings.ideToLlmContextConfig.maxTokensCountInContext,
      },
      llmToIdeContextConfig: {
        promptSizeApproxCharsPerToken:
          profileSettingsConfig.llmToIdeContextConfig?.promptSizeApproxCharsPerToken ??
          baseSettings.llmToIdeContextConfig.promptSizeApproxCharsPerToken,
        maxLinesCountInContext:
          profileSettingsConfig.llmToIdeContextConfig?.maxLinesCountInContext ??
          baseSettings.llmToIdeContextConfig.maxLinesCountInContext,
        maxTokensCountInContext:
          profileSettingsConfig.llmToIdeContextConfig?.maxTokensCountInContext ??
          baseSettings.llmToIdeContextConfig.maxTokensCountInContext,
      },
      postFilePatchActionsConfig: {
        enableSaveAfterFilePatch:
          profileSettingsConfig.postFilePatchActionsConfig?.enableSaveAfterFilePatch ??
          baseSettings.postFilePatchActionsConfig.enableSaveAfterFilePatch,
        enableLintingAfterFilePatch:
          profileSettingsConfig.postFilePatchActionsConfig?.enableLintingAfterFilePatch ??
          baseSettings.postFilePatchActionsConfig.enableLintingAfterFilePatch,
        enableOpeningPatchedFilesInEditor:
          profileSettingsConfig.postFilePatchActionsConfig?.enableOpeningPatchedFilesInEditor ??
          baseSettings.postFilePatchActionsConfig.enableOpeningPatchedFilesInEditor,
      },
      promptInstructionConfig: {
        ...(baseSettings.promptInstructionConfig ?? {}),
        ...(profileSettingsConfig.promptInstructionConfig ?? {}),
        sharedVariablesById: {
          ...(baseSettings.promptInstructionConfig?.sharedVariablesById ?? {}),
          ...(profileSettingsConfig.promptInstructionConfig?.sharedVariablesById ?? {}),
        },
        subInstructionsById: {
          ...(baseSettings.promptInstructionConfig?.subInstructionsById ?? {}),
          ...(profileSettingsConfig.promptInstructionConfig?.subInstructionsById ?? {}),
        },
      },
      llmToIdeSanitizationRulesById: {
        ...(baseSettings.llmToIdeSanitizationRulesById ?? {}),
        ...(profileSettingsConfig.llmToIdeSanitizationRulesById ?? {}),
      },
    };
  }
}
