import * as vscode from 'vscode';
import { mergeConfigs } from './contracts/config-mergers';
import { PresetOptionMetadata, SystemConfigWithDebugData } from './contracts/other-contracts';
import { SystemConfig } from './contracts/system-config-contracts';
import { UserConfig } from './contracts/user-config-contracts';
import { readSystemJsonConfigFile, readUserJsonConfigFile } from './helpers/config-file-readers';
import { ConfigRefVarsResolver } from './helpers/config-ref-vars-resolver';
import { buildMergedConfigDebugData } from './reporters/reporting-helpers';
import { ConfigValidator } from './validation/config-validator';

export class ConfigService {
  private _systemConfig?: SystemConfig;
  private _userConfig?: UserConfig | null;
  private _presetOptions?: PresetOptionMetadata[] | null;
  private readonly _configValidator: ConfigValidator;
  private readonly _configRefVarsResolver = new ConfigRefVarsResolver();

  public constructor(extensionContext: vscode.ExtensionContext) {
    this._configValidator = new ConfigValidator(extensionContext);
  }

  public get presetOptions(): PresetOptionMetadata[] | null {
    if (this._presetOptions === null) return null;

    this._presetOptions ??= this._setPresetOptions(this._userConfig ?? null);

    return this._presetOptions;
  }

  public async getSystemConfig(): Promise<SystemConfig> {
    this._systemConfig ??= await readSystemJsonConfigFile<SystemConfig>();

    return this._systemConfig;
  }

  public async getUserConfig(): Promise<UserConfig | null> {
    if (this._userConfig !== undefined) return this._userConfig; // if userConfig is normal or null - it's already processed

    this._userConfig = await readUserJsonConfigFile<UserConfig>();

    return this._userConfig;
  }

  public async getSystemUserMergedConfig(shouldRunValidation: boolean = true): Promise<SystemConfig> {
    const systemConfig = await this.getSystemConfig();
    const userConfig = await this.getUserConfig();

    const mergedConfig = mergeConfigs(systemConfig, userConfig);
    const refVarResolvedConfig = this._configRefVarsResolver.resolve(mergedConfig);

    if (!shouldRunValidation) return refVarResolvedConfig;

    return await this._configValidator.validate(refVarResolvedConfig, systemConfig, userConfig);
  }

  public async getSystemUserMergedConfigByOverrideIds(presetIds?: string[]): Promise<SystemConfigWithDebugData> {
    if (!presetIds?.length) {
      return {
        targetConfig: await this.getSystemUserMergedConfig(),
      } as SystemConfigWithDebugData; // no debug data available in this case
    }

    const systemUserMergedConfig = await this.getSystemUserMergedConfig(false); // validation will be later on, no need to run it twice
    const userConfig = await this.getUserConfig();
    const systemConfig = await this.getSystemConfig();

    let multiPresetsConfig = systemUserMergedConfig;

    for (const presetId of presetIds) {
      const presetDependentSettings = userConfig?.presetsById?.[presetId]?.presetDependentSettings;
      if (!presetDependentSettings) continue;

      // each iteration modifies already modified value preparing multi-override config
      multiPresetsConfig = mergeConfigs(multiPresetsConfig, {
        presetDependentSettings: presetDependentSettings,
      });
    }

    const refVarResolvedConfig = this._configRefVarsResolver.resolve(multiPresetsConfig);

    const validatedConfig = await this._configValidator.validate(refVarResolvedConfig, systemConfig, userConfig, presetIds);

    return {
      targetConfig: validatedConfig,
      debugData: buildMergedConfigDebugData({
        presetOptions: this.presetOptions,
        activeOverrideIds: presetIds,
        systemConfig,
        userConfig,
        systemUserMergedConfig,
        mergedConfig: validatedConfig,
      }),
    };
  }

  private _setPresetOptions(userConfig: UserConfig | null): PresetOptionMetadata[] | null {
    if (!userConfig) return null;

    const presetOptions: PresetOptionMetadata[] = [];
    const presetsById = userConfig.presetsById ?? {};

    for (const presetById of Object.keys(presetsById)) {
      const presetConfig = presetsById[presetById];

      if (presetConfig.shouldBeSkipped) continue;

      presetOptions.push({
        id: presetById,
        description: presetConfig.description,
        version: presetConfig.version,
      });
    }

    return presetOptions;
  }
}
