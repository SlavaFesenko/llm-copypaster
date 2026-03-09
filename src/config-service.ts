import { LlmCopypasterUserConfig, OverrideUserConfig } from './contracts/user-config';
import { mergeConfigs } from './utils/config-helpers/config-mergers';
import { readSystemJsonConfigFile, readUserJsonConfigFile } from './utils/config-helpers/config-tech-helpers';

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

export interface OverrideOptionMetadata {
  id: string;
  description?: string;
  version?: string;
}

export interface OverrideMergeIterationReport {
  overrideId: string;
  overrideUserConfig: LlmCopypasterUserConfig;
  mergedConfigAfterOverride: LlmCopypasterConfig;
}

export interface OverridesInBaseConfigReport {
  appliedOverrideIds: string[];
  iterations: OverrideMergeIterationReport[];
}

export interface LlmCopypasterConfig {
  vitalParsingAnchors: VitalParsingAnchorsConfig;
  coreSettings: CoreSettingsConfig;
  overridesInBaseConfig?: OverridesInBaseConfigReport;
}

export class ConfigService {
  public get overrideOptions(): OverrideOptionMetadata[] {
    return this._overrideOptions;
  }

  private _systemConfig?: LlmCopypasterConfig;
  private _userConfig?: LlmCopypasterUserConfig | null;
  private _llmCopypasterConfig?: LlmCopypasterConfig;
  private _overrideOptions: OverrideOptionMetadata[] = [];

  public async getSystemConfig(): Promise<LlmCopypasterConfig> {
    if (this._systemConfig) return this._systemConfig;

    this._systemConfig = await readSystemJsonConfigFile<LlmCopypasterConfig>();

    return this._systemConfig;
  }

  public async getCoreSettingsConfig(): Promise<CoreSettingsConfig> {
    const llmCopypasterConfig = await this._getLlmCopypasterConfig();

    return llmCopypasterConfig.coreSettings;
  }

  public async getCoreSettingsConfigByOverrideIds(overrideIds?: string[]): Promise<CoreSettingsConfig> {
    const mergedConfig = await this.getMergedConfigByOverrideIds(overrideIds);

    return mergedConfig.coreSettings;
  }

  public async getVitalParsingAnchorsConfig(): Promise<VitalParsingAnchorsConfig> {
    const llmCopypasterConfig = await this._getLlmCopypasterConfig();

    return llmCopypasterConfig.vitalParsingAnchors;
  }

  public async getLlmCopypasterPublicConfig(overrideId?: string): Promise<LlmCopypasterConfig> {
    return this.getMergedConfigByOverrideIds(overrideId ? [overrideId] : []);
  }

  public async getMergedConfigByOverrideIds(overrideIds?: string[]): Promise<LlmCopypasterConfig> {
    const baseConfig = await this._getLlmCopypasterConfig();
    const userConfig = await this._getUserConfig();
    const normalizedOverrideIds = this._normalizeOverrideIds(overrideIds);

    if (normalizedOverrideIds.length === 0) return baseConfig;

    let mergedConfigWrapper: LlmCopypasterConfig = {
      vitalParsingAnchors: baseConfig.vitalParsingAnchors,
      coreSettings: baseConfig.coreSettings,
    };

    const overridesInBaseConfig: OverridesInBaseConfigReport = {
      appliedOverrideIds: [],
      iterations: [],
    };

    for (const overrideId of normalizedOverrideIds) {
      const overrideUserConfig = this._buildOverrideWrapperUserConfig(userConfig?.overridesById?.[overrideId]);
      if (!overrideUserConfig) continue;

      mergedConfigWrapper = mergeConfigs(mergedConfigWrapper, overrideUserConfig);

      const mergedConfigAfterOverride: LlmCopypasterConfig = {
        vitalParsingAnchors: mergedConfigWrapper.vitalParsingAnchors,
        coreSettings: mergedConfigWrapper.coreSettings,
      };

      overridesInBaseConfig.appliedOverrideIds.push(overrideId);
      overridesInBaseConfig.iterations.push({
        overrideId,
        overrideUserConfig,
        mergedConfigAfterOverride,
      });
    }

    return {
      vitalParsingAnchors: mergedConfigWrapper.vitalParsingAnchors,
      coreSettings: mergedConfigWrapper.coreSettings,
      overridesInBaseConfig,
    };
  }

  private async _getLlmCopypasterConfig(): Promise<LlmCopypasterConfig> {
    if (this._llmCopypasterConfig) return this._llmCopypasterConfig;

    this._llmCopypasterConfig = await this._buildLlmCopypasterConfig();

    return this._llmCopypasterConfig;
  }

  private async _getUserConfig(): Promise<LlmCopypasterUserConfig | null> {
    if (this._userConfig !== undefined) return this._userConfig;

    this._userConfig = await readUserJsonConfigFile<LlmCopypasterUserConfig>();
    this._setOverrideOptions(this._userConfig);

    return this._userConfig;
  }

  private async _buildLlmCopypasterConfig(): Promise<LlmCopypasterConfig> {
    const systemConfig = await this.getSystemConfig();
    const userFileConfig = await this._getUserConfig();

    return mergeConfigs(systemConfig, userFileConfig ? this._buildBaseOnlyUserConfig(userFileConfig) : null);
  }

  private _buildBaseOnlyUserConfig(userConfig: LlmCopypasterUserConfig): LlmCopypasterUserConfig {
    return {
      vitalParsingAnchors: userConfig.vitalParsingAnchors,
      coreSettings: userConfig.coreSettings,
    };
  }

  private _buildOverrideWrapperUserConfig(overrideUserConfig?: OverrideUserConfig): LlmCopypasterUserConfig | null {
    if (!overrideUserConfig) return null;

    return {
      coreSettings: overrideUserConfig.coreSettings,
    };
  }

  private _setOverrideOptions(userConfig: LlmCopypasterUserConfig | null): void {
    this._overrideOptions = [];

    const overridesById = userConfig?.overridesById ?? {};

    for (const overrideId of Object.keys(overridesById)) {
      const overrideConfig = overridesById[overrideId];

      if (overrideConfig.shouldBeSkipped) continue;

      this._overrideOptions.push({
        id: overrideId,
        description: overrideConfig.description,
        version: overrideConfig.version,
      });
    }
  }

  private _normalizeOverrideIds(overrideIds?: string[]): string[] {
    return [...(overrideIds ?? [])].filter(Boolean);
  }
}
