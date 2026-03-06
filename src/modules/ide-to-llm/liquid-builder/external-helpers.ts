import * as vscode from 'vscode';

import { ConfigService, OverrideOptionMetadata } from '../../../config-service';
import { CollectedFileItem } from '../../../types/files-payload';
import { buildLlmContextText } from '../utils/llm-context-formatter';
import { PromptBuilder } from './prompt-builder';

export async function buildLlmPromptTextForProfiles(args: {
  extensionContext: vscode.ExtensionContext;
  configService: ConfigService;
  profileIds: string[];
  includeTechPromptFromCommand: boolean;
  fileItems: CollectedFileItem[];
  forceSkipTechPrompt?: boolean;
}): Promise<string> {
  const selectedOverrideId = getSelectedOverrideId(args.profileIds);
  const effectiveConfig = await args.configService.getLlmCopypasterPublicConfig(selectedOverrideId);

  const shouldIncludeTechPrompt =
    args.includeTechPromptFromCommand &&
    args.forceSkipTechPrompt !== true &&
    effectiveConfig.coreSettings.skipInstructions !== true;

  const effectiveFileItems = effectiveConfig.coreSettings.skipCodeListings === true ? [] : args.fileItems;

  const techPromptText = shouldIncludeTechPrompt
    ? await new PromptBuilder(args.extensionContext, effectiveConfig).build()
    : '';

  return buildLlmContextText({
    fileItems: effectiveFileItems,
    ignorePromptInstructions: !shouldIncludeTechPrompt,
    config: effectiveConfig,
    techPromptText,
  });
}

export async function buildMergedConfigMarkdownReportText(args: {
  configService: ConfigService;
  baseSettingsConfig: unknown;
  mergedSettingsConfig: unknown;
  overrideOptions: OverrideOptionMetadata[];
  selectedProfileIds: string[];
}): Promise<string> {
  const normalizedSelectedProfileIds = (args.selectedProfileIds ?? [])
    .filter(Boolean)
    .filter(profileId => profileId !== 'Default');

  const mergeChainText =
    normalizedSelectedProfileIds.length > 0
      ? `Base Config + ${normalizedSelectedProfileIds.join(' + ')} Override Config(s)`
      : 'Base Config';

  const { diff } = await import('json-diff-ts'); // json-diff-ts is ESM-only, dynamic import avoids CommonJS require
  const changeset = diff(args.baseSettingsConfig, args.mergedSettingsConfig);
  const humanReadableChangeset = buildHumanReadableJsonDiffChangeset(changeset);

  let reportText = '';
  const tripleTicks = '`' + '``';
  const tripleTicksThen2N = `${tripleTicks}\n\n`;
  const tripleTicksWithJson = `${tripleTicks}json\n`;

  reportText += '# Merged Config Report\n\n';
  reportText += `Merged Config = ${mergeChainText}\n\n`;

  reportText += '## Diff: Merged vs Base (json-diff-ts changeset JSON format, NOT Llm-Copypaster config)\n\n';
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

  for (const overrideOption of args.overrideOptions) {
    const overrideCoreSettingsConfig = await args.configService.getCoreSettingsConfig(overrideOption.id);

    reportText += `## ${overrideOption.id}\n\n`;
    reportText += tripleTicksWithJson;
    reportText += `${JSON.stringify(overrideCoreSettingsConfig, null, 2)}\n`;
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

function getSelectedOverrideId(profileIds: string[]): string | undefined {
  return [...(profileIds ?? [])].reverse().find(profileId => profileId !== 'Default');
}
