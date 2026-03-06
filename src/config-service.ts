import * as vscode from 'vscode';
import { mergeConfigs } from './utils/config-helpers/config-mergers';
import { readSystemJsonConfigFile, readWorkspaceJsonConfigFile } from './utils/config-helpers/config-tech-helpers';
import { LlmCopypasterUserConfig } from './utils/config-helpers/user-config';
import { OutputChannelLogger } from './utils/output-channel-logger';

export interface PromptInstructionsConfig {
  relativePathToSubInstruction: string;
  isSystemBundledFile: boolean;
  ignore: boolean;
}

export interface VitalParsingAnchorsConfig {
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

export interface CoreSettingsConfig {
  skipInstructions: boolean;
  skipCodeListings: boolean;
  ideToLlmContextConfig: IdeToLlmContextConfig;
  llmToIdeContextConfig: LlmToIdeContextConfig;
  postFilePatchActionsConfig: PostFilePatchActionsConfig;
  promptInstructionConfig: PromptInstructionConfig;
  llmToIdeSanitizationRulesById: Record<string, LlmToIdeSanitizationRuleConfig>;
}

export interface OverrideConfig {
  description?: string;
  version?: string;
  coreSettings: CoreSettingsConfig; // todo: переимновать на overrideCoreSettings
}

export interface LlmCopypasterConfig {
  vitalParsingAnchors: VitalParsingAnchorsConfig; // profile-agnostic settings as they have to be singleton
  coreSettings: CoreSettingsConfig; // туду переименовать на baseCoreSettings (чтобы отличать от overrideCoreSettings, хоть тип и один)
  overridesById?: Record<string, OverrideConfig>;
}

export class ConfigService {
  public constructor(private readonly _logger: OutputChannelLogger) {}

  public async getSystemConfig(): Promise<LlmCopypasterConfig> {
    const hardcodedFallbackSystemConfig = this._buildHardcodedFallbackSystemConfig();

    const systemFileConfig = await readSystemJsonConfigFile<LlmCopypasterUserConfig>(this._logger, 'sys-config.jsonc');

    const mergedSystemConfig = mergeConfigs(hardcodedFallbackSystemConfig, systemFileConfig, () =>
      this._buildCoreSettings()
    );

    return this._markSystemBundledPromptAsBundled(mergedSystemConfig);
  }

  private _markSystemBundledPromptAsBundled(systemConfig: LlmCopypasterConfig): LlmCopypasterConfig {
    const systemBundledPromptId = 'llm-response-rules-prompt';
    const targetSubInstruction =
      systemConfig.coreSettings.promptInstructionConfig.subInstructionsById[systemBundledPromptId];

    if (!targetSubInstruction) {
      void vscode.window.showWarningMessage(`System prompt "${systemBundledPromptId}" was not found in system config`);

      return systemConfig;
    }

    return {
      ...systemConfig,
      coreSettings: {
        ...systemConfig.coreSettings,
        promptInstructionConfig: {
          ...systemConfig.coreSettings.promptInstructionConfig,
          subInstructionsById: {
            ...systemConfig.coreSettings.promptInstructionConfig.subInstructionsById,
            [systemBundledPromptId]: {
              ...targetSubInstruction,
              isSystemBundledFile: true,
            },
          },
        },
      },
    };
  }

  private _buildHardcodedFallbackSystemConfig(): LlmCopypasterConfig {
    return {
      vitalParsingAnchors: {
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
      coreSettings: this._buildCoreSettings(),
      overridesById: {
        'Drop ALL Instructions': {
          description: 'Runs without any prompt-instructions',
          coreSettings: {
            ...this._buildCoreSettings(),
            skipInstructions: true,
          },
        },
      },
    };
  }

  private _buildCoreSettings(): CoreSettingsConfig {
    return {
      skipInstructions: false,
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
            relativePathToSubInstruction: '.sys-prompts/llm-response-rules-prompt.txt',
            isSystemBundledFile: true,
            ignore: false,
          },
        },
        sharedVariablesById: {
          CODE_LISTING_HEADER_START_FRAGMENT: 'LLM_CPP_CFG.vitalParsingAnchors.codeListingHeaderStartFragment',
          FILE_STATUS_PREFIX: 'LLM_CPP_CFG.vitalParsingAnchors.fileStatusPrefix',
          FILE_PAYLOAD_OPERATION_TYPE_EDITED_FULL: 'LLM_CPP_CFG.vitalParsingAnchors.filePayloadOperationTypeEditedFull',
          FILE_PAYLOAD_OPERATION_TYPE_CREATED: 'LLM_CPP_CFG.vitalParsingAnchors.filePayloadOperationTypeCreated',
          FILE_PAYLOAD_OPERATION_TYPE_DELETED: 'LLM_CPP_CFG.vitalParsingAnchors.filePayloadOperationTypeDeleted',
        },
      },
    };
  }

  public async getConfig(): Promise<LlmCopypasterConfig> {
    const systemConfig = await this.getSystemConfig();
    const userFileConfig = await readWorkspaceJsonConfigFile<LlmCopypasterUserConfig>(this._logger);

    const mergedConfig = mergeConfigs(systemConfig, userFileConfig, () => this._buildCoreSettings());

    return mergedConfig;
  }

  public async getOverridesById(config?: LlmCopypasterConfig): Promise<Record<string, OverrideConfig>> {
    const effectiveConfig = await this._getConfigOrUseOverride(config);
    return effectiveConfig.overridesById ?? {};
  }

  public async hasAvailableProfiles(config?: LlmCopypasterConfig): Promise<boolean> {
    const profilesById = await this.getOverridesById(config);
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

    const profilesById = effectiveConfig.overridesById ?? {};

    let effectiveCoreSettings = effectiveConfig.coreSettings;

    for (const profileId of normalizedProfileIds) {
      if (profileId === 'Default') continue;

      const profile = profilesById[profileId];
      if (!profile?.coreSettings) continue;

      effectiveCoreSettings = this._mergeProfileSettingsConfig(effectiveCoreSettings, profile.coreSettings);
    }

    return {
      ...effectiveConfig,
      coreSettings: effectiveCoreSettings,
    };
  }

  private async _getConfigOrUseOverride(config?: LlmCopypasterConfig): Promise<LlmCopypasterConfig> {
    if (config) return config;
    return await this.getConfig();
  }

  private _mergeProfileSettingsConfig(
    coreSettings: CoreSettingsConfig,
    overrideCoreSettings: CoreSettingsConfig
  ): CoreSettingsConfig {
    const basePromptInstructionConfig = coreSettings.promptInstructionConfig;
    const profilePromptInstructionConfig = overrideCoreSettings.promptInstructionConfig;

    return {
      skipInstructions: overrideCoreSettings.skipInstructions ?? coreSettings.skipInstructions,
      skipCodeListings: overrideCoreSettings.skipCodeListings ?? coreSettings.skipCodeListings,
      ideToLlmContextConfig: {
        skipPromptSizeStatsInCopyNotification:
          overrideCoreSettings.ideToLlmContextConfig?.skipPromptSizeStatsInCopyNotification ??
          coreSettings.ideToLlmContextConfig.skipPromptSizeStatsInCopyNotification,
        promptSizeApproxCharsPerToken:
          overrideCoreSettings.ideToLlmContextConfig?.promptSizeApproxCharsPerToken ??
          coreSettings.ideToLlmContextConfig.promptSizeApproxCharsPerToken,
        maxLinesCountInContext:
          overrideCoreSettings.ideToLlmContextConfig?.maxLinesCountInContext ??
          coreSettings.ideToLlmContextConfig.maxLinesCountInContext,
        maxTokensCountInContext:
          overrideCoreSettings.ideToLlmContextConfig?.maxTokensCountInContext ??
          coreSettings.ideToLlmContextConfig.maxTokensCountInContext,
      },
      llmToIdeContextConfig: {
        promptSizeApproxCharsPerToken:
          overrideCoreSettings.llmToIdeContextConfig?.promptSizeApproxCharsPerToken ??
          coreSettings.llmToIdeContextConfig.promptSizeApproxCharsPerToken,
        maxLinesCountInContext:
          overrideCoreSettings.llmToIdeContextConfig?.maxLinesCountInContext ??
          coreSettings.llmToIdeContextConfig.maxLinesCountInContext,
        maxTokensCountInContext:
          overrideCoreSettings.llmToIdeContextConfig?.maxTokensCountInContext ??
          coreSettings.llmToIdeContextConfig.maxTokensCountInContext,
      },
      postFilePatchActionsConfig: {
        enableSaveAfterFilePatch:
          overrideCoreSettings.postFilePatchActionsConfig?.enableSaveAfterFilePatch ??
          coreSettings.postFilePatchActionsConfig.enableSaveAfterFilePatch,
        enableLintingAfterFilePatch:
          overrideCoreSettings.postFilePatchActionsConfig?.enableLintingAfterFilePatch ??
          coreSettings.postFilePatchActionsConfig.enableLintingAfterFilePatch,
        enableOpeningPatchedFilesInEditor:
          overrideCoreSettings.postFilePatchActionsConfig?.enableOpeningPatchedFilesInEditor ??
          coreSettings.postFilePatchActionsConfig.enableOpeningPatchedFilesInEditor,
      },
      promptInstructionConfig: {
        ...basePromptInstructionConfig,
        ...profilePromptInstructionConfig,
        sharedVariablesById: {
          ...basePromptInstructionConfig.sharedVariablesById,
          ...profilePromptInstructionConfig.sharedVariablesById,
        },
        subInstructionsById: this._mergeSubInstructionsById(
          basePromptInstructionConfig.subInstructionsById,
          profilePromptInstructionConfig.subInstructionsById
        ),
      },
      llmToIdeSanitizationRulesById: {
        ...(coreSettings.llmToIdeSanitizationRulesById ?? {}),
        ...(overrideCoreSettings.llmToIdeSanitizationRulesById ?? {}),
      },
    };
  }

  private _mergeSubInstructionsById(
    baseSubInstructionsById: Record<string, PromptInstructionsConfig>,
    profileSubInstructionsById: Record<string, PromptInstructionsConfig>
  ): Record<string, PromptInstructionsConfig> {
    const nextSubInstructionsById: Record<string, PromptInstructionsConfig> = { ...(baseSubInstructionsById ?? {}) };

    for (const subInstructionId of Object.keys(profileSubInstructionsById)) {
      const baseSubInstruction = baseSubInstructionsById?.[subInstructionId];
      const profileSubInstruction = profileSubInstructionsById[subInstructionId];

      if (!baseSubInstruction) {
        nextSubInstructionsById[subInstructionId] = {
          relativePathToSubInstruction: profileSubInstruction.relativePathToSubInstruction,
          isSystemBundledFile: profileSubInstruction.isSystemBundledFile,
          ignore: profileSubInstruction.ignore,
        };

        continue;
      }

      nextSubInstructionsById[subInstructionId] = {
        relativePathToSubInstruction:
          profileSubInstruction.relativePathToSubInstruction ?? baseSubInstruction.relativePathToSubInstruction,
        isSystemBundledFile: profileSubInstruction.isSystemBundledFile ?? baseSubInstruction.isSystemBundledFile,
        ignore: profileSubInstruction.ignore ?? baseSubInstruction.ignore,
      };
    }

    return nextSubInstructionsById;
  }
}
