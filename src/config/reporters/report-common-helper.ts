import { GLOB_CONSTS } from '../../contracts/global-constants';
import { MergedConfigDebugData, PresetOptionMetadata } from '../contracts/other-contracts';
import { UserConfig } from '../contracts/user-config-contracts';

export const NORMALIZED_CONFIG_STATUS = '[NORMALIZED CONFIG]';
export const RAW_CONFIG_BEFORE_NORMALIZATION_STATUS = '[RAW CONFIG]';
export const JSON_DIFF_STATUS = '[JSON DIFF]';

const STATUS_ICON_APPLIED = '\u{1F7E2}'; // 🟢
const STATUS_ICON_AVAILABLE = '\u{1F7E1}'; // 🟡
const STATUS_ICON_MISSING = '\u{26AA}'; // ⚪

export interface RawMergedOverrideConfigEntry {
  coreSettings?: unknown;
}

export interface PreparedOverrideReportEntry {
  overrideOption: PresetOptionMetadata;
  rawOverrideCoreSettingsConfig: unknown;
  normalizedOverrideCoreSettingsConfig: unknown;
  normalizedOverrideDiffHumanReadable: unknown;
}

export interface PreparedAppliedOverrideReportEntry {
  overrideId: string;
  rawOverrideCoreSettingsConfig: unknown;
}

export interface BuildConfigReportMarkdownArgs {
  hasUserConfig: boolean;
  overrideOptions: PresetOptionMetadata[];
  activeOverrideIds?: string[];
  currentNormalizedConfigLabel: string;
  currentNormalizedConfigDescription: string;
  currentNormalizedConfigValue: unknown;
  rawUserCoreSettingsConfig: unknown;
  rawSystemCoreSettingsConfig: unknown;
  preparedOverrideReportEntries: PreparedOverrideReportEntry[];
  leadingSectionsMarkdown?: string;
}

export interface BuildStatusOverviewMarkdownArgs {
  hasUserConfig: boolean;
  overrideOptions: PresetOptionMetadata[];
  activeOverrideIds?: string[];
  shouldAlwaysMarkCurrentSourceAsApplied?: boolean;
  shouldOmitOverrideNamesInCurrentSourceLine?: boolean;
}

export function buildPreparedAppliedOverrideReportEntriesFromData(
  debugData: MergedConfigDebugData
): PreparedAppliedOverrideReportEntry[] {
  const activeOverrideIdsSet = new Set(debugData.activePresetsIds);

  return debugData.presetReportEntries
    .filter(overrideReportEntry => activeOverrideIdsSet.has(overrideReportEntry.presetOptionMetadata.id))
    .map(overrideReportEntry => ({
      overrideId: overrideReportEntry.presetOptionMetadata.id,
      rawOverrideCoreSettingsConfig: overrideReportEntry.rawPresetDependentSettingsConfig,
    }));
}

export function buildRawOverridesById(userConfig: UserConfig | null): Record<string, RawMergedOverrideConfigEntry> | null {
  const userOverridesById = userConfig?.presetsById;
  if (!userOverridesById) return null;

  const rawOverridesById: Record<string, RawMergedOverrideConfigEntry> = {};

  for (const overrideId of Object.keys(userOverridesById)) {
    rawOverridesById[overrideId] = {
      coreSettings: userOverridesById[overrideId]?.presetDependentSettings ?? null,
    };
  }

  return rawOverridesById;
}

export function buildConfigReportMarkdown(args: BuildConfigReportMarkdownArgs): string {
  let reportText = '';

  reportText += '# Config Report\n\n';

  reportText += buildStatusOverviewMarkdown({
    hasUserConfig: args.hasUserConfig,
    overrideOptions: args.overrideOptions,
    activeOverrideIds: args.activeOverrideIds,
  });

  if (args.leadingSectionsMarkdown) reportText += args.leadingSectionsMarkdown;

  reportText += `## ${NORMALIZED_CONFIG_STATUS} ${args.currentNormalizedConfigLabel}\n\n`;
  reportText += `${args.currentNormalizedConfigDescription}\n\n`;
  reportText += buildJsonCodeBlock(args.currentNormalizedConfigValue);

  if (args.hasUserConfig) {
    reportText += `## ${RAW_CONFIG_BEFORE_NORMALIZATION_STATUS} User Config: ${GLOB_CONSTS.USER_CONFIG_FILE_NAME}\n\n`;
    reportText += buildJsonCodeBlock(args.rawUserCoreSettingsConfig);
  } else {
    reportText += `## No User Config was found (${GLOB_CONSTS.USER_CONFIG_FILE_NAME})\n\n`;
  }

  reportText += `## ${RAW_CONFIG_BEFORE_NORMALIZATION_STATUS} System Config: ${GLOB_CONSTS.SYS_CONFIG_FILE_NAME}\n\n`;
  reportText += buildJsonCodeBlock(args.rawSystemCoreSettingsConfig);

  for (const preparedOverrideReportEntry of args.preparedOverrideReportEntries)
    reportText += buildOverrideSectionMarkdown(preparedOverrideReportEntry);

  return reportText.trimEnd();
}

export function buildAppliedOverridesRawConfigsMarkdown(
  preparedAppliedOverrideReportEntries: PreparedAppliedOverrideReportEntry[]
): string {
  if (preparedAppliedOverrideReportEntries.length === 0) return '';

  let rawConfigsText = '';

  for (const preparedAppliedOverrideReportEntry of preparedAppliedOverrideReportEntries) {
    rawConfigsText += `## ${RAW_CONFIG_BEFORE_NORMALIZATION_STATUS} Override "${preparedAppliedOverrideReportEntry.overrideId}"\n\n`;
    rawConfigsText += buildJsonCodeBlock(preparedAppliedOverrideReportEntry.rawOverrideCoreSettingsConfig);
  }

  return rawConfigsText;
}

export function buildStatusOverviewMarkdown(args: BuildStatusOverviewMarkdownArgs): string {
  const baseCoreSettingsSource = args.hasUserConfig ? 'System + User Config' : 'System Config';
  const activeOverrideIdsSet = new Set(args.activeOverrideIds ?? []);
  const activeOverrideIds = [...activeOverrideIdsSet].filter(Boolean);
  const isBaseConfigCurrentlyApplied = activeOverrideIds.length === 0;

  const currentCoreSettingsSource = args.shouldOmitOverrideNamesInCurrentSourceLine
    ? baseCoreSettingsSource
    : activeOverrideIds.length > 0
      ? `${baseCoreSettingsSource} + ${activeOverrideIds.map(overrideId => `"${overrideId}"`).join(' + ')} Override Config(s)`
      : baseCoreSettingsSource;

  const currentSourceStatusIcon = args.shouldAlwaysMarkCurrentSourceAsApplied
    ? STATUS_ICON_APPLIED
    : isBaseConfigCurrentlyApplied
      ? STATUS_ICON_APPLIED
      : STATUS_ICON_AVAILABLE;

  let statusOverviewText = '';

  statusOverviewText += '## Status Overview\n\n';
  statusOverviewText += '### Base Config Sources\n\n';
  statusOverviewText += `${STATUS_ICON_APPLIED} System Config (${GLOB_CONSTS.SYS_CONFIG_FILE_NAME}): Loaded\n`;
  statusOverviewText += `${args.hasUserConfig ? STATUS_ICON_APPLIED : STATUS_ICON_AVAILABLE} User Config (${GLOB_CONSTS.USER_CONFIG_FILE_NAME}): ${args.hasUserConfig ? 'Loaded' : 'Not Found'}\n\n`;
  statusOverviewText += '### Core Settings Sources\n\n';
  statusOverviewText += `${currentSourceStatusIcon} ${currentCoreSettingsSource}\n`;

  if (args.overrideOptions.length > 0) {
    for (const overrideOption of args.overrideOptions) {
      const isOverrideCurrentlyApplied = activeOverrideIdsSet.has(overrideOption.id);

      statusOverviewText += `${isOverrideCurrentlyApplied ? STATUS_ICON_APPLIED : STATUS_ICON_AVAILABLE} "${overrideOption.id}" Override Config\n`;
    }

    statusOverviewText += '\n';
  } else {
    statusOverviewText += `${STATUS_ICON_MISSING} Override Config: None was detected.\n\n`;
  }

  return statusOverviewText;
}

export async function buildJsonDiffChangeset(previousValue: unknown, nextValue: unknown): Promise<unknown> {
  const { diff } = await import('json-diff-ts');

  return diff(previousValue, nextValue);
}

export function buildJsonCodeBlock(value: unknown): string {
  const tripleTicks = '`' + '``';

  return `${tripleTicks}json\n${JSON.stringify(value, null, 2)}\n${tripleTicks}\n\n`;
}

export function buildHumanReadableJsonDiffChangeset(
  value: unknown,
  previousValueKey: string,
  nextValueKey: string
): unknown {
  if (Array.isArray(value))
    return value.map(item => buildHumanReadableJsonDiffChangeset(item, previousValueKey, nextValueKey));

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

    nextObject[nextKey] = buildHumanReadableJsonDiffChangeset(childValue, previousValueKey, nextValueKey);
  }

  return nextObject;
}

function buildOverrideSectionMarkdown(preparedOverrideReportEntry: PreparedOverrideReportEntry): string {
  let sectionText = '';

  sectionText += `## ${NORMALIZED_CONFIG_STATUS} Override: "${preparedOverrideReportEntry.overrideOption.id}"\n\n`;

  sectionText += `### ${RAW_CONFIG_BEFORE_NORMALIZATION_STATUS} Override Diffs\n\n`;
  sectionText += buildJsonCodeBlock(preparedOverrideReportEntry.rawOverrideCoreSettingsConfig);

  sectionText += `### ${JSON_DIFF_STATUS} Normalized Override vs Base Config\n\n`;
  sectionText += buildJsonCodeBlock(preparedOverrideReportEntry.normalizedOverrideDiffHumanReadable);

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
  sectionText += buildJsonCodeBlock(preparedOverrideReportEntry.normalizedOverrideCoreSettingsConfig);

  return sectionText;
}
