import * as vscode from 'vscode';
import { LlmCopypasterConfigWithDebugData, PresetOptionMetadata } from './contracts/other-contracts';
import { SystemConfig } from './contracts/system-config-contracts';
import { UserConfig } from './contracts/user-config-contracts';
import { readSystemJsonConfigFile, readUserJsonConfigFile } from './helpers/config-file-readers';
import { mergeConfigs } from './helpers/config-mergers';
import { ConfigRefVarsResolver } from './helpers/config-ref-vars-resolver';
import { buildMergedConfigDebugData } from './reporters/reporting-helpers';
import { ConfigValidator } from './validation/config-validator';

export class ConfigService {
  private _systemConfig?: SystemConfig;
  private _userConfig?: UserConfig | null;
  private _systemUserMergedConfig?: SystemConfig;
  private _overrideOptions?: PresetOptionMetadata[] | null;
  private readonly _configValidator: ConfigValidator;
  private readonly _configRefVarsResolver = new ConfigRefVarsResolver();

  public constructor(extensionContext: vscode.ExtensionContext) {
    this._configValidator = new ConfigValidator(extensionContext);
  }

  public get overrideOptions(): PresetOptionMetadata[] | null {
    if (this._overrideOptions === null) return null;

    this._overrideOptions ??= this._setOverrideOptions(this._userConfig ?? null);

    return this._overrideOptions;
  }

  public async getSystemConfig(): Promise<SystemConfig> {
    this._systemConfig ??= await readSystemJsonConfigFile<SystemConfig>();

    return this._systemConfig;
  }

  public async getUserConfig(): Promise<UserConfig | null> {
    if (this._userConfig !== undefined) return this._userConfig;

    this._userConfig = await readUserJsonConfigFile<UserConfig>();

    return this._userConfig;
  }

  public async getSystemUserMergedConfig(): Promise<SystemConfig> {
    this._systemUserMergedConfig ??= await this._buildSystemUserMergedConfig();

    return this._systemUserMergedConfig;
  }

  public async getSystemUserMergedConfigByOverrideIds(overrideIds?: string[]): Promise<LlmCopypasterConfigWithDebugData> {
    const systemUserMergedConfig = await this.getSystemUserMergedConfig(); // this guy has to be already validated by extension.ts call

    if (!overrideIds?.length) {
      return {
        mergedConfig: systemUserMergedConfig,
      } as LlmCopypasterConfigWithDebugData;
    }

    const userConfig = await this.getUserConfig();
    const systemConfig = await this.getSystemConfig();

    let multiOverrideConfig = systemUserMergedConfig;

    for (const overrideId of overrideIds) {
      const overrideCoreSettings = userConfig?.presetsById?.[overrideId]?.presetDependentSettings;
      if (!overrideCoreSettings) continue;

      // each iteration modifies already modified value preparing multi-override config
      multiOverrideConfig = mergeConfigs(multiOverrideConfig, {
        presetDependentSettings: overrideCoreSettings,
      });
    }

    // resolved ref-vars are moved to sharedVariablesById, unresolved refs stay in sharedReferenceVariablesById
    const refVarResolvedMultiOverrideConfig = this._configRefVarsResolver.resolve(multiOverrideConfig);

    await this._configValidator.validateConfig(
      refVarResolvedMultiOverrideConfig,
      `System-User Merged Config + Overrides: ${overrideIds.join(', ')}`,
      systemConfig,
      userConfig
    );

    return {
      mergedConfig: refVarResolvedMultiOverrideConfig,
      debugData: buildMergedConfigDebugData({
        presetOptions: this.overrideOptions,
        activeOverrideIds: overrideIds,
        systemConfig,
        userConfig,
        systemUserMergedConfig,
        mergedConfig: refVarResolvedMultiOverrideConfig,
      }),
    };
  }

  private async _buildSystemUserMergedConfig(): Promise<SystemConfig> {
    const systemConfig = await this.getSystemConfig();
    const userConfig = await this.getUserConfig();

    const mergedConfig = mergeConfigs(systemConfig, userConfig);

    const refVarResolvedConfig = this._configRefVarsResolver.resolve(mergedConfig);

    const isConfigValid = await this._configValidator.validateConfig(
      refVarResolvedConfig,
      'System-User Merged Config',
      systemConfig,
      userConfig
    );

    if (!isConfigValid) throw new Error('System + User merged config validation failed');

    return refVarResolvedConfig;
  }

  private _setOverrideOptions(userConfig: UserConfig | null): PresetOptionMetadata[] | null {
    if (!userConfig) return null;

    const overrideOptions: PresetOptionMetadata[] = [];
    const presetsById = userConfig.presetsById ?? {};

    for (const presetById of Object.keys(presetsById)) {
      const presetConfig = presetsById[presetById];

      if (presetConfig.shouldBeSkipped) continue;

      overrideOptions.push({
        id: presetById,
        description: presetConfig.description,
        version: presetConfig.version,
      });
    }

    return overrideOptions;
  }
}
