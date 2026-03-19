import * as vscode from 'vscode';

import { InstructionsBuilder } from '../common/instructions-builder/instructions-builder';
import {
  EditorToLlmModulePrivateHelpersDependencies,
  ReadUrisAsFileItemsResult,
  buildUriKey,
  readUrisAsFileItems,
} from './common.helpers';
import { CopyResultNotificator } from './copy-result-notificator';
import { buildFinalPromptText } from './utils/llm-context-formatter';
import { buildTextSizeStats } from './utils/prompt-size-helper';

export interface CopySelectedExplorerItemsArgs {
  selectedUris?: vscode.Uri[];
}

export class ExplorerHelper {
  public constructor(private readonly _deps: EditorToLlmModulePrivateHelpersDependencies) {}

  public async copySelectedExplorerItemsAsContext(args?: CopySelectedExplorerItemsArgs): Promise<void> {
    const selectedUrisCopy = [...(args?.selectedUris ?? [])];

    const normalizedSelectedUris = uniqueByUriKeyKeepOrder(selectedUrisCopy);

    if (normalizedSelectedUris.length === 0) {
      await vscode.window.showWarningMessage('No explorer selection to copy');
      return;
    }

    await this._copyExplorerUrisAsContext(normalizedSelectedUris);
  }

  private async _copyExplorerUrisAsContext(inputUris: vscode.Uri[]): Promise<void> {
    const selection = await collectExplorerItemsFileItems(this._deps, inputUris);

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No files found in explorer selection');
      return;
    }

    if (selection.fileItems.length > 0) {
      const config = await this._deps.configService.getLlmCopypasterConfig();

      const techPromptText = await new InstructionsBuilder(this._deps.extensionContext, config).build();

      const contextText = buildFinalPromptText({
        fileItems: selection.fileItems,
        config,
        instructionsText: techPromptText,
      });

      const promptStatsResult = buildTextSizeStats({
        promptText: contextText,
        contextConfig: config.coreSettings.ideToLlm,
      });

      await vscode.env.clipboard.writeText(contextText);

      await new CopyResultNotificator(this._deps).showCopyResultNotification({
        commandName: 'Copy Explorer Items',
        includeTechPrompt: true,
        copiedFilesCount: selection.fileItems.length,
        totalFilesCount,
        deletedFileUris: selection.deletedFileUris,
        unresolvedTabs: [],
        promptText: contextText,
        fileItems: selection.fileItems,
        promptSizeStats: {
          linesCount: promptStatsResult.linesCount,
          approxTokensCount: promptStatsResult.approxTokensCount,
          maxLinesCountInContext: promptStatsResult.linesMaxToShowWarning,
          maxTokensCountInContext: promptStatsResult.tokensMaxToShowWarning,
          isExceeded: promptStatsResult.isExceeded,
          exceededBy: promptStatsResult.exceededBy,
        },
      });

      return;
    }

    await vscode.window.showWarningMessage('No files found in explorer selection');
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

  return await readUrisAsFileItems(allFileUris);
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
