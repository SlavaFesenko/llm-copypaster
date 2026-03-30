import { MergedConfigDebugData } from '../config-service';
import {
  JSON_DIFF_STATUS,
  NORMALIZED_CONFIG_STATUS,
  buildAppliedOverridesRawConfigsMarkdown,
  buildHumanReadableJsonDiffChangeset,
  buildJsonCodeBlock,
  buildJsonDiffChangeset,
  buildPreparedAppliedOverrideReportEntriesFromData,
  buildStatusOverviewMarkdown,
} from './report-common-helper';

export async function buildOverridesAppliedReportText(debugData: MergedConfigDebugData): Promise<string> {
  const preparedAppliedOverrideReportEntries = buildPreparedAppliedOverrideReportEntriesFromData(debugData);

  const normalizedOverrideDiffChangeset = await buildJsonDiffChangeset(
    debugData.systemUserMergedConfig,
    debugData.mergedCoreSettingsConfig
  );

  const normalizedOverrideDiffHumanReadable = buildHumanReadableJsonDiffChangeset(
    normalizedOverrideDiffChangeset,
    'baseConfigValue',
    'overridesConfigValue'
  );

  let reportText = '';

  reportText += '# Config Report\n\n';

  reportText += buildStatusOverviewMarkdown({
    hasUserConfig: debugData.hasUserConfig,
    overrideOptions: debugData.overrideOptions,
    activeOverrideIds: debugData.activeOverrideIds,
    shouldAlwaysMarkCurrentSourceAsApplied: true,
    shouldOmitOverrideNamesInCurrentSourceLine: true,
  });

  reportText += buildAppliedOverridesRawConfigsMarkdown(preparedAppliedOverrideReportEntries);

  reportText += `## ${JSON_DIFF_STATUS} Overrides Config vs Base Config\n\n`;
  reportText += buildJsonCodeBlock(normalizedOverrideDiffHumanReadable);

  reportText += `## ${NORMALIZED_CONFIG_STATUS} Overrides Config (after raw-overrides one-by-one apply to Base Config)\n\n`;
  reportText += buildJsonCodeBlock(debugData.mergedCoreSettingsConfig);

  reportText += `## ${NORMALIZED_CONFIG_STATUS} Base Config (before overrides)\n\n`;
  reportText += buildJsonCodeBlock(debugData.systemUserMergedConfig);

  return reportText.trimEnd();
}
