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

  let selectedProfileIds: string[] = [];
  let currentPromptText = args.promptText;

  while (true) {
    const effectiveConfig = await deps.configService.buildEffectiveConfigForProfileIds(selectedProfileIds);

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

    const hasNoSelectedProfiles = selectedProfileIds.length === 0;

    const applyOrChangeProfilesLabel = hasNoSelectedProfiles ? 'Apply Profiles' : 'Change Profiles';

    const actionLabels = [
      openPromptInEditor,
      ...(hasProfiles ? [applyOrChangeProfilesLabel] : []),
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

    if (selectedAction === applyOrChangeProfilesLabel) {
      const profilesById = await deps.configService.getProfilesById();

      const nextProfileIds = await pickProfileIds({ profilesById, selectedProfileIds });
      if (!nextProfileIds) return;

      selectedProfileIds = nextProfileIds;

      const rebuiltPrompt = await rebuildPromptTextForProfiles(deps, {
        profileIds: selectedProfileIds,
        includeTechPromptFromCommand: args.includeTechPrompt,
        fileItems: args.fileItems,
      });

      currentPromptText = rebuiltPrompt;

      await vscode.env.clipboard.writeText(currentPromptText);
      continue;
    }
  }
}

async function rebuildPromptTextForProfiles(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  args: {
    profileIds: string[];
    includeTechPromptFromCommand: boolean;
    fileItems: CollectedFileItem[];
  }
): Promise<string> {
  const effectiveConfig = await deps.configService.buildEffectiveConfigForProfileIds(args.profileIds);

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

async function pickProfileIds(args: {
  profilesById: Record<string, { description: string; version?: string }>;
  selectedProfileIds: string[];
}): Promise<string[] | null> {
  const selectedProfileIdsSet = new Set(args.selectedProfileIds);

  const items: ApplyProfileQuickPickItem[] = [
    {
      profileId: '',
      label: 'Profiles are merged into base settings (order matters: last wins)',
      kind: vscode.QuickPickItemKind.Separator,
    },
  ];

  for (const profileId of Object.keys(args.profilesById)) {
    const profile = args.profilesById[profileId];
    const descriptionSuffix = profile.description ? `: ${profile.description}` : '';
    const version = profile.version ? `v${profile.version}` : '';

    items.push({
      profileId,
      label: profileId,
      detail: `${version}${descriptionSuffix}`,
      picked: selectedProfileIdsSet.has(profileId),
    });
  }

  const selectedItems = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select profiles to merge and apply to prompt (empty selection = base only)',
    canPickMany: true,
  });

  if (!selectedItems) return null;

  return selectedItems.map(selectedItem => selectedItem.profileId).filter(Boolean);
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
