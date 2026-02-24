import * as vscode from 'vscode';

import {
  EditorToLlmModulePrivateHelpersDependencies,
  ReadUrisAsFileItemsResult,
  buildUriKey,
  readUrisAsFileItems,
  showCopyResultNotification,
} from './common.helpers';
import { loadDefaultCopyAsContextPrompt } from './utils/default-copy-as-context-prompt-loader';
import { buildLlmContextText } from './utils/llm-context-formatter';

export interface CopySelectedExplorerItemsArgs {
  selectedUris?: vscode.Uri[];
}

export class ExplorerHelper {
  public constructor(private readonly _deps: EditorToLlmModulePrivateHelpersDependencies) {}

  public async copySelectedExplorerItemsAsContext(
    args?: CopySelectedExplorerItemsArgs,
    includeTechPrompt: boolean = true
  ): Promise<void> {
    const selectedUrisCopy = [...(args?.selectedUris ?? [])];

    const normalizedSelectedUris = uniqueByUriKeyKeepOrder(selectedUrisCopy);

    if (normalizedSelectedUris.length === 0) {
      await vscode.window.showWarningMessage('No explorer selection to copy');
      return;
    }

    await this._copyExplorerUrisAsContext(normalizedSelectedUris, includeTechPrompt);
  }

  private async _copyExplorerUrisAsContext(inputUris: vscode.Uri[], includeTechPrompt: boolean): Promise<void> {
    const selection = await collectExplorerItemsFileItems(this._deps, inputUris);

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No files found in explorer selection');
      return;
    }

    if (selection.fileItems.length > 0) {
      const config = await this._deps.configService.getConfig();
      const techPromptText = includeTechPrompt ? await loadDefaultCopyAsContextPrompt(this._deps.extensionContext) : '';

      const contextText = buildLlmContextText({
        fileItems: selection.fileItems,
        includeTechPrompt,
        config,
        techPromptText,
      });

      await vscode.env.clipboard.writeText(contextText);
    } else {
      await vscode.window.showWarningMessage('No files found in explorer selection');
      return;
    }

    await showCopyResultNotification(this._deps, {
      commandName: 'Copy Explorer Items',
      includeTechPrompt,
      copiedFilesCount: selection.fileItems.length,
      totalFilesCount,
      deletedFileUris: selection.deletedFileUris,
      unresolvedTabs: [],
    });
  }
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
