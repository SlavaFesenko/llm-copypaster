import * as vscode from 'vscode';
import { LlmCopypasterConfigWithDebugData, OverrideOptionMetadata } from './contracts/other-contracts';
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

  public async getSystemUserMergedConfigByOverrideIds(overrideIds?: string[]): Promise<LlmCopypasterConfigWithDebugData> {
    const systemUserMergedConfig = await this.getSystemUserMergedConfig(); // this guy has to be already validated by extension.ts call

    if (!overrideIds?.length) {
      return {
        mergedConfig: systemUserMergedConfig,
      } as LlmCopypasterConfigWithDebugData;
    }

    const userConfig = await this.getUserConfig();
    const systemConfig = await this.getSystemConfig();

    let multiOverrideConfig: LlmCopypasterConfig = {
      nonOverrideableSettings: systemUserMergedConfig.nonOverrideableSettings,
      coreSettings: systemUserMergedConfig.coreSettings,
    };

    for (const overrideId of overrideIds) {
      const overrideCoreSettings = userConfig?.overridesById?.[overrideId]?.coreSettings;
      if (!overrideCoreSettings) continue;

      // each iteration modifies already modified value preparing multi-override config
      multiOverrideConfig = mergeConfigs(multiOverrideConfig, {
        coreSettings: overrideCoreSettings,
      });
    }

    // TODO: тут бага, т.к. выше переменные уже резолваются в systemUserMergedConfig, то новая попытка их зарезолвать фейлится,
    // так как уже нет путей-ссылок, а вместо них значения. Скорее всего, правильное решение - если переменную удалось зарезолвать -
    // тогда ее переносить в sharedVariablesById, а если не удалось - тогда оставлять ее как есть в sharedReferenceVariablesById,
    // и для валидатора это будет тригером, что если в sharedReferenceVariablesById есть переменные - надо выдать ишшью
    // а билдер вообще ничего про sharedReferenceVariablesById знать не должен (в т.ч. валидировать в репорт), а только sharedVariablesById
    // таким образом мы сможем повторно запускать _configRefVarsResolver на одном и том же конфиге не боясь, что он споткнется
    // соотвественно, в _configRefVarsResolver можно избавиться от цирка с обьектом ошибки, т.к. ссылка останется без изменений
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
