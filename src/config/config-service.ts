import { mergeConfigs } from './config-helpers/config-mergers';
import { readSystemJsonConfigFile, readUserJsonConfigFile } from './config-helpers/config-tech-helpers';
import { CoreSettingsConfig, LlmCopypasterConfig } from './system-config-contracts';
import { LlmCopypasterUserConfig, OverrideUserConfig } from './user-config-contracts';

export interface OverrideOptionMetadata {
  id: string;
  description?: string;
  version?: string;
}

export interface OverrideReportEntryData {
  overrideOption: OverrideOptionMetadata;
  rawOverrideCoreSettingsConfig: unknown;
  normalizedOverrideCoreSettingsConfig: CoreSettingsConfig;
}

export interface MergedConfigDebugData {
  hasUserConfig: boolean;
  overrideOptions: OverrideOptionMetadata[];
  activeOverrideIds: string[];
  baseCoreSettingsConfig: CoreSettingsConfig;
  mergedCoreSettingsConfig: CoreSettingsConfig;
  rawUserCoreSettingsConfig: unknown;
  rawSystemCoreSettingsConfig: unknown;
  overrideReportEntries: OverrideReportEntryData[];
}

export interface MergedConfigWithOverrideIdResult {
  mergedConfig: LlmCopypasterConfig;
  debugData: MergedConfigDebugData;
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

  public async getLlmCopypasterConfig(): Promise<LlmCopypasterConfig> {
    return await this._getLlmCopypasterConfig();
  }

  public async getMergedConfigByOverrideIds(overrideIds?: string[]): Promise<MergedConfigWithOverrideIdResult> {
    const baseConfig = await this._getLlmCopypasterConfig();
    const userConfig = await this._getUserConfig();
    const systemConfig = await this.getSystemConfig();
    const normalizedOverrideIds = this._normalizeOverrideIds(overrideIds);

    let mergedConfig: LlmCopypasterConfig = {
      vitalParsingAnchors: baseConfig.vitalParsingAnchors,
      coreSettings: baseConfig.coreSettings,
    };

    for (const overrideId of normalizedOverrideIds) {
      const overrideUserConfig = this._buildOverrideWrapperUserConfig(userConfig?.overridesById?.[overrideId]);
      if (!overrideUserConfig) continue;

      mergedConfig = mergeConfigs(mergedConfig, overrideUserConfig);
    }

    return {
      mergedConfig,
      debugData: this._buildMergedConfigDebugData({
        normalizedOverrideIds,
        systemConfig,
        userConfig,
        baseConfig,
        mergedConfig,
      }),
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

  private _buildMergedConfigDebugData(args: {
    normalizedOverrideIds: string[];
    systemConfig: LlmCopypasterConfig;
    userConfig: LlmCopypasterUserConfig | null;
    baseConfig: LlmCopypasterConfig;
    mergedConfig: LlmCopypasterConfig;
  }): MergedConfigDebugData {
    return {
      hasUserConfig: !!args.userConfig,
      overrideOptions: this.overrideOptions,
      activeOverrideIds: args.normalizedOverrideIds,
      baseCoreSettingsConfig: args.baseConfig.coreSettings,
      mergedCoreSettingsConfig: args.mergedConfig.coreSettings,
      rawUserCoreSettingsConfig: args.userConfig?.coreSettings ?? null,
      rawSystemCoreSettingsConfig: args.systemConfig.coreSettings,
      overrideReportEntries: this._buildOverrideReportEntries({
        userConfig: args.userConfig,
        baseConfig: args.baseConfig,
      }),
    };
  }

  private _buildOverrideReportEntries(args: {
    userConfig: LlmCopypasterUserConfig | null;
    baseConfig: LlmCopypasterConfig;
  }): OverrideReportEntryData[] {
    return this.overrideOptions.map(overrideOption => {
      const overrideUserConfig = this._buildOverrideWrapperUserConfig(args.userConfig?.overridesById?.[overrideOption.id]);

      const normalizedOverrideCoreSettingsConfig = overrideUserConfig
        ? mergeConfigs(args.baseConfig, overrideUserConfig).coreSettings
        : args.baseConfig.coreSettings;

      return {
        overrideOption,
        rawOverrideCoreSettingsConfig: args.userConfig?.overridesById?.[overrideOption.id]?.coreSettings ?? null,
        normalizedOverrideCoreSettingsConfig,
      };
    });
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
