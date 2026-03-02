import * as vscode from 'vscode';

import { ConfigService } from '../../../config-service';
import { CollectedFileItem } from '../../../types/files-payload';
import { buildLlmContextText } from './llm-context-formatter';
import { TechPromptBuilder } from './tech-prompt-builder';

export async function buildLlmPromptTextForProfiles(args: {
  extensionContext: vscode.ExtensionContext;
  configService: ConfigService;
  profileIds: string[];
  includeTechPromptFromCommand: boolean;
  fileItems: CollectedFileItem[];
}): Promise<string> {
  const effectiveConfig = await args.configService.buildEffectiveConfigForProfileIds(args.profileIds);

  const shouldIncludeTechPrompt = args.includeTechPromptFromCommand && effectiveConfig.baseSettings.skipTechPrompt !== true;

  const effectiveFileItems = effectiveConfig.baseSettings.skipCodeListings === true ? [] : args.fileItems;

  const techPromptText = shouldIncludeTechPrompt
    ? await new TechPromptBuilder(args.extensionContext, effectiveConfig).build()
    : '';

  return buildLlmContextText({
    fileItems: effectiveFileItems,
    includeTechPrompt: shouldIncludeTechPrompt,
    config: effectiveConfig,
    techPromptText,
  });
}

export async function buildMergedConfigMarkdownReportText(args: {
  baseSettingsConfig: unknown;
  mergedSettingsConfig: unknown;
  profilesById: Record<string, { profileSettingsConfig?: unknown }>;
  selectedProfileIds: string[];
}): Promise<string> {
  const normalizedSelectedProfileIds = (args.selectedProfileIds ?? [])
    .filter(Boolean)
    .filter(profileId => profileId !== 'Default');

  const mergeChainText =
    normalizedSelectedProfileIds.length > 0 ? `Base Config + ${normalizedSelectedProfileIds.join(' + ')}` : 'Base Config';

  const { diff } = await import('json-diff-ts'); // json-diff-ts is ESM-only, dynamic import avoids CommonJS require
  const changeset = diff(args.baseSettingsConfig, args.mergedSettingsConfig);
  const humanReadableChangeset = buildHumanReadableJsonDiffChangeset(changeset);

  let reportText = '';
  const tripleTicks = '`' + '``';
  const tripleTicksThen2N = `${tripleTicks}\n\n`;
  const tripleTicksWithJson = `${tripleTicks}json\n`;

  reportText += '# Merged Config Report\n\n';
  reportText += `Merged Config = ${mergeChainText}\n\n`;

  reportText += '## Diff (json-diff-ts changeset JSON format, not llm-copypaster config)\n\n';
  reportText += tripleTicksWithJson;
  reportText += `${JSON.stringify(humanReadableChangeset, null, 2)}\n`;
  reportText += tripleTicksThen2N;

  reportText += '## Merged Config\n\n';
  reportText += tripleTicksWithJson;
  reportText += `${JSON.stringify(args.mergedSettingsConfig, null, 2)}\n`;
  reportText += tripleTicksThen2N;

  reportText += '## Base Config\n\n';
  reportText += tripleTicksWithJson;
  reportText += `${JSON.stringify(args.baseSettingsConfig, null, 2)}\n`;
  reportText += tripleTicksThen2N;

  for (const profileId of Object.keys(args.profilesById ?? {})) {
    const profile = args.profilesById[profileId];
    const profileOnlyConfiguredSettings = profile?.profileSettingsConfig ?? {};

    reportText += `## ${profileId}\n\n`;
    reportText += tripleTicksWithJson;
    reportText += `${JSON.stringify(profileOnlyConfiguredSettings, null, 2)}\n`;
    reportText += tripleTicksThen2N;
  }

  return reportText.trimEnd();
}

function buildHumanReadableJsonDiffChangeset(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => buildHumanReadableJsonDiffChangeset(item));

  if (!value || typeof value !== 'object') return value;

  const anyObject = value as Record<string, unknown>;
  const nextObject: Record<string, unknown> = {};

  for (const [key, childValue] of Object.entries(anyObject)) {
    if (key === 'type') continue; // Drop json-diff-ts change type (it's always UPDATE in our use-case)

    let nextKey = key;

    switch (key) {
      case 'key':
        nextKey = 'fieldOrSectionName'; // key -> fieldOrSectionName
        break;

      case 'changes':
        nextKey = 'diff'; // changes -> diff
        break;

      case 'value':
      case 'newValue':
        nextKey = 'mergedConfigValue'; // value/newValue -> mergedConfigValue
        break;

      case 'oldValue':
        nextKey = 'baseConfigValue'; // oldValue -> baseConfigValue
        break;

      default:
        nextKey = key; // Keep other keys as-is
        break;
    }

    nextObject[nextKey] = buildHumanReadableJsonDiffChangeset(childValue);
  }

  return nextObject;
}
