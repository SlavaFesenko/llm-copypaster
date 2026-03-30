import { readSystemJsonConfigFile, readUserJsonConfigFile } from './helpers/config-file-readers';
import { mergeConfigs } from './helpers/config-mergers';
import { CoreSettingsConfig, LlmCopypasterConfig } from './system-config-contracts';
import { LlmCopypasterUserConfig } from './user-config-contracts';

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
  overrideOptions: OverrideOptionMetadata[] | null;
  activeOverrideIds: string[];
  systemUserMergedConfig: CoreSettingsConfig;
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
  private _systemConfig?: LlmCopypasterConfig;
  private _userConfig?: LlmCopypasterUserConfig | null;
  private _systemUserMergedConfig?: LlmCopypasterConfig;
  private _overrideOptions?: OverrideOptionMetadata[] | null;

  public get overrideOptions(): OverrideOptionMetadata[] | null {
    if (this._overrideOptions === null) return null;

    this._overrideOptions ??= this._setOverrideOptions(this._userConfig ?? null);

    return this._overrideOptions;
  }

  public async getSystemConfig(): Promise<LlmCopypasterConfig> {
    if (this._systemConfig) return this._systemConfig;

    this._systemConfig = await readSystemJsonConfigFile<LlmCopypasterConfig>();

    return this._systemConfig;
  }

  public async isConfigValid(): Promise<boolean> {
    return true;
  }

  public async getSystemUserMergedConfig(): Promise<LlmCopypasterConfig> {
    if (this._systemUserMergedConfig) return this._systemUserMergedConfig;

    const systemConfig = await this.getSystemConfig();
    const userConfig = await this._getUserConfig();

    this._systemUserMergedConfig = mergeConfigs(
      systemConfig,
      userConfig
        ? {
            nonOverrideableSettings: userConfig.nonOverrideableSettings,
            coreSettings: userConfig.coreSettings,
          }
        : null
    );

    return this._systemUserMergedConfig;
  }

  public async getSystemUserMergedConfigByOverrideIds(overrideIds: string[]): Promise<MergedConfigWithOverrideIdResult> {
    const systemUserMergedConfig = await this.getSystemUserMergedConfig();
    const userConfig = await this._getUserConfig();
    const systemConfig = await this.getSystemConfig();

    let mergedConfig: LlmCopypasterConfig = {
      nonOverrideableSettings: systemUserMergedConfig.nonOverrideableSettings,
      coreSettings: systemUserMergedConfig.coreSettings,
    };

    for (const overrideId of overrideIds) {
      const overrideCoreSettings = userConfig?.overridesById?.[overrideId]?.coreSettings;
      if (!overrideCoreSettings) continue;

      mergedConfig = mergeConfigs(mergedConfig, {
        coreSettings: overrideCoreSettings,
      });
    }

    return {
      mergedConfig,
      debugData: this._buildMergedConfigDebugData({
        overrideIds,
        systemConfig,
        userConfig,
        systemUserMergedConfig,
        mergedConfig,
      }),
    };
  }

  private async _getUserConfig(): Promise<LlmCopypasterUserConfig | null> {
    if (this._userConfig !== undefined) return this._userConfig;

    this._userConfig = await readUserJsonConfigFile<LlmCopypasterUserConfig>();
    this._overrideOptions = this._setOverrideOptions(this._userConfig);

    return this._userConfig;
  }

  private _buildMergedConfigDebugData(args: {
    overrideIds: string[];
    systemConfig: LlmCopypasterConfig;
    userConfig: LlmCopypasterUserConfig | null;
    systemUserMergedConfig: LlmCopypasterConfig;
    mergedConfig: LlmCopypasterConfig;
  }): MergedConfigDebugData {
    return {
      hasUserConfig: !!args.userConfig,
      overrideOptions: this.overrideOptions,
      activeOverrideIds: args.overrideIds,
      systemUserMergedConfig: args.systemUserMergedConfig.coreSettings,
      mergedCoreSettingsConfig: args.mergedConfig.coreSettings,
      rawUserCoreSettingsConfig: args.userConfig?.coreSettings ?? null,
      rawSystemCoreSettingsConfig: args.systemConfig.coreSettings,
      overrideReportEntries: this._buildOverrideReportEntries({
        userConfig: args.userConfig,
        baseConfig: args.systemUserMergedConfig,
      }),
    };
  }

  private _buildOverrideReportEntries(args: {
    userConfig: LlmCopypasterUserConfig | null;
    baseConfig: LlmCopypasterConfig;
  }): OverrideReportEntryData[] {
    return (this.overrideOptions ?? []).map(overrideOption => {
      const overrideCoreSettings = args.userConfig?.overridesById?.[overrideOption.id]?.coreSettings;

      const normalizedOverrideCoreSettingsConfig = overrideCoreSettings
        ? mergeConfigs(args.baseConfig, { coreSettings: overrideCoreSettings }).coreSettings
        : args.baseConfig.coreSettings;

      return {
        overrideOption,
        rawOverrideCoreSettingsConfig: args.userConfig?.overridesById?.[overrideOption.id]?.coreSettings ?? null,
        normalizedOverrideCoreSettingsConfig,
      };
    });
  }

  private _setOverrideOptions(userConfig: LlmCopypasterUserConfig | null): OverrideOptionMetadata[] | null {
    if (!userConfig) return null;

    const overrideOptions: OverrideOptionMetadata[] = [];
    const overridesById = userConfig.overridesById ?? {};

    for (const overrideId of Object.keys(overridesById)) {
      const overrideConfig = overridesById[overrideId];

      if (overrideConfig.shouldBeSkipped) continue;

      overrideOptions.push({
        id: overrideId,
        description: overrideConfig.description,
        version: overrideConfig.version,
      });
    }

    return overrideOptions;
  }
}
