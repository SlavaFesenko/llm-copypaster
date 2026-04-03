import * as vscode from 'vscode';
import { MergedConfigWithOverrideIdResult, OverrideOptionMetadata } from './contracts/other-contracts';
import { LlmCopypasterConfig } from './contracts/system-config-contracts';
import { LlmCopypasterUserConfig } from './contracts/user-config-contracts';
import { readSystemJsonConfigFile, readUserJsonConfigFile } from './helpers/config-file-readers';
import { mergeConfigs } from './helpers/config-mergers';
import { ConfigRefVarsResolver } from './helpers/config-ref-vars-resolver';
import { buildMergedConfigDebugData } from './reporters/reporting-helpers';
import { ConfigValidator } from './validation/config-validator';

export class ConfigService {
  private _systemConfig?: LlmCopypasterConfig;
  private _userConfig?: LlmCopypasterUserConfig | null;
  private _systemUserMergedConfig?: LlmCopypasterConfig;
  private _overrideOptions?: OverrideOptionMetadata[] | null;
  private readonly _configValidator: ConfigValidator;
  private readonly _configRefVarsResolver = new ConfigRefVarsResolver();

  public constructor(extensionContext: vscode.ExtensionContext) {
    this._configValidator = new ConfigValidator(extensionContext);
  }

  public get overrideOptions(): OverrideOptionMetadata[] | null {
    if (this._overrideOptions === null) return null;

    this._overrideOptions ??= this._setOverrideOptions(this._userConfig ?? null);

    return this._overrideOptions;
  }

  public async getSystemConfig(): Promise<LlmCopypasterConfig> {
    this._systemConfig ??= await readSystemJsonConfigFile<LlmCopypasterConfig>();

    return this._systemConfig;
  }

  public async getUserConfig(): Promise<LlmCopypasterUserConfig | null> {
    if (this._userConfig !== undefined) return this._userConfig;

    this._userConfig = await readUserJsonConfigFile<LlmCopypasterUserConfig>();

    return this._userConfig;
  }

  public async getSystemUserMergedConfig(): Promise<LlmCopypasterConfig> {
    this._systemUserMergedConfig ??= await this._buildSystemUserMergedConfig();

    return this._systemUserMergedConfig;
  }

  public async getSystemUserMergedConfigByOverrideIds(overrideIds: string[]): Promise<MergedConfigWithOverrideIdResult> {
    const userConfig = await this.getUserConfig();
    const systemConfig = await this.getSystemConfig();

    const systemUserMergedConfig = await this.getSystemUserMergedConfig(); // this guy has to be already validated by extension.ts call

    let multiOverrideConfig: LlmCopypasterConfig = {
      nonOverrideableSettings: systemUserMergedConfig.nonOverrideableSettings,
      coreSettings: systemUserMergedConfig.coreSettings,
    };

    for (const overrideId of overrideIds) {
      const overrideCoreSettings = userConfig?.overridesById?.[overrideId]?.coreSettings;
      if (!overrideCoreSettings) continue;

      // every new iteration modifies already modified value preparing multi-override config
      multiOverrideConfig = mergeConfigs(multiOverrideConfig, {
        coreSettings: overrideCoreSettings,
      });
    }

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
        overrideOptions: this.overrideOptions,
        activeOverrideIds: overrideIds,
        systemConfig,
        userConfig,
        systemUserMergedConfig,
        mergedConfig: refVarResolvedMultiOverrideConfig,
      }),
    };
  }

  private async _buildSystemUserMergedConfig(): Promise<LlmCopypasterConfig> {
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
