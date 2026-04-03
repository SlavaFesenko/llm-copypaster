import { CoreSettingsConfig, LlmCopypasterConfig } from './system-config-contracts';

export interface LlmCopypasterConfigWithDebugData {
  mergedConfig: LlmCopypasterConfig;
  debugData?: MergedConfigDebugData;
}

export interface OverrideOptionMetadata {
  id: string;
  description?: string;
  version?: string;
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

export interface OverrideReportEntryData {
  overrideOption: OverrideOptionMetadata;
  rawOverrideCoreSettingsConfig: unknown;
  normalizedOverrideCoreSettingsConfig: CoreSettingsConfig;
}
