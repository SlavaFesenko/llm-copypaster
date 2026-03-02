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
  const renamedChangeset = renameJsonDiffValueKeys(changeset);

  let reportText = '';
  const tripleTicks = '`' + '``';
  const tripleTicksThen2N = `${tripleTicks}\n\n`;
  const tripleTicksWithJson = `${tripleTicks}json\n`;

  reportText += '# Merged Config Report\n\n';
  reportText += `Merged Config = ${mergeChainText}\n\n`;

  reportText += '## Diff (json-diff-ts changeset JSON, not llm-copypaster config)\n\n';
  reportText += tripleTicksWithJson;
  reportText += `${JSON.stringify(renamedChangeset, null, 2)}\n`;
  reportText += tripleTicksThen2N;

  reportText += '## Merged Config (All Settings)\n\n';
  reportText += tripleTicksWithJson;
  reportText += `${JSON.stringify(args.mergedSettingsConfig, null, 2)}\n`;
  reportText += tripleTicksThen2N;

  reportText += '## Base Config (All Settings)\n\n';
  reportText += tripleTicksWithJson;
  reportText += `${JSON.stringify(args.baseSettingsConfig, null, 2)}\n`;
  reportText += tripleTicksThen2N;

  for (const profileId of Object.keys(args.profilesById ?? {})) {
    const profile = args.profilesById[profileId];
    const profileOnlyConfiguredSettings = profile?.profileSettingsConfig ?? {};

    reportText += `## ${profileId} (Only Configured Settings)\n\n`;
    reportText += '`' + '``json\n';
    reportText += `${JSON.stringify(profileOnlyConfiguredSettings, null, 2)}\n`;
    reportText += '`' + '``\n\n';
  }

  return reportText.trimEnd();
}

function renameJsonDiffValueKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => renameJsonDiffValueKeys(item));

  if (!value || typeof value !== 'object') return value;

  const anyObject = value as Record<string, unknown>;
  const nextObject: Record<string, unknown> = {};

  for (const [key, childValue] of Object.entries(anyObject)) {
    const nextKey = key === 'oldValue' ? 'baseConfigValue' : key === 'newValue' ? 'mergedConfigValue' : key;

    nextObject[nextKey] = renameJsonDiffValueKeys(childValue);
  }

  return nextObject;
}
