import { GLOB_CONSTS } from '../../contracts/global-constants';
import { ConfigService, OverrideOptionMetadata } from '../config-service';
import { readUserJsonConfigFile } from '../helpers/config-file-readers';
import { CoreSettingsConfig } from '../system-config-contracts';
import { LlmCopypasterUserConfig } from '../user-config-contracts';
import {
  BuildConfigReportMarkdownArgs,
  PreparedOverrideReportEntry,
  RawMergedOverrideConfigEntry,
  buildConfigReportMarkdown,
  buildHumanReadableJsonDiffChangeset,
  buildJsonDiffChangeset,
  buildRawOverridesById,
} from './report-common-helper';

export interface BuildLsConfigReportTextArgs {
  configService: ConfigService;
  activeOverrideIds?: string[];
}

export async function buildLsConfigReportText(args: BuildLsConfigReportTextArgs): Promise<string> {
  const systemConfig = await args.configService.getSystemConfig();
  const userConfig = await readUserConfig();
  const basePublicConfig = await args.configService.getSystemUserMergedConfig();
  const overrideOptions = args.configService.overrideOptions ?? [];

  const preparedOverrideReportEntries = await buildPreparedOverrideReportEntries({
    configService: args.configService,
    overrideOptions,
    baseCoreSettingsConfig: basePublicConfig.coreSettings,
    rawOverridesById: buildRawOverridesById(userConfig),
  });

  const buildConfigReportMarkdownArgs: BuildConfigReportMarkdownArgs = {
    hasUserConfig: !!userConfig,
    overrideOptions,
    activeOverrideIds: args.activeOverrideIds,
    currentNormalizedConfigLabel: `Base Config: ${GLOB_CONSTS.SYS_CONFIG_FILE_NAME} + ${GLOB_CONSTS.USER_CONFIG_FILE_NAME}`,
    currentNormalizedConfigDescription:
      'Base Config (core settings) is applied by default (when no override manually selected)',
    currentNormalizedConfigValue: basePublicConfig,
    rawUserCoreSettingsConfig: userConfig?.coreSettings ?? null,
    rawSystemCoreSettingsConfig: systemConfig.coreSettings,
    preparedOverrideReportEntries,
  };

  return buildConfigReportMarkdown(buildConfigReportMarkdownArgs);
}

async function readUserConfig(): Promise<LlmCopypasterUserConfig | null> {
  return readUserJsonConfigFile<LlmCopypasterUserConfig>();
}

async function buildPreparedOverrideReportEntries(args: {
  configService: ConfigService;
  overrideOptions: OverrideOptionMetadata[];
  baseCoreSettingsConfig: CoreSettingsConfig;
  rawOverridesById: Record<string, RawMergedOverrideConfigEntry> | null;
}): Promise<PreparedOverrideReportEntry[]> {
  return await Promise.all(
    args.overrideOptions.map(async overrideOption => {
      const mergedOverrideConfigResult = await args.configService.getSystemUserMergedConfigByOverrideIds([
        overrideOption.id,
      ]);

      const normalizedOverrideCoreSettingsConfig = mergedOverrideConfigResult.mergedConfig.coreSettings;

      const normalizedOverrideDiffChangeset = await buildJsonDiffChangeset(
        args.baseCoreSettingsConfig,
        normalizedOverrideCoreSettingsConfig
      );

      const normalizedOverrideDiffHumanReadable = buildHumanReadableJsonDiffChangeset(
        normalizedOverrideDiffChangeset,
        'previousConfigValue',
        'nextConfigValue'
      );

      return {
        overrideOption,
        rawOverrideCoreSettingsConfig: args.rawOverridesById?.[overrideOption.id]?.coreSettings ?? null,
        normalizedOverrideCoreSettingsConfig,
        normalizedOverrideDiffHumanReadable,
      };
    })
  );
}
