import { mergeConfigs } from '../contracts/config-mergers';
import { MergedConfigDebugData, PresetOptionMetadata, PresetReportEntryData } from '../contracts/other-contracts';
import { SystemConfig } from '../contracts/system-config-contracts';
import { UserConfig } from '../contracts/user-config-contracts';

export function buildMergedConfigDebugData(args: {
  presetOptions: PresetOptionMetadata[] | null;
  activeOverrideIds: string[];
  systemConfig: SystemConfig;
  userConfig: UserConfig | null;
  systemUserMergedConfig: SystemConfig;
  mergedConfig: SystemConfig;
}): MergedConfigDebugData {
  const presetReportEntries = (args.presetOptions ?? []).map(presetOption => {
    const presetDependentSettings = args.userConfig?.presetsById?.[presetOption.id]?.presetDependentSettings;

    const normalizedPresetDependentSettingsConfig = presetDependentSettings
      ? mergeConfigs(args.systemUserMergedConfig, { presetDependentSettings: presetDependentSettings })
          .presetDependentSettings
      : args.systemUserMergedConfig.presetDependentSettings;

    return {
      presetOptionMetadata: presetOption,
      rawPresetDependentSettingsConfig: args.userConfig?.presetsById?.[presetOption.id]?.presetDependentSettings ?? null,
      normalizedPresetDependentSettingsConfig,
    } as PresetReportEntryData;
  });

  return {
    hasUserConfig: !!args.userConfig,
    presetOptions: args.presetOptions,
    activePresetsIds: args.activeOverrideIds,
    systemUserMergedConfig: args.systemUserMergedConfig.presetDependentSettings,
    mergedDependentSettingsConfig: args.mergedConfig.presetDependentSettings,
    rawUserPresetDependentSettingsConfig: args.userConfig?.presetDependentSettings ?? null,
    rawSystemPresetDependentSettingsConfig: args.systemConfig.presetDependentSettings,
    presetReportEntries: presetReportEntries,
  };
}
