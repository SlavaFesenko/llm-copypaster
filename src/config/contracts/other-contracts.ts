import { PresetDependentSettingsConfig, SystemConfig } from './system-config-contracts';

export interface SystemConfigWithDebugData {
  targetConfig: SystemConfig;
  debugData?: MergedConfigDebugData;
}

export interface PresetOptionMetadata {
  id: string;
  description?: string;
  version?: string;
}

export interface MergedConfigDebugData {
  hasUserConfig: boolean;
  presetOptions: PresetOptionMetadata[] | null;
  activePresetsIds: string[];
  systemUserMergedConfig: PresetDependentSettingsConfig;
  mergedDependentSettingsConfig: PresetDependentSettingsConfig;
  rawUserPresetDependentSettingsConfig: unknown;
  rawSystemPresetDependentSettingsConfig: unknown;
  presetReportEntries: PresetReportEntryData[];
}

export interface PresetReportEntryData {
  presetOptionMetadata: PresetOptionMetadata;
  rawPresetDependentSettingsConfig: unknown;
  normalizedPresetDependentSettingsConfig: PresetDependentSettingsConfig;
}
