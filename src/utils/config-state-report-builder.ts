import * as vscode from 'vscode';

import {
  ConfigService,
  CoreSettingsConfig,
  MergedConfigWithOverrideIdResult,
  OverrideOptionMetadata,
} from '../config-service';
import { LlmCopypasterUserConfig } from '../contracts/user-config';
import { GLOB_CONSTS } from '../global-constants';
import { readUserJsonConfigFile } from './config-helpers/config-tech-helpers';
import { ensureReadonlyVirtualMarkdownDocOpened } from './editor-virtual-doc-helpers';

const NORMALIZED_CONFIG_STATUS = '[NORMALIZED CONFIG]';
const RAW_CONFIG_BEFORE_NORMALIZATION_STATUS = '[RAW CONFIG]';
const JSON_DIFF_STATUS = '[JSON DIFF]';

export interface ConfigStateReportBuilderArgs {
  extensionContext: vscode.ExtensionContext;
  configService: ConfigService;
  activeOverrideIds?: string[];
}

interface RawMergedOverrideConfigEntry {
  coreSettings?: unknown;
}

interface PreparedOverrideReportEntry {
  overrideOption: OverrideOptionMetadata;
  rawOverrideCoreSettingsConfig: unknown;
  normalizedOverrideCoreSettingsConfig: unknown;
  normalizedOverrideDiffHumanReadable: unknown;
}

interface BuildConfigReportMarkdownArgs {
  hasUserConfig: boolean;
  overrideOptions: OverrideOptionMetadata[];
  activeOverrideIds?: string[];
  currentNormalizedConfigLabel: string;
  currentNormalizedConfigDescription: string;
  currentNormalizedConfigValue: unknown;
  rawUserCoreSettingsConfig: unknown;
  rawSystemCoreSettingsConfig: unknown;
  preparedOverrideReportEntries: PreparedOverrideReportEntry[];
  leadingSectionsMarkdown?: string;
}

export class ConfigStateReportBuilder {
  public constructor(private readonly _args: ConfigStateReportBuilderArgs) {}

  public async displayLsConfigReport(): Promise<void> {
    const systemConfig = await this._args.configService.getSystemConfig();
    const userConfig = await this._readUserConfig();
    const basePublicConfig = await this._args.configService.getLlmCopypasterPublicConfig();
    const overrideOptions = this._args.configService.overrideOptions;

    const preparedOverrideReportEntries = await this._buildPreparedOverrideReportEntries({
      overrideOptions,
      baseCoreSettingsConfig: basePublicConfig.coreSettings,
      rawOverridesById: ConfigStateReportBuilder._buildRawOverridesById(userConfig),
    });

    const reportText = ConfigStateReportBuilder._buildConfigReportMarkdown({
      hasUserConfig: !!userConfig,
      overrideOptions,
      activeOverrideIds: this._args.activeOverrideIds,
      currentNormalizedConfigLabel: `Base Config: ${GLOB_CONSTS.SYS_CONFIG_FILE_NAME} + ${GLOB_CONSTS.USER_CONFIG_FILE_NAME}`,
      currentNormalizedConfigDescription: 'Base Config is applied by default (when no override manually selected)',
      currentNormalizedConfigValue: basePublicConfig.coreSettings,
      rawUserCoreSettingsConfig: userConfig?.coreSettings ?? null,
      rawSystemCoreSettingsConfig: systemConfig.coreSettings,
      preparedOverrideReportEntries,
    });

    await this._openReportInEditor({ docId: 'full-config', reportText });
  }

  public async displayOverridesAppliedReport(selectedProfileIds: string[]): Promise<void> {
    const systemConfig = await this._args.configService.getSystemConfig();
    const userConfig = await this._readUserConfig();
    const basePublicConfig = await this._args.configService.getLlmCopypasterPublicConfig();
    const mergedConfigResult = await this._args.configService.getMergedConfigByOverrideIds(selectedProfileIds);
    const overrideOptions = this._args.configService.overrideOptions;

    const preparedOverrideReportEntries = await this._buildPreparedOverrideReportEntries({
      overrideOptions,
      baseCoreSettingsConfig: basePublicConfig.coreSettings,
      rawOverridesById: ConfigStateReportBuilder._buildRawOverridesById(userConfig),
    });

    const mergeChainText =
      selectedProfileIds.length > 0 ? `Base Config + ${selectedProfileIds.join(' + ')} Overrides Config(s)` : 'Base Config';

    const diffChangeset = await ConfigStateReportBuilder._buildJsonDiffChangeset(
      basePublicConfig.coreSettings,
      mergedConfigResult.mergedConfig.coreSettings
    );

    const humanReadableDiffChangeset = ConfigStateReportBuilder._buildHumanReadableJsonDiffChangeset(
      diffChangeset,
      'baseConfigValue',
      'mergedConfigValue'
    );

    const leadingSectionsMarkdown =
      `## ${JSON_DIFF_STATUS} Base Config vs Merged Override Config\n\n` +
      `${mergeChainText}\n\n` +
      ConfigStateReportBuilder._buildJsonCodeBlock(humanReadableDiffChangeset) +
      ConfigStateReportBuilder._buildMergeIterationsMarkdown(mergedConfigResult);

    const reportText = ConfigStateReportBuilder._buildConfigReportMarkdown({
      hasUserConfig: !!userConfig,
      overrideOptions,
      activeOverrideIds: selectedProfileIds,
      currentNormalizedConfigLabel: `Merged Config: ${mergeChainText}`,
      currentNormalizedConfigDescription: 'Merged Config is currently applied because one or more overrides were selected',
      currentNormalizedConfigValue: mergedConfigResult.mergedConfig.coreSettings,
      rawUserCoreSettingsConfig: userConfig?.coreSettings ?? null,
      rawSystemCoreSettingsConfig: systemConfig.coreSettings,
      preparedOverrideReportEntries,
      leadingSectionsMarkdown,
    });

    await this._openReportInEditor({ docId: 'overrides-config', reportText });
  }

  private async _readUserConfig(): Promise<LlmCopypasterUserConfig | null> {
    return readUserJsonConfigFile<LlmCopypasterUserConfig>();
  }

  private async _openReportInEditor(args: { docId: string; reportText: string }): Promise<void> {
    await ensureReadonlyVirtualMarkdownDocOpened({
      extensionContext: this._args.extensionContext,
      docId: args.docId,
      markdownText: args.reportText,
    });
  }

  private async _buildPreparedOverrideReportEntries(args: {
    overrideOptions: OverrideOptionMetadata[];
    baseCoreSettingsConfig: CoreSettingsConfig;
    rawOverridesById: Record<string, RawMergedOverrideConfigEntry> | null;
  }): Promise<PreparedOverrideReportEntry[]> {
    return await Promise.all(
      args.overrideOptions.map(async overrideOption => {
        const mergedOverrideConfigResult = await this._args.configService.getMergedConfigByOverrideIds([overrideOption.id]);

        const normalizedOverrideCoreSettingsConfig = mergedOverrideConfigResult.mergedConfig.coreSettings;

        const normalizedOverrideDiffChangeset = await ConfigStateReportBuilder._buildJsonDiffChangeset(
          args.baseCoreSettingsConfig,
          normalizedOverrideCoreSettingsConfig
        );

        const normalizedOverrideDiffHumanReadable = ConfigStateReportBuilder._buildHumanReadableJsonDiffChangeset(
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

  private static _buildRawOverridesById(
    userConfig: LlmCopypasterUserConfig | null
  ): Record<string, RawMergedOverrideConfigEntry> | null {
    const userOverridesById = userConfig?.overridesById;
    if (!userOverridesById) return null;

    const rawOverridesById: Record<string, RawMergedOverrideConfigEntry> = {};

    for (const overrideId of Object.keys(userOverridesById)) {
      rawOverridesById[overrideId] = {
        coreSettings: userOverridesById[overrideId]?.coreSettings ?? null,
      };
    }

    return rawOverridesById;
  }

  private static _buildConfigReportMarkdown(args: BuildConfigReportMarkdownArgs): string {
    let reportText = '';

    reportText += '# Config Report\n\n';

    reportText += ConfigStateReportBuilder._buildStatusOverviewMarkdown({
      hasUserConfig: args.hasUserConfig,
      overrideOptions: args.overrideOptions,
      activeOverrideIds: args.activeOverrideIds,
    });

    if (args.leadingSectionsMarkdown) reportText += args.leadingSectionsMarkdown;

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

    for (const preparedOverrideReportEntry of args.preparedOverrideReportEntries)
      reportText += ConfigStateReportBuilder._buildOverrideSectionMarkdown(preparedOverrideReportEntry);

    return reportText.trimEnd();
  }

  private static _buildOverrideSectionMarkdown(preparedOverrideReportEntry: PreparedOverrideReportEntry): string {
    let sectionText = '';

    sectionText += `## ${NORMALIZED_CONFIG_STATUS} Override: ${preparedOverrideReportEntry.overrideOption.id}\n\n`;

    sectionText += `### ${RAW_CONFIG_BEFORE_NORMALIZATION_STATUS} Override Diffs\n\n`;
    sectionText += ConfigStateReportBuilder._buildJsonCodeBlock(preparedOverrideReportEntry.rawOverrideCoreSettingsConfig);

    sectionText += `### ${JSON_DIFF_STATUS} Normalized Override vs Base Config\n\n`;
    sectionText += ConfigStateReportBuilder._buildJsonCodeBlock(
      preparedOverrideReportEntry.normalizedOverrideDiffHumanReadable
    );

    if (preparedOverrideReportEntry.overrideOption.description || preparedOverrideReportEntry.overrideOption.version) {
      const versionPrefix = preparedOverrideReportEntry.overrideOption.version
        ? `v${preparedOverrideReportEntry.overrideOption.version}`
        : '';
      const descriptionSuffix = preparedOverrideReportEntry.overrideOption.description
        ? `${preparedOverrideReportEntry.overrideOption.description}`
        : '';
      const detailsText = [versionPrefix, descriptionSuffix].filter(Boolean).join(' — ');

      if (detailsText) sectionText += `${detailsText}\n\n`;
    }

    sectionText += `### ${NORMALIZED_CONFIG_STATUS} Override\n\n`;
    sectionText += ConfigStateReportBuilder._buildJsonCodeBlock(
      preparedOverrideReportEntry.normalizedOverrideCoreSettingsConfig
    );

    return sectionText;
  }

  private static _buildMergeIterationsMarkdown(mergedConfigResult: MergedConfigWithOverrideIdResult): string {
    const mergeIterations = mergedConfigResult.overridesInBaseConfig.iterations;
    if (mergeIterations.length === 0) return '';

    let mergeIterationsText = '';

    mergeIterationsText += `## ${RAW_CONFIG_BEFORE_NORMALIZATION_STATUS} Merge Iterations\n\n`;

    for (const mergeIteration of mergeIterations) {
      mergeIterationsText += `### Override: ${mergeIteration.overrideId}\n\n`;
      mergeIterationsText += `#### Raw Override User Config\n\n`;
      mergeIterationsText += ConfigStateReportBuilder._buildJsonCodeBlock(mergeIteration.overrideUserConfig);
      mergeIterationsText += `#### Base Config After Merge\n\n`;
      mergeIterationsText += ConfigStateReportBuilder._buildJsonCodeBlock(
        mergeIteration.mergedConfigAfterOverride.coreSettings
      );
    }

    return mergeIterationsText;
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
