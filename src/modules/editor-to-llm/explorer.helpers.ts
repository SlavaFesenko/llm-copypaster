import * as vscode from 'vscode';

import {
  EditorToLlmModulePrivateHelpersDependencies,
  ExplorerCopySelectionSource,
  ReadUrisAsFileItemsResult,
  buildUriKey,
  readUrisAsFileItems,
  showCopyResultNotification,
  wrapContentWithCodeFence,
} from './common.helpers';
import { loadDefaultCopyAsContextPrompt } from './utils/default-copy-as-context-prompt-loader';
import { buildLlmContextText } from './utils/llm-context-formatter';

export interface CopySelectedExplorerItemsArgs {
  clickedUri?: vscode.Uri;
  selectedUris?: vscode.Uri[];
}

export async function copySelectedExplorerItemsAsContext(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  args?: CopySelectedExplorerItemsArgs,
  includeTechPrompt: boolean = true
): Promise<void> {
  const clickedUri = args?.clickedUri;
  const selectedUrisCopy = [...(args?.selectedUris ?? [])];

  const normalizedSelectedUris = uniqueByUriKeyKeepOrder(selectedUrisCopy);
  const clickedUriKey = clickedUri ? buildUriKey(clickedUri) : null;

  if (normalizedSelectedUris.length === 0 && clickedUri) {
    await copyExplorerUrisAsContext(deps, {
      inputUris: [clickedUri],
      selectionSource: 'CLICKED',
      includeTechPrompt,
    });

    return;
  }

  if (normalizedSelectedUris.length > 0 && !clickedUri) {
    await copyExplorerUrisAsContext(deps, {
      inputUris: normalizedSelectedUris,
      selectionSource: 'SELECTED',
      includeTechPrompt,
    });

    return;
  }

  if (normalizedSelectedUris.length > 0 && clickedUri) {
    const selectedUriKeys = new Set<string>(normalizedSelectedUris.map(uri => buildUriKey(uri)));
    const isClickedInSelected = clickedUriKey ? selectedUriKeys.has(clickedUriKey) : false;

    if (isClickedInSelected) {
      await copyExplorerUrisAsContext(deps, {
        inputUris: normalizedSelectedUris,
        selectionSource: 'SELECTED',
        includeTechPrompt,
      });

      return;
    }

    const quickPickItems = buildExplorerSelectionSourceQuickPickItems({
      selectedUris: normalizedSelectedUris,
      clickedUri,
    });

    const pickedItem = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: 'Choose what to copy from Explorer',
      canPickMany: false,
    });

    if (!pickedItem) return;

    await copyExplorerUrisAsContext(deps, {
      inputUris: pickedItem.uris,
      selectionSource: pickedItem.selectionSource,
      includeTechPrompt,
    });

    return;
  }

  await vscode.window.showWarningMessage('No explorer selection to copy');
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

function buildExplorerSelectionSourceQuickPickItems(args: {
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

function buildUrisPreviewText(uris: vscode.Uri[]): string {
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

function buildSelectedThenClickedUniqueUnion(selectedUris: vscode.Uri[], clickedUri: vscode.Uri): vscode.Uri[] {
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

function uniqueByUriKeyKeepOrder(uris: vscode.Uri[]): vscode.Uri[] {
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

async function collectExplorerItemsFileItems(
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

async function collectAllFilesInFolderRecursively(
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

async function tryStat(deps: EditorToLlmModulePrivateHelpersDependencies, uri: vscode.Uri): Promise<vscode.FileStat | null> {
  try {
    return await vscode.workspace.fs.stat(uri);
  } catch (error) {
    deps.logger.debug(`Explorer stat failed for ${uri.toString()}: ${String(error)}`);
    return null;
  }
}

async function tryReadDirectory(
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
