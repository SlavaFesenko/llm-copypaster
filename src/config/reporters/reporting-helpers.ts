import { MergedConfigDebugData, OverrideOptionMetadata } from '../contracts/other-contracts';
import { LlmCopypasterConfig } from '../contracts/system-config-contracts';
import { LlmCopypasterUserConfig } from '../contracts/user-config-contracts';
import { mergeConfigs } from '../helpers/config-mergers';

export function buildMergedConfigDebugData(args: {
  overrideOptions: OverrideOptionMetadata[] | null;
  activeOverrideIds: string[];
  systemConfig: LlmCopypasterConfig;
  userConfig: LlmCopypasterUserConfig | null;
  systemUserMergedConfig: LlmCopypasterConfig;
  mergedConfig: LlmCopypasterConfig;
}): MergedConfigDebugData {
  const overrideReportEntries = (args.overrideOptions ?? []).map(overrideOption => {
    const overrideCoreSettings = args.userConfig?.overridesById?.[overrideOption.id]?.coreSettings;

    const normalizedOverrideCoreSettingsConfig = overrideCoreSettings
      ? mergeConfigs(args.systemUserMergedConfig, { coreSettings: overrideCoreSettings }).coreSettings
      : args.systemUserMergedConfig.coreSettings;

    return {
      overrideOption,
      rawOverrideCoreSettingsConfig: args.userConfig?.overridesById?.[overrideOption.id]?.coreSettings ?? null,
      normalizedOverrideCoreSettingsConfig,
    };
  });

  return {
    hasUserConfig: !!args.userConfig,
    overrideOptions: args.overrideOptions,
    activeOverrideIds: args.activeOverrideIds,
    systemUserMergedConfig: args.systemUserMergedConfig.coreSettings,
    mergedCoreSettingsConfig: args.mergedConfig.coreSettings,
    rawUserCoreSettingsConfig: args.userConfig?.coreSettings ?? null,
    rawSystemCoreSettingsConfig: args.systemConfig.coreSettings,
    overrideReportEntries,
  };
}
