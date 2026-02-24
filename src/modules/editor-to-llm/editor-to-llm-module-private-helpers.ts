import * as vscode from 'vscode';

import { ConfigService } from '../../config';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { loadDefaultCopyAsContextPrompt } from './default-copy-as-context-prompt-loader';
import { buildLlmContextText } from './llm-context-formatter';
import { buildTabGroupQuickPickItems, findTabGroupsContainingUri, tryGetUriFromTab } from './tab-group-picker-helpers';

interface EditorToLlmCollectedFileItem {
  path: string;
  content: string | null;
  languageId?: string;
  readError?: string;
}

interface ReadUrisAsFileItemsResult {
  fileItems: EditorToLlmCollectedFileItem[];
  deletedFileUris: vscode.Uri[];
}

interface TabBasedFileItemsResult {
  fileItems: EditorToLlmCollectedFileItem[];
  deletedFileUris: vscode.Uri[];
  unresolvedTabs: vscode.Tab[];
}

type ExplorerCopySelectionSource = 'SELECTED' | 'CLICKED' | 'BOTH';

export interface EditorToLlmModulePrivateHelpersDependencies {
  extensionContext: vscode.ExtensionContext;
  configService: ConfigService;
  logger: OutputChannelLogger;
}

export async function copyExplorerUrisAsContext(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  args: {
    inputUris: vscode.Uri[];
    selectionSource: ExplorerCopySelectionSource;
    includeTechPrompt: boolean;
  }
): Promise<void> {
  const selection = await collectExplorerItemsFileItems(deps, args.inputUris);

  const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length;

  if (totalFilesCount === 0) {
    await vscode.window.showWarningMessage('No files found in explorer selection');
    return;
  }

  if (selection.fileItems.length > 0) {
    const config = await deps.configService.getConfig();
    const techPromptText = args.includeTechPrompt ? await loadDefaultCopyAsContextPrompt(deps.extensionContext) : '';

    const fileItems = config.EnableCodefenceWrappingOnCopying
      ? selection.fileItems.map(fileItem => ({
          ...fileItem,
          content: wrapContentWithCodeFence(fileItem.content ?? '', fileItem.languageId ?? ''),
        }))
      : selection.fileItems;

    const contextText = buildLlmContextText({
      fileItems,
      includeTechPrompt: args.includeTechPrompt,
      config,
      techPromptText,
    });

    await vscode.env.clipboard.writeText(contextText);
  } else {
    await vscode.window.showWarningMessage('No files found in explorer selection');
    return;
  }

  await showCopyResultNotification(deps, {
    commandName: 'Copy Explorer Items',
    includeTechPrompt: args.includeTechPrompt,
    copiedFilesCount: selection.fileItems.length,
    totalFilesCount,
    deletedFileUris: selection.deletedFileUris,
    unresolvedTabs: [],
    selectionSourceLabel: args.selectionSource,
  });
}

export function wrapContentWithCodeFence(content: string, languageId: string): string {
  const normalizedLanguageId = languageId.trim();

  return normalizedLanguageId ? `\`\`\`${normalizedLanguageId}\n${content}\n\`\`\`` : `\`\`\`\n${content}\n\`\`\``;
}

export async function showCopyResultNotification(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  args: {
    commandName: string;
    includeTechPrompt: boolean;
    copiedFilesCount: number;
    totalFilesCount: number;
    deletedFileUris: vscode.Uri[];
    unresolvedTabs: vscode.Tab[];
    selectionSourceLabel?: ExplorerCopySelectionSource;
  }
): Promise<void> {
  const unavailableFilesCount = args.totalFilesCount - args.copiedFilesCount;
  const techPromptMarker = args.includeTechPrompt ? 'With Tech Prompt' : 'Without Tech Prompt';
  const commandDisplayName = `${args.commandName} ${techPromptMarker}`;

  const messagePrefix = args.selectionSourceLabel ? `Copied ${args.selectionSourceLabel} ` : 'Copied ';

  const message =
    unavailableFilesCount === 0
      ? `${messagePrefix}${args.copiedFilesCount} file(s) by '${commandDisplayName}'`
      : `${messagePrefix}${args.copiedFilesCount}/${args.totalFilesCount} available file(s) by '${commandDisplayName}'`;

  const closeUnavailableActionLabel =
    unavailableFilesCount > 0 ? `Close ${unavailableFilesCount} unavailable file(s) in Editor` : '';

  const selectedAction = closeUnavailableActionLabel
    ? await vscode.window.showInformationMessage(message, closeUnavailableActionLabel)
    : await vscode.window.showInformationMessage(message);

  if (selectedAction !== closeUnavailableActionLabel) return;

  await closeUnavailableTabs(deps, {
    deletedFileUris: args.deletedFileUris,
    unresolvedTabs: args.unresolvedTabs,
  });
}

export async function closeUnavailableTabs(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  args: { deletedFileUris: vscode.Uri[]; unresolvedTabs: vscode.Tab[] }
): Promise<void> {
  const tabsToClose: vscode.Tab[] = [];

  for (const unresolvedTab of args.unresolvedTabs) tabsToClose.push(unresolvedTab);

  if (args.deletedFileUris.length > 0) {
    const deletedUriStrings = new Set<string>(args.deletedFileUris.map(uri => uri.toString()));

    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        const tabUri = tryGetUriFromTab(tab);
        if (!tabUri) continue;

        if (deletedUriStrings.has(tabUri.toString())) tabsToClose.push(tab);
      }
    }
  }

  if (tabsToClose.length === 0) return;

  try {
    await vscode.window.tabGroups.close(tabsToClose);
  } catch (error) {
    deps.logger.warn(`Failed closing unavailable tabs: ${String(error)}`);
  }
}

export async function collectActiveTabGroupFileItems(
  deps: EditorToLlmModulePrivateHelpersDependencies
): Promise<TabBasedFileItemsResult> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };
  }

  const tabGroup = await pickTabGroupForTabGroupCopyCommand(deps);
  if (!tabGroup) {
    return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };
  }

  const tabUris: vscode.Uri[] = [];
  const unresolvedTabs: vscode.Tab[] = [];

  for (const tab of tabGroup.tabs) {
    const tabUri = tryGetUriFromTab(tab);
    if (!tabUri) {
      unresolvedTabs.push(tab);
      continue;
    }

    if (tabUri.scheme !== 'file') continue;

    tabUris.push(tabUri);
  }

  const readResult = await readUrisAsFileItems(deps, tabUris);

  return { ...readResult, unresolvedTabs };
}

export async function collectAllOpenTabsFileItems(
  deps: EditorToLlmModulePrivateHelpersDependencies
): Promise<TabBasedFileItemsResult> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };
  }

  const tabUris: vscode.Uri[] = [];
  const unresolvedTabs: vscode.Tab[] = [];

  for (const tabGroup of vscode.window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      const tabUri = tryGetUriFromTab(tab);
      if (!tabUri) {
        unresolvedTabs.push(tab);
        continue;
      }

      if (tabUri.scheme !== 'file') continue;

      tabUris.push(tabUri);
    }
  }

  const readResult = await readUrisAsFileItems(deps, tabUris);

  return { ...readResult, unresolvedTabs };
}

export async function collectAllPinnedTabsFileItems(
  deps: EditorToLlmModulePrivateHelpersDependencies
): Promise<TabBasedFileItemsResult> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };
  }

  const tabUris: vscode.Uri[] = [];
  const unresolvedTabs: vscode.Tab[] = [];

  for (const tabGroup of vscode.window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      if (!tab.isPinned) continue;

      const tabUri = tryGetUriFromTab(tab);
      if (!tabUri) {
        unresolvedTabs.push(tab);
        continue;
      }

      if (tabUri.scheme !== 'file') continue;

      tabUris.push(tabUri);
    }
  }

  const readResult = await readUrisAsFileItems(deps, tabUris);

  return { ...readResult, unresolvedTabs };
}

export async function collectPinnedTabsInActiveTabGroupFileItems(
  deps: EditorToLlmModulePrivateHelpersDependencies
): Promise<TabBasedFileItemsResult> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };
  }

  const tabGroup = await pickTabGroupForTabGroupCopyCommand(deps);
  if (!tabGroup) {
    return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };
  }

  const tabUris: vscode.Uri[] = [];
  const unresolvedTabs: vscode.Tab[] = [];

  for (const tab of tabGroup.tabs) {
    if (!tab.isPinned) continue;

    const tabUri = tryGetUriFromTab(tab);
    if (!tabUri) {
      unresolvedTabs.push(tab);
      continue;
    }

    if (tabUri.scheme !== 'file') continue;

    tabUris.push(tabUri);
  }

  const readResult = await readUrisAsFileItems(deps, tabUris);

  return { ...readResult, unresolvedTabs };
}

export async function pickTabGroupForTabGroupCopyCommand(
  deps: EditorToLlmModulePrivateHelpersDependencies
): Promise<vscode.TabGroup | null> {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) return vscode.window.tabGroups.activeTabGroup;

  const activeDocumentUri = activeEditor.document.uri;
  if (activeDocumentUri.scheme !== 'file') return vscode.window.tabGroups.activeTabGroup;

  const allTabGroups = vscode.window.tabGroups.all;

  const matchingTabGroups = findTabGroupsContainingUri({ uri: activeDocumentUri, tabGroups: allTabGroups });

  if (matchingTabGroups.length === 0) return vscode.window.tabGroups.activeTabGroup;

  if (matchingTabGroups.length === 1) return matchingTabGroups[0];

  const quickPickItems = buildTabGroupQuickPickItems({ tabGroups: matchingTabGroups, allTabGroups });

  const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
    placeHolder:
      "Select tab group to copy, since this file is open in multiple tab groups and VS Code API can't tell which group was clicked",
    canPickMany: false,
  });

  return selectedItem?.tabGroup ?? null;
}

export function buildExplorerSelectionSourceQuickPickItems(args: {
  selectedUris: vscode.Uri[];
  clickedUri: vscode.Uri;
}): Array<vscode.QuickPickItem & { selectionSource: ExplorerCopySelectionSource; uris: vscode.Uri[] }> {
  const selectedUrisCopy = [...args.selectedUris];
  const clickedUriCopy = args.clickedUri;

  const selectedUrisPreview = buildUrisPreviewText(selectedUrisCopy);
  const clickedUriPreview = buildUrisPreviewText([clickedUriCopy]);

  const bothUris = buildSelectedThenClickedUniqueUnion(selectedUrisCopy, clickedUriCopy);
  const bothUrisPreview = buildUrisPreviewText(bothUris);

  return [
    {
      label: `Copy SELECTED (${selectedUrisCopy.length})`,
      description: selectedUrisPreview,
      selectionSource: 'SELECTED',
      uris: selectedUrisCopy,
    },
    {
      label: 'Copy CLICKED (1)',
      description: clickedUriPreview,
      selectionSource: 'CLICKED',
      uris: [clickedUriCopy],
    },
    {
      label: `Copy BOTH (${bothUris.length})`,
      description: bothUrisPreview,
      selectionSource: 'BOTH',
      uris: bothUris,
    },
  ];
}

export function buildUrisPreviewText(uris: vscode.Uri[]): string {
  const previewLimit = 2;

  const pathPreviews: string[] = [];

  for (const uri of uris.slice(0, previewLimit)) {
    pathPreviews.push(vscode.workspace.asRelativePath(uri, false) || uri.fsPath || uri.toString());
  }

  const remainingCount = uris.length - pathPreviews.length;

  const previewText = pathPreviews.join(', ');

  if (!previewText && uris.length > 0) return `${uris.length} item(s)`;
  if (!previewText) return '';

  if (remainingCount <= 0) return previewText;

  return `${previewText} and ${remainingCount} more`;
}

export function buildSelectedThenClickedUniqueUnion(selectedUris: vscode.Uri[], clickedUri: vscode.Uri): vscode.Uri[] {
  const unionUris: vscode.Uri[] = [];

  const uniqueKeys = new Set<string>();

  for (const selectedUri of selectedUris) {
    const key = buildUriKey(selectedUri);
    if (uniqueKeys.has(key)) continue;

    uniqueKeys.add(key);
    unionUris.push(selectedUri);
  }

  const clickedKey = buildUriKey(clickedUri);
  if (!uniqueKeys.has(clickedKey)) unionUris.push(clickedUri);

  return unionUris;
}

export function uniqueByUriKeyKeepOrder(uris: vscode.Uri[]): vscode.Uri[] {
  const uniqueUris: vscode.Uri[] = [];
  const uniqueKeys = new Set<string>();

  for (const uri of uris) {
    const key = buildUriKey(uri);
    if (uniqueKeys.has(key)) continue;

    uniqueKeys.add(key);
    uniqueUris.push(uri);
  }

  return uniqueUris;
}

export function buildUriKey(uri: vscode.Uri): string {
  if (uri.scheme === 'file' && uri.fsPath) return uri.fsPath;

  return uri.toString();
}

export async function collectExplorerItemsFileItems(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  selectedUris: vscode.Uri[]
): Promise<ReadUrisAsFileItemsResult> {
  const allFileUris: vscode.Uri[] = [];

  for (const selectedUri of selectedUris) {
    const stat = await tryStat(deps, selectedUri);
    if (!stat) continue;

    if (stat.type & vscode.FileType.Directory) {
      const folderFileUris = await collectAllFilesInFolderRecursively(deps, selectedUri);
      for (const fileUri of folderFileUris) allFileUris.push(fileUri);
      continue;
    }

    if (stat.type & vscode.FileType.File) {
      allFileUris.push(selectedUri);
      continue;
    }
  }

  return await readUrisAsFileItems(deps, allFileUris);
}

export async function collectAllFilesInFolderRecursively(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  folderUri: vscode.Uri
): Promise<vscode.Uri[]> {
  const collectedFileUris: vscode.Uri[] = [];

  const entries = await tryReadDirectory(deps, folderUri);
  if (!entries) return collectedFileUris;

  for (const [entryName, entryType] of entries) {
    const entryUri = vscode.Uri.joinPath(folderUri, entryName);

    if (entryType & vscode.FileType.Directory) {
      const nestedFileUris = await collectAllFilesInFolderRecursively(deps, entryUri);
      for (const nestedFileUri of nestedFileUris) collectedFileUris.push(nestedFileUri);
      continue;
    }

    if (entryType & vscode.FileType.File) {
      collectedFileUris.push(entryUri);
      continue;
    }
  }

  return collectedFileUris;
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

  const fileItems: EditorToLlmCollectedFileItem[] = [];
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

export async function tryStat(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  uri: vscode.Uri
): Promise<vscode.FileStat | null> {
  try {
    return await vscode.workspace.fs.stat(uri);
  } catch (error) {
    deps.logger.debug(`Explorer stat failed for ${uri.toString()}: ${String(error)}`);
    return null;
  }
}

export async function tryReadDirectory(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  uri: vscode.Uri
): Promise<[string, vscode.FileType][] | null> {
  try {
    return await vscode.workspace.fs.readDirectory(uri);
  } catch (error) {
    deps.logger.debug(`Explorer readDirectory failed for ${uri.toString()}: ${String(error)}`);
    return null;
  }
}
