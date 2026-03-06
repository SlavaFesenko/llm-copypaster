import { mergeConfigs } from './utils/config-helpers/config-mergers';
import { readSystemJsonConfigFile, readUserConfigFile } from './utils/config-helpers/config-tech-helpers';
import { LlmCopypasterUserConfig } from './utils/config-helpers/user-config';
import { OutputChannelLogger } from './utils/output-channel-logger';

export interface PromptInstructionsConfig {
  relativePathToSubInstruction: string;
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
  coreSettings: CoreSettingsConfig;
}

export interface LlmCopypasterConfig {
  vitalParsingAnchors: VitalParsingAnchorsConfig; // profile-agnostic settings as they have to be singleton
  coreSettings: CoreSettingsConfig;
  overridesById?: Record<string, OverrideConfig>;
}

export class ConfigService {
  public constructor(private readonly _logger: OutputChannelLogger) {}

  private _systemConfigPromise?: Promise<LlmCopypasterConfig>;

  public async getSystemConfig(): Promise<LlmCopypasterConfig> {
    this._systemConfigPromise ??= this._buildSystemConfig();

    return await this._systemConfigPromise;
  }

  public async getConfig(): Promise<LlmCopypasterConfig> {
    const systemConfig = await this.getSystemConfig();
    const userFileConfig = await readUserConfigFile<LlmCopypasterUserConfig>(this._logger);

    const mergedConfig = mergeConfigs(systemConfig, userFileConfig, () => structuredClone(systemConfig.coreSettings));

    return mergedConfig;
  }

  public async getOverridesById(config?: LlmCopypasterConfig): Promise<Record<string, OverrideConfig>> {
    const effectiveConfig = await this._getConfigOrUseOverride(config);
    return effectiveConfig.overridesById ?? {};
  }

  public async hasAvailableOverrides(config?: LlmCopypasterConfig): Promise<boolean> {
    const profilesById = await this.getOverridesById(config);
    return Object.keys(profilesById).length > 0;
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

  private async _buildSystemConfig(): Promise<LlmCopypasterConfig> {
    const systemConfig = await readSystemJsonConfigFile<LlmCopypasterConfig>(this._logger);

    return systemConfig!;
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
          ignore: profileSubInstruction.ignore,
        };

        continue;
      }

      nextSubInstructionsById[subInstructionId] = {
        relativePathToSubInstruction:
          profileSubInstruction.relativePathToSubInstruction ?? baseSubInstruction.relativePathToSubInstruction,
        ignore: profileSubInstruction.ignore ?? baseSubInstruction.ignore,
      };
    }

    return nextSubInstructionsById;
  }
}
