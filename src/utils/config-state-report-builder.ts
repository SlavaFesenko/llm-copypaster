import { ConfigService, CoreSettingsConfig, OverrideOptionMetadata } from '../config-service';
import { LlmCopypasterUserConfig } from '../contracts/user-config';
import { GLOB_CONSTS } from '../global-constants';
import { mergeConfigs } from './config-helpers/config-mergers';
import { readUserJsonConfigFile } from './config-helpers/config-tech-helpers';

const NORMALIZED_CONFIG_STATUS = '[NORMALIZED CONFIG]';
const RAW_CONFIG_BEFORE_NORMALIZATION_STATUS = '[RAW CONFIG BEFORE NORMALIZATION]';
const JSON_DIFF_STATUS = '[JSON DIFF]';

export interface ConfigStateReportBuilderArgs {
  configService: ConfigService;
  activeOverrideIds?: string[];
}

export interface BuildMergedConfigMarkdownReportTextArgs {
  configService: ConfigService;
  selectedProfileIds: string[];
}

interface RawMergedOverrideConfigEntry {
  coreSettings?: unknown;
}

interface BuildConfigReportMarkdownArgs {
  configService: ConfigService;
  hasUserConfig: boolean;
  overrideOptions: OverrideOptionMetadata[];
  activeOverrideIds?: string[];
  currentNormalizedConfigLabel: string;
  currentNormalizedConfigDescription: string;
  currentNormalizedConfigValue: unknown;
  baseCoreSettingsConfig: CoreSettingsConfig;
  rawUserCoreSettingsConfig: unknown;
  rawSystemCoreSettingsConfig: unknown;
  rawMergedOverridesById?: Record<string, RawMergedOverrideConfigEntry> | null;
  leadingSectionsMarkdown?: string;
}

export class ConfigStateReportBuilder {
  public constructor(private readonly _args: ConfigStateReportBuilderArgs) {}

  public async build(): Promise<string> {
    const systemConfig = await this._args.configService.getSystemConfig();
    const userConfig = await this._readUserConfig();
    const rawMergedConfig = mergeConfigs(systemConfig, userConfig, { normalizeOverrides: false });
    const basePublicConfig = await this._args.configService.getLlmCopypasterPublicConfig();
    const overrideOptions = this._args.configService.overrideOptions;

    return ConfigStateReportBuilder._buildConfigReportMarkdown({
      configService: this._args.configService,
      hasUserConfig: !!userConfig,
      overrideOptions,
      activeOverrideIds: this._args.activeOverrideIds,
      currentNormalizedConfigLabel: `Base Config: ${GLOB_CONSTS.SYS_CONFIG_FILE_NAME} + ${GLOB_CONSTS.USER_CONFIG_FILE_NAME}`,
      currentNormalizedConfigDescription: 'Base Config is applied by default (when no override manually selected)',
      currentNormalizedConfigValue: basePublicConfig.coreSettings,
      baseCoreSettingsConfig: basePublicConfig.coreSettings,
      rawUserCoreSettingsConfig: userConfig?.coreSettings ?? null,
      rawSystemCoreSettingsConfig: systemConfig.coreSettings,
      rawMergedOverridesById: rawMergedConfig.overridesById ?? null,
    });
  }

  public static async buildMergedConfigMarkdownReportText(args: BuildMergedConfigMarkdownReportTextArgs): Promise<string> {
    const systemConfig = await args.configService.getSystemConfig();
    const userConfig = await readUserJsonConfigFile<LlmCopypasterUserConfig>();
    const rawMergedConfig = mergeConfigs(systemConfig, userConfig, { normalizeOverrides: false });
    const normalizedSelectedProfileIds = (args.selectedProfileIds ?? [])
      .filter(Boolean)
      .filter(profileId => profileId !== 'Default');
    const basePublicConfig = await args.configService.getLlmCopypasterPublicConfig();
    const mergedPublicConfig = await args.configService.getMergedConfigByOverrideIds(normalizedSelectedProfileIds);
    const overrideOptions = args.configService.overrideOptions;

    const mergeChainText =
      normalizedSelectedProfileIds.length > 0
        ? `Base Config + ${normalizedSelectedProfileIds.join(' + ')} Override Config(s)`
        : 'Base Config';

    const diffChangeset = await ConfigStateReportBuilder._buildJsonDiffChangeset(
      basePublicConfig.coreSettings,
      mergedPublicConfig.coreSettings
    );

    const humanReadableDiffChangeset = ConfigStateReportBuilder._buildHumanReadableJsonDiffChangeset(
      diffChangeset,
      'baseConfigValue',
      'mergedConfigValue'
    );

    const leadingSectionsMarkdown =
      `## ${JSON_DIFF_STATUS} Base Config vs Merged Override Config\n\n` +
      `${mergeChainText}\n\n` +
      ConfigStateReportBuilder._buildJsonCodeBlock(humanReadableDiffChangeset);

    return ConfigStateReportBuilder._buildConfigReportMarkdown({
      configService: args.configService,
      hasUserConfig: !!userConfig,
      overrideOptions,
      activeOverrideIds: normalizedSelectedProfileIds,
      currentNormalizedConfigLabel: `Merged Config: ${mergeChainText}`,
      currentNormalizedConfigDescription: 'Merged Config is currently applied because one or more overrides were selected',
      currentNormalizedConfigValue: mergedPublicConfig.coreSettings,
      baseCoreSettingsConfig: basePublicConfig.coreSettings,
      rawUserCoreSettingsConfig: userConfig?.coreSettings ?? null,
      rawSystemCoreSettingsConfig: systemConfig.coreSettings,
      rawMergedOverridesById: rawMergedConfig.overridesById ?? null,
      leadingSectionsMarkdown,
    });
  }

  private async _readUserConfig(): Promise<LlmCopypasterUserConfig | null> {
    return readUserJsonConfigFile<LlmCopypasterUserConfig>();
  }

  private static async _buildConfigReportMarkdown(args: BuildConfigReportMarkdownArgs): Promise<string> {
    let reportText = '';

    reportText += '# Config Report\n\n';

    if (args.leadingSectionsMarkdown) reportText += args.leadingSectionsMarkdown;

    reportText += ConfigStateReportBuilder._buildStatusOverviewMarkdown({
      hasUserConfig: args.hasUserConfig,
      overrideOptions: args.overrideOptions,
      activeOverrideIds: args.activeOverrideIds,
    });

    reportText += `## ${NORMALIZED_CONFIG_STATUS} ${args.currentNormalizedConfigLabel}\n\n`;
    reportText += `${args.currentNormalizedConfigDescription}\n\n`;
    reportText += ConfigStateReportBuilder._buildJsonCodeBlock(args.currentNormalizedConfigValue);

    if (args.hasUserConfig) {
      reportText += `## ${RAW_CONFIG_BEFORE_NORMALIZATION_STATUS} User Config: ${GLOB_CONSTS.USER_CONFIG_FILE_NAME}\n\n`;
      reportText += ConfigStateReportBuilder._buildJsonCodeBlock(args.rawUserCoreSettingsConfig);
    } else {
      reportText += `## No User Config was found (${GLOB_CONSTS.USER_CONFIG_FILE_NAME})\n\n`;
    }

    reportText += `## ${RAW_CONFIG_BEFORE_NORMALIZATION_STATUS} System Config: ${GLOB_CONSTS.SYS_CONFIG_FILE_NAME}\n\n`;
    reportText += ConfigStateReportBuilder._buildJsonCodeBlock(args.rawSystemCoreSettingsConfig);

    for (const overrideOption of args.overrideOptions) {
      reportText += await ConfigStateReportBuilder._buildOverrideSectionMarkdown({
        configService: args.configService,
        overrideOption,
        baseCoreSettingsConfig: args.baseCoreSettingsConfig,
        rawMergedOverrideCoreSettingsConfig: args.rawMergedOverridesById?.[overrideOption.id]?.coreSettings ?? null,
      });
    }

    return reportText.trimEnd();
  }

  private static async _buildOverrideSectionMarkdown(args: {
    configService: ConfigService;
    overrideOption: OverrideOptionMetadata;
    baseCoreSettingsConfig: CoreSettingsConfig;
    rawMergedOverrideCoreSettingsConfig: unknown;
  }): Promise<string> {
    const overridePublicConfig = await args.configService.getLlmCopypasterPublicConfig(args.overrideOption.id);
    const overrideDiffChangeset = await ConfigStateReportBuilder._buildJsonDiffChangeset(
      args.baseCoreSettingsConfig,
      overridePublicConfig.coreSettings
    );

    const overrideDiffHumanReadable = ConfigStateReportBuilder._buildHumanReadableJsonDiffChangeset(
      overrideDiffChangeset,
      'previousConfigValue',
      'nextConfigValue'
    );

    let sectionText = '';

    sectionText += `## ${NORMALIZED_CONFIG_STATUS} Override: ${args.overrideOption.id}\n\n`;

    sectionText += `### ${RAW_CONFIG_BEFORE_NORMALIZATION_STATUS} Override Diffs\n\n`;
    sectionText += ConfigStateReportBuilder._buildJsonCodeBlock(args.rawMergedOverrideCoreSettingsConfig);

    sectionText += `### ${JSON_DIFF_STATUS} Normalized Override vs Base Config\n\n`;
    sectionText += ConfigStateReportBuilder._buildJsonCodeBlock(overrideDiffHumanReadable);

    if (args.overrideOption.description || args.overrideOption.version) {
      const versionPrefix = args.overrideOption.version ? `v${args.overrideOption.version}` : '';
      const descriptionSuffix = args.overrideOption.description ? `${args.overrideOption.description}` : '';
      const detailsText = [versionPrefix, descriptionSuffix].filter(Boolean).join(' — ');

      if (detailsText) sectionText += `${detailsText}\n\n`;
    }

    sectionText += `### ${NORMALIZED_CONFIG_STATUS} Override\n\n`;
    sectionText += ConfigStateReportBuilder._buildJsonCodeBlock(overridePublicConfig.coreSettings);

    return sectionText;
  }

  private static _buildStatusOverviewMarkdown(args: {
    hasUserConfig: boolean;
    overrideOptions: OverrideOptionMetadata[];
    activeOverrideIds?: string[];
  }): string {
    const baseCoreSettingsSource = args.hasUserConfig ? 'System + User Config' : 'System Config';
    const activeOverrideIdsSet = new Set(args.activeOverrideIds ?? []);
    const activeOverrideIds = [...activeOverrideIdsSet].filter(Boolean);
    const isBaseConfigCurrentlyApplied = activeOverrideIds.length === 0;
    const currentCoreSettingsSource =
      activeOverrideIds.length > 0
        ? `${baseCoreSettingsSource} + ${activeOverrideIds.join(' + ')} Override Config(s)`
        : baseCoreSettingsSource;

    let statusOverviewText = '';

    statusOverviewText += '## Status Overview\n\n';
    statusOverviewText += '### Config Sources\n\n';
    statusOverviewText += `🟢 System Config (${GLOB_CONSTS.SYS_CONFIG_FILE_NAME}): Loaded\n`;
    statusOverviewText += `${args.hasUserConfig ? '🟢' : '🟡'} User Config (${GLOB_CONSTS.USER_CONFIG_FILE_NAME}): ${args.hasUserConfig ? 'Loaded' : 'Not Found'}\n\n`;
    statusOverviewText += '### Core Settings Current Source\n\n';
    statusOverviewText += `${isBaseConfigCurrentlyApplied ? '🟢' : '🟡'} ${currentCoreSettingsSource}\n`;

    if (args.overrideOptions.length) {
      for (let overrideOptionIndex = 0; overrideOptionIndex < args.overrideOptions.length; overrideOptionIndex++) {
        const overrideOption = args.overrideOptions[overrideOptionIndex];
        const isOverrideCurrentlyApplied = activeOverrideIdsSet.has(overrideOption.id);

        statusOverviewText += `${isOverrideCurrentlyApplied ? '🟢' : '🟡'} "${overrideOption.id}" Override Config\n`;
      }

      statusOverviewText += '\n';
    } else {
      statusOverviewText += '⚪ Override Config: None was detected.\n\n';
    }

    return statusOverviewText;
  }

  private static async _buildJsonDiffChangeset(previousValue: unknown, nextValue: unknown): Promise<unknown> {
    const { diff } = await import('json-diff-ts');

    return diff(previousValue, nextValue);
  }

  private static _buildJsonCodeBlock(value: unknown): string {
    const tripleTicks = '`' + '``';

    return `${tripleTicks}json\n${JSON.stringify(value, null, 2)}\n${tripleTicks}\n\n`;
  }

  private static _buildHumanReadableJsonDiffChangeset(
    value: unknown,
    previousValueKey: string,
    nextValueKey: string
  ): unknown {
    if (Array.isArray(value))
      return value.map(item =>
        ConfigStateReportBuilder._buildHumanReadableJsonDiffChangeset(item, previousValueKey, nextValueKey)
      );

    if (!value || typeof value !== 'object') return value;

    const anyObject = value as Record<string, unknown>;
    const nextObject: Record<string, unknown> = {};

    for (const [key, childValue] of Object.entries(anyObject)) {
      if (key === 'type') continue;

      let nextKey = key;

      switch (key) {
        case 'key':
          nextKey = 'fieldOrSectionName';
          break;

        case 'changes':
          nextKey = 'diff';
          break;

        case 'value':
        case 'newValue':
          nextKey = nextValueKey;
          break;

        case 'oldValue':
          nextKey = previousValueKey;
          break;

        default:
          nextKey = key;
          break;
      }

      nextObject[nextKey] = ConfigStateReportBuilder._buildHumanReadableJsonDiffChangeset(
        childValue,
        previousValueKey,
        nextValueKey
      );
    }

    return nextObject;
  }
}
