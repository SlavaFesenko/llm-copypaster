import * as vscode from 'vscode';

import { ConfigService } from '../../config-service';
import { CollectedFileItem } from '../../types/files-payload';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { buildLlmContextText } from './utils/llm-context-formatter';
import { PromptSizeExceededBy, buildPromptWithSizeStats } from './utils/prompt-size-helper';
import { TechPromptBuilder } from './utils/tech-prompt-builder';
import { closeUnavailableTabs, formatCountInThousands } from './utils/uncategorized-helpers';

export interface EditorToLlmModulePrivateHelpersDependencies {
  extensionContext: vscode.ExtensionContext;
  configService: ConfigService;
  logger: OutputChannelLogger;
}

export interface ReadUrisAsFileItemsResult {
  fileItems: CollectedFileItem[];
  deletedFileUris: vscode.Uri[];
}

export interface TabBasedFileItemsResult {
  fileItems: CollectedFileItem[];
  deletedFileUris: vscode.Uri[];
  unresolvedTabs: vscode.Tab[];
}

export interface EditorToLlmPromptSizeStats {
  linesCount: number;
  approxTokensCount: number;
  maxLinesCountInContext: number;
  maxTokensCountInContext: number;
  isExceeded: boolean;
  exceededBy: PromptSizeExceededBy[];
}

export interface ShowCopyResultNotificationArgs {
  commandName: string;
  includeTechPrompt: boolean;
  copiedFilesCount: number;
  totalFilesCount: number;
  deletedFileUris: vscode.Uri[];
  unresolvedTabs: vscode.Tab[];
  promptText: string;
  fileItems: CollectedFileItem[];
  promptSizeStats?: EditorToLlmPromptSizeStats;
}

export type ExplorerCopySelectionSource = 'SELECTED' | 'CLICKED' | 'BOTH';

export function tryGetUriFromTab(tab: vscode.Tab): vscode.Uri | null {
  if (tab.input instanceof vscode.TabInputText) {
    return tab.input.uri;
  }

  const anyInput = tab.input as unknown as { uri?: vscode.Uri };
  if (anyInput?.uri instanceof vscode.Uri) {
    return anyInput.uri;
  }

  return null;
}

export function buildUriKey(uri: vscode.Uri): string {
  if (uri.scheme === 'file' && uri.fsPath) return uri.fsPath;

  return uri.toString();
}

export async function readUrisAsFileItems(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  uris: vscode.Uri[]
): Promise<ReadUrisAsFileItemsResult> {
  const dedupedByPathMap = new Map<string, vscode.Uri>();

  for (const uri of uris) {
    const relativePath = vscode.workspace.asRelativePath(uri, false);
    if (!relativePath) continue;

    if (!dedupedByPathMap.has(relativePath)) dedupedByPathMap.set(relativePath, uri);
  }

  const fileItems: CollectedFileItem[] = [];
  const deletedFileUris: vscode.Uri[] = [];

  for (const [relativePath, uri] of dedupedByPathMap.entries()) {
    const readResult = await tryReadFileAsText(uri);

    if (readResult.isFileNotFound) {
      deletedFileUris.push(uri);
      continue;
    }

    fileItems.push({
      path: relativePath,
      content: readResult.text,
      languageId: readResult.languageId,
      readError: readResult.readError,
    });
  }

  return { fileItems, deletedFileUris };
}

export async function tryReadFileAsText(
  uri: vscode.Uri
): Promise<{ text: string | null; languageId?: string; readError?: string; isFileNotFound: boolean }> {
  try {
    const document = await vscode.workspace.openTextDocument(uri);

    return { text: document.getText(), languageId: document.languageId, isFileNotFound: false };
  } catch (error) {
    const message = String(error);

    return { text: null, readError: message, isFileNotFound: isFileNotFoundError(error) };
  }
}

export function isFileNotFoundError(error: unknown): boolean {
  const anyError = error as { code?: unknown; name?: unknown; message?: unknown } | null;
  const code = String(anyError?.code ?? '');
  if (code === 'FileNotFound') return true;

  const message = String(anyError?.message ?? error ?? '');

  if (message.includes('FileNotFound')) return true;
  if (message.includes('ENOENT')) return true;
  if (message.includes('no such file or directory')) return true;

  const name = String(anyError?.name ?? '');
  if (name.includes('FileNotFound')) return true;

  return false;
}

export async function showCopyResultNotification(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  args: ShowCopyResultNotificationArgs
): Promise<void> {
  const unavailableFilesCount = args.totalFilesCount - args.copiedFilesCount;

  const closeUnavailableActionLabel =
    unavailableFilesCount > 0 ? `Close ${unavailableFilesCount} unavailable file(s) in Editor` : '';

  const hasProfiles = await deps.configService.hasAvailableProfiles();

  const openPromptInEditor = 'Open Prompt in Editor';

  let selectedProfileId = 'Default';
  let currentPromptText = args.promptText;

  while (true) {
    const effectiveConfig = await deps.configService.buildEffectiveConfigForProfileId(selectedProfileId);

    const promptStatsResult = buildPromptWithSizeStats({
      promptText: currentPromptText,
      config: effectiveConfig,
    });

    const shouldShowPromptSizeStats =
      effectiveConfig.baseSettings.ideToLlmContextConfig.skipPromptSizeStatsInCopyNotification !== true;

    const baseMessage =
      unavailableFilesCount === 0
        ? `Copied ${args.copiedFilesCount} file(s)`
        : `Copied ${args.copiedFilesCount}/${args.totalFilesCount} available file(s)`;

    const promptSizeStatsSuffix = shouldShowPromptSizeStats
      ? buildPromptSizeStatsSuffix({
          linesCount: promptStatsResult.linesCount,
          approxTokensCount: promptStatsResult.approxTokensCount,
          maxLinesCountInContext: promptStatsResult.maxLinesCountInContext,
          maxTokensCountInContext: promptStatsResult.maxTokensCountInContext,
          isExceeded: promptStatsResult.isExceeded,
          exceededBy: promptStatsResult.exceededBy,
        })
      : '';

    const message = promptSizeStatsSuffix ? `${baseMessage} | ${promptSizeStatsSuffix}` : baseMessage;

    const shouldWarn = shouldShowPromptSizeStats ? Boolean(promptStatsResult.isExceeded) : false;

    const applyOrChangeProfileLabel = selectedProfileId === 'Default' ? 'Apply Profile' : 'Change Profile';

    const actionLabels = [
      openPromptInEditor,
      ...(hasProfiles ? [applyOrChangeProfileLabel] : []),
      ...(closeUnavailableActionLabel ? [closeUnavailableActionLabel] : []),
    ];

    let selectedAction: string | undefined;

    if (actionLabels.length > 0) {
      if (shouldWarn) selectedAction = await vscode.window.showWarningMessage(message, ...actionLabels);
      else selectedAction = await vscode.window.showInformationMessage(message, ...actionLabels);
    } else {
      if (shouldWarn) selectedAction = await vscode.window.showWarningMessage(message);
      else selectedAction = await vscode.window.showInformationMessage(message);
    }

    if (!selectedAction) return;

    if (selectedAction === openPromptInEditor) {
      await openPromptTextInEditor(currentPromptText);
      return;
    }

    if (selectedAction === closeUnavailableActionLabel) {
      await closeUnavailableTabs(deps, {
        deletedFileUris: args.deletedFileUris,
        unresolvedTabs: args.unresolvedTabs,
      });

      continue;
    }

    if (selectedAction === applyOrChangeProfileLabel) {
      const profilesById = await deps.configService.getProfilesById();

      const nextProfileId = await pickProfileId({ profilesById, selectedProfileId });
      if (!nextProfileId) return;

      selectedProfileId = nextProfileId;

      const rebuiltPrompt = await rebuildPromptTextForProfile(deps, {
        profileId: selectedProfileId,
        includeTechPromptFromCommand: args.includeTechPrompt,
        fileItems: args.fileItems,
      });

      currentPromptText = rebuiltPrompt;

      await vscode.env.clipboard.writeText(currentPromptText);
      continue;
    }
  }
}

async function rebuildPromptTextForProfile(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  args: {
    profileId: string;
    includeTechPromptFromCommand: boolean;
    fileItems: CollectedFileItem[];
  }
): Promise<string> {
  const effectiveConfig = await deps.configService.buildEffectiveConfigForProfileId(args.profileId);

  const shouldIncludeTechPrompt = args.includeTechPromptFromCommand && effectiveConfig.baseSettings.skipTechPrompt !== true;

  const effectiveFileItems = effectiveConfig.baseSettings.skipCodeListings === true ? [] : args.fileItems;

  const techPromptText = shouldIncludeTechPrompt
    ? await new TechPromptBuilder(deps.extensionContext, effectiveConfig).build()
    : '';

  return buildLlmContextText({
    fileItems: effectiveFileItems,
    includeTechPrompt: shouldIncludeTechPrompt,
    config: effectiveConfig,
    techPromptText,
  });
}

interface ApplyProfileQuickPickItem extends vscode.QuickPickItem {
  profileId: string;
}

async function pickProfileId(args: {
  profilesById: Record<string, { description: string; version: string }>;
  selectedProfileId: string;
}): Promise<string | null> {
  const items: ApplyProfileQuickPickItem[] = [
    {
      profileId: 'Default',
      label: args.selectedProfileId === 'Default' ? 'Default (currently selected)' : 'Default',
      detail: 'Base settings',
    },
  ];

  for (const profileId of Object.keys(args.profilesById)) {
    const profile = args.profilesById[profileId];
    const descriptionSuffix = profile.description ? `: ${profile.description}` : '';

    items.push({
      profileId,
      label: args.selectedProfileId === profileId ? `${profileId} (currently selected)` : profileId,
      detail: `v${profile.version}${descriptionSuffix}`,
    });
  }

  const selectedItem = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select profile to apply to prompt',
    canPickMany: false,
  });

  return selectedItem?.profileId ?? null;
}

function buildPromptSizeStatsSuffix(promptSizeStats: EditorToLlmPromptSizeStats | null): string {
  if (!promptSizeStats) return '';

  const isLinesExceeded = promptSizeStats.exceededBy.includes(PromptSizeExceededBy.LINES);
  const isTokensExceeded = promptSizeStats.exceededBy.includes(PromptSizeExceededBy.TOKENS);

  const linesPart = `${isLinesExceeded ? 'Lines!:' : 'Lines:'} ~${formatCountInThousands(promptSizeStats.linesCount)}/${formatCountInThousands(
    promptSizeStats.maxLinesCountInContext
  )}`;

  const tokensPart = `${isTokensExceeded ? 'Tokens!:' : 'Tokens:'} ~${formatCountInThousands(
    promptSizeStats.approxTokensCount
  )}/${formatCountInThousands(promptSizeStats.maxTokensCountInContext)}`;

  return `${linesPart}; ${tokensPart};`;
}

async function openPromptTextInEditor(promptText: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({ content: promptText, language: 'markdown' });
  await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: false });
}
