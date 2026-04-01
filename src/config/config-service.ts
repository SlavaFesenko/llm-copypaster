import { MergedConfigWithOverrideIdResult, OverrideOptionMetadata } from './contracts/other-contracts';
import { LlmCopypasterConfig } from './contracts/system-config-contracts';
import { LlmCopypasterUserConfig } from './contracts/user-config-contracts';
import { readSystemJsonConfigFile, readUserJsonConfigFile } from './helpers/config-file-readers';
import { mergeConfigs } from './helpers/config-mergers';
import { buildMergedConfigDebugData } from './reporters/reporting-helpers';

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

  public async getUserConfig(): Promise<LlmCopypasterUserConfig | null> {
    if (this._userConfig !== undefined) return this._userConfig;

    this._userConfig = await readUserJsonConfigFile<LlmCopypasterUserConfig>();

    return this._userConfig;
  }

  public async getSystemUserMergedConfig(): Promise<LlmCopypasterConfig> {
    if (this._systemUserMergedConfig) return this._systemUserMergedConfig;

    this._systemUserMergedConfig = await this._buildSystemUserMergedConfig();

    return this._systemUserMergedConfig;
  }

  public async getSystemUserMergedConfigByOverrideIds(overrideIds: string[]): Promise<MergedConfigWithOverrideIdResult> {
    const systemUserMergedConfig = await this.getSystemUserMergedConfig();
    const userConfig = await this.getUserConfig();
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
      debugData: buildMergedConfigDebugData({
        overrideOptions: this.overrideOptions,
        activeOverrideIds: overrideIds,
        systemConfig,
        userConfig,
        systemUserMergedConfig,
        mergedConfig,
      }),
    };
  }

  private async _buildSystemUserMergedConfig(): Promise<LlmCopypasterConfig> {
    const systemConfig = await this.getSystemConfig();
    const userConfig = await this.getUserConfig();

    return mergeConfigs(
      systemConfig,
      userConfig
        ? {
            nonOverrideableSettings: userConfig.nonOverrideableSettings,
            coreSettings: userConfig.coreSettings,
            overridesById: undefined, // overridesById should not be exposed
          }
        : null
    );
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
