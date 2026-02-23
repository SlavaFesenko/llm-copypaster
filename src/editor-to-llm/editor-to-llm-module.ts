import * as vscode from 'vscode';

import { ConfigService } from '../config/config-service';
import { OutputChannelLogger } from '../utils/output-channel-logger';
import { collectActiveFileSelection } from './file-selection';
import { buildLlmContextText } from './llm-context-formatter';
import { buildTechPromptText } from './response-format-prompt';

interface EditorToLlmCollectedFileItem {
  path: string;
  content: string | null;
  readError?: string;
}

interface ReadUrisAsFileItemsResult {
  fileItems: EditorToLlmCollectedFileItem[];
  deletedFileUris: vscode.Uri[];
}

export class EditorToLlmModule {
  public constructor(
    private readonly _configService: ConfigService,
    private readonly _logger: OutputChannelLogger
  ) {}

  public async copyThisFileAsContext(): Promise<void> {
    const selection = await collectActiveFileSelection(this._logger);
    if (!selection) {
      await vscode.window.showWarningMessage('No active file to copy');
      return;
    }

    const nonDeletedFileItems = selection.fileItems.filter(fileItem => fileItem.content !== null);

    const deletedFilesCount = selection.fileItems.length - nonDeletedFileItems.length;

    if (nonDeletedFileItems.length === 0) {
      if (deletedFilesCount > 0) await this._showDeletedFilesWarning(deletedFilesCount, []);
      await vscode.window.showWarningMessage('No active file to copy');
      return;
    }

    const config = await this._configService.getConfig();
    const techPromptText = config.includeTechPrompt ? buildTechPromptText(config) : '';

    const contextText = buildLlmContextText({
      fileItems: nonDeletedFileItems,
      includeTechPrompt: config.includeTechPrompt,
      config,
      techPromptText,
    });

    await vscode.env.clipboard.writeText(contextText);
    await vscode.window.showInformationMessage(`Copied ${nonDeletedFileItems.length} file as LLM context`);

    if (deletedFilesCount > 0) await this._showDeletedFilesWarning(deletedFilesCount, []);
  }

  public async copyThisTabGroupAsContext(): Promise<void> {
    const selection = await this._collectActiveTabGroupFileItems();
    if (!selection.fileItems.length) {
      if (selection.deletedFileUris.length > 0)
        await this._showDeletedFilesWarning(selection.deletedFileUris.length, selection.deletedFileUris);
      await vscode.window.showWarningMessage('No tab group files to copy');
      return;
    }

    const config = await this._configService.getConfig();
    const techPromptText = config.includeTechPrompt ? buildTechPromptText(config) : '';

    const contextText = buildLlmContextText({
      fileItems: selection.fileItems,
      includeTechPrompt: config.includeTechPrompt,
      config,
      techPromptText,
    });

    await vscode.env.clipboard.writeText(contextText);
    await vscode.window.showInformationMessage(`Copied ${selection.fileItems.length} file(s) from tab group as LLM context`);

    if (selection.deletedFileUris.length > 0)
      await this._showDeletedFilesWarning(selection.deletedFileUris.length, selection.deletedFileUris);
  }

  public async copyAllOpenFilesAsContext(): Promise<void> {
    const selection = await this._collectAllOpenTabsFileItems();
    if (!selection.fileItems.length) {
      if (selection.deletedFileUris.length > 0)
        await this._showDeletedFilesWarning(selection.deletedFileUris.length, selection.deletedFileUris);
      await vscode.window.showWarningMessage('No open files to copy');
      return;
    }

    const config = await this._configService.getConfig();
    const techPromptText = config.includeTechPrompt ? buildTechPromptText(config) : '';

    const contextText = buildLlmContextText({
      fileItems: selection.fileItems,
      includeTechPrompt: config.includeTechPrompt,
      config,
      techPromptText,
    });

    await vscode.env.clipboard.writeText(contextText);
    await vscode.window.showInformationMessage(`Copied ${selection.fileItems.length} open file(s) as LLM context`);

    if (selection.deletedFileUris.length > 0)
      await this._showDeletedFilesWarning(selection.deletedFileUris.length, selection.deletedFileUris);
  }

  public async copySelectedExplorerItemsAsContext(resourceUris?: vscode.Uri[] | vscode.Uri): Promise<void> {
    const selectedUris = this._normalizeExplorerSelectionUris(resourceUris);
    if (!selectedUris.length) {
      await vscode.window.showWarningMessage('No explorer selection to copy');
      return;
    }

    const selection = await this._collectExplorerItemsFileItems(selectedUris);
    if (!selection.fileItems.length) {
      if (selection.deletedFileUris.length > 0)
        await this._showDeletedFilesWarning(selection.deletedFileUris.length, selection.deletedFileUris);
      await vscode.window.showWarningMessage('No files found in explorer selection');
      return;
    }

    const config = await this._configService.getConfig();
    const techPromptText = config.includeTechPrompt ? buildTechPromptText(config) : '';

    const contextText = buildLlmContextText({
      fileItems: selection.fileItems,
      includeTechPrompt: config.includeTechPrompt,
      config,
      techPromptText,
    });

    await vscode.env.clipboard.writeText(contextText);
    await vscode.window.showInformationMessage(`Copied ${selection.fileItems.length} explorer file(s) as context`);

    if (selection.deletedFileUris.length > 0)
      await this._showDeletedFilesWarning(selection.deletedFileUris.length, selection.deletedFileUris);
  }

  private async _showDeletedFilesWarning(deletedFilesCount: number, deletedFileUris: vscode.Uri[]): Promise<void> {
    const closeActionLabel = 'Close deleted files';

    const message = `${deletedFilesCount} file(s) were not copied because they were deleted but are still open in tabs`;

    const selectedAction = await vscode.window.showWarningMessage(message, closeActionLabel);

    if (selectedAction !== closeActionLabel) return;

    await this._closeDeletedFileTabs(deletedFileUris);
  }

  private async _closeDeletedFileTabs(deletedFileUris: vscode.Uri[]): Promise<void> {
    const deletedUriStrings = new Set<string>(deletedFileUris.map(uri => uri.toString()));

    const tabsToClose: vscode.Tab[] = [];

    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        const tabUri = this._tryGetUriFromTab(tab);
        if (!tabUri) continue;

        if (deletedUriStrings.has(tabUri.toString())) tabsToClose.push(tab);
      }
    }

    if (tabsToClose.length === 0) return;

    try {
      await vscode.window.tabGroups.close(tabsToClose);
    } catch (error) {
      this._logger.warn(`Failed closing deleted tabs: ${String(error)}`);
    }
  }

  private async _collectActiveTabGroupFileItems(): Promise<ReadUrisAsFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return { fileItems: [], deletedFileUris: [] };
    }

    const activeGroup = vscode.window.tabGroups.activeTabGroup;

    const tabUris = activeGroup.tabs
      .map(tab => this._tryGetUriFromTab(tab))
      .filter((tabUri): tabUri is vscode.Uri => Boolean(tabUri))
      .filter(tabUri => tabUri.scheme === 'file');

    return await this._readUrisAsFileItems(tabUris);
  }

  private async _collectAllOpenTabsFileItems(): Promise<ReadUrisAsFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return { fileItems: [], deletedFileUris: [] };
    }

    const tabUris = vscode.window.tabGroups.all
      .flatMap(tabGroup => tabGroup.tabs)
      .map(tab => this._tryGetUriFromTab(tab))
      .filter((tabUri): tabUri is vscode.Uri => Boolean(tabUri))
      .filter(tabUri => tabUri.scheme === 'file');

    return await this._readUrisAsFileItems(tabUris);
  }

  private _tryGetUriFromTab(tab: vscode.Tab): vscode.Uri | null {
    if (tab.input instanceof vscode.TabInputText) {
      return tab.input.uri;
    }

    const anyInput = tab.input as unknown as { uri?: vscode.Uri };
    if (anyInput?.uri instanceof vscode.Uri) {
      return anyInput.uri;
    }

    return null;
  }

  private _normalizeExplorerSelectionUris(resourceUris?: vscode.Uri[] | vscode.Uri): vscode.Uri[] {
    if (!resourceUris) return [];

    if (Array.isArray(resourceUris)) return resourceUris;

    return [resourceUris];
  }

  private async _collectExplorerItemsFileItems(selectedUris: vscode.Uri[]): Promise<ReadUrisAsFileItemsResult> {
    const allFileUris: vscode.Uri[] = [];

    for (const selectedUri of selectedUris) {
      const stat = await this._tryStat(selectedUri);
      if (!stat) continue;

      if (stat.type & vscode.FileType.Directory) {
        const folderFileUris = await this._collectAllFilesInFolderRecursively(selectedUri);
        for (const fileUri of folderFileUris) allFileUris.push(fileUri);
        continue;
      }

      if (stat.type & vscode.FileType.File) {
        allFileUris.push(selectedUri);
        continue;
      }
    }

    return await this._readUrisAsFileItems(allFileUris);
  }

  private async _collectAllFilesInFolderRecursively(folderUri: vscode.Uri): Promise<vscode.Uri[]> {
    const collectedFileUris: vscode.Uri[] = [];

    const entries = await this._tryReadDirectory(folderUri);
    if (!entries) return collectedFileUris;

    for (const [entryName, entryType] of entries) {
      const entryUri = vscode.Uri.joinPath(folderUri, entryName);

      if (entryType & vscode.FileType.Directory) {
        const nestedFileUris = await this._collectAllFilesInFolderRecursively(entryUri);
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

  private async _readUrisAsFileItems(uris: vscode.Uri[]): Promise<ReadUrisAsFileItemsResult> {
    const dedupedByPathMap = new Map<string, vscode.Uri>();

    for (const uri of uris) {
      const relativePath = vscode.workspace.asRelativePath(uri, false);
      if (!relativePath) continue;

      if (!dedupedByPathMap.has(relativePath)) dedupedByPathMap.set(relativePath, uri);
    }

    const fileItems: EditorToLlmCollectedFileItem[] = [];
    const deletedFileUris: vscode.Uri[] = [];

    for (const [relativePath, uri] of dedupedByPathMap.entries()) {
      const readResult = await this._tryReadFileAsText(uri);

      if (readResult.isFileNotFound) {
        deletedFileUris.push(uri);
        continue;
      }

      fileItems.push({
        path: relativePath,
        content: readResult.text,
        readError: readResult.readError,
      });
    }

    return { fileItems, deletedFileUris };
  }

  private async _tryReadFileAsText(
    uri: vscode.Uri
  ): Promise<{ text: string | null; readError?: string; isFileNotFound: boolean }> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(bytes).toString('utf8');

      return { text, isFileNotFound: false };
    } catch (error) {
      const message = String(error);

      return { text: null, readError: message, isFileNotFound: this._isFileNotFoundError(error) };
    }
  }

  private _isFileNotFoundError(error: unknown): boolean {
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

  private async _tryStat(uri: vscode.Uri): Promise<vscode.FileStat | null> {
    try {
      return await vscode.workspace.fs.stat(uri);
    } catch (error) {
      this._logger.debug(`Explorer stat failed for ${uri.toString()}: ${String(error)}`);
      return null;
    }
  }

  private async _tryReadDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][] | null> {
    try {
      return await vscode.workspace.fs.readDirectory(uri);
    } catch (error) {
      this._logger.debug(`Explorer readDirectory failed for ${uri.toString()}: ${String(error)}`);
      return null;
    }
  }
}
