import * as vscode from 'vscode';

import { ConfigService } from '../config/config-service';
import { OutputChannelLogger } from '../utils/output-channel-logger';
import { loadDefaultCopyAsContextPrompt } from './default-copy-as-context-prompt-loader';
import { collectActiveFileSelection } from './file-selection';
import { buildLlmContextText } from './llm-context-formatter';

interface EditorToLlmCollectedFileItem {
  path: string;
  content: string | null;
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

export class EditorToLlmModule {
  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _configService: ConfigService,
    private readonly _logger: OutputChannelLogger
  ) {}

  public async copyThisFileAsContext(includeTechPrompt: boolean = true): Promise<void> {
    const selection = await collectActiveFileSelection(this._logger);
    if (!selection) {
      await vscode.window.showWarningMessage('No active file to copy');
      return;
    }

    const nonDeletedFileItems = selection.fileItems.filter(fileItem => fileItem.content !== null);

    const totalFilesCount = selection.fileItems.length;
    const copiedFilesCount = nonDeletedFileItems.length;

    if (copiedFilesCount === 0) {
      await vscode.window.showWarningMessage('No active file to copy');
      return;
    }

    const config = await this._configService.getConfig();
    const techPromptText = includeTechPrompt ? await loadDefaultCopyAsContextPrompt(this._extensionContext) : '';

    const contextText = buildLlmContextText({
      fileItems: nonDeletedFileItems,
      includeTechPrompt,
      config,
      techPromptText,
    });

    await vscode.env.clipboard.writeText(contextText);

    await this._showCopyResultNotification({
      commandName: 'Copy File',
      copiedFilesCount,
      totalFilesCount,
      deletedFileUris: [],
      unresolvedTabs: [],
    });
  }

  public async copyThisTabGroupAsContext(includeTechPrompt: boolean = true): Promise<void> {
    const selection = await this._collectActiveTabGroupFileItems();

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No tab group files to copy');
      return;
    }

    if (selection.fileItems.length > 0) {
      const config = await this._configService.getConfig();
      const techPromptText = includeTechPrompt ? await loadDefaultCopyAsContextPrompt(this._extensionContext) : '';

      const contextText = buildLlmContextText({
        fileItems: selection.fileItems,
        includeTechPrompt,
        config,
        techPromptText,
      });

      await vscode.env.clipboard.writeText(contextText);
    } else {
      await vscode.window.showWarningMessage('No tab group files to copy');
      return;
    }

    await this._showCopyResultNotification({
      commandName: 'Copy Tab Group',
      copiedFilesCount: selection.fileItems.length,
      totalFilesCount,
      deletedFileUris: selection.deletedFileUris,
      unresolvedTabs: selection.unresolvedTabs,
    });
  }

  public async copyAllOpenFilesAsContext(includeTechPrompt: boolean = true): Promise<void> {
    const selection = await this._collectAllOpenTabsFileItems();

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No open files to copy');
      return;
    }

    if (selection.fileItems.length > 0) {
      const config = await this._configService.getConfig();
      const techPromptText = includeTechPrompt ? await loadDefaultCopyAsContextPrompt(this._extensionContext) : '';

      const contextText = buildLlmContextText({
        fileItems: selection.fileItems,
        includeTechPrompt,
        config,
        techPromptText,
      });

      await vscode.env.clipboard.writeText(contextText);
    } else {
      await vscode.window.showWarningMessage('No open files to copy');
      return;
    }

    await this._showCopyResultNotification({
      commandName: 'Copy All',
      copiedFilesCount: selection.fileItems.length,
      totalFilesCount,
      deletedFileUris: selection.deletedFileUris,
      unresolvedTabs: selection.unresolvedTabs,
    });
  }

  public async copyPinnedFilesAsContext(includeTechPrompt: boolean = true): Promise<void> {
    const selection = await this._collectPinnedTabsFileItems();

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No pinned files to copy');
      return;
    }

    if (selection.fileItems.length > 0) {
      const config = await this._configService.getConfig();
      const techPromptText = includeTechPrompt ? await loadDefaultCopyAsContextPrompt(this._extensionContext) : '';

      const contextText = buildLlmContextText({
        fileItems: selection.fileItems,
        includeTechPrompt,
        config,
        techPromptText,
      });

      await vscode.env.clipboard.writeText(contextText);
    } else {
      await vscode.window.showWarningMessage('No pinned files to copy');
      return;
    }

    await this._showCopyResultNotification({
      commandName: 'Copy Pinned',
      copiedFilesCount: selection.fileItems.length,
      totalFilesCount,
      deletedFileUris: selection.deletedFileUris,
      unresolvedTabs: selection.unresolvedTabs,
    });
  }

  public async copySelectedExplorerItemsAsContext(resourceUris?: vscode.Uri[] | vscode.Uri): Promise<void> {
    const selectedUris = this._normalizeExplorerSelectionUris(resourceUris);
    if (!selectedUris.length) {
      await vscode.window.showWarningMessage('No explorer selection to copy');
      return;
    }

    const selection = await this._collectExplorerItemsFileItems(selectedUris);

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No files found in explorer selection');
      return;
    }

    if (selection.fileItems.length > 0) {
      const config = await this._configService.getConfig();
      const techPromptText = await loadDefaultCopyAsContextPrompt(this._extensionContext);

      const contextText = buildLlmContextText({
        fileItems: selection.fileItems,
        includeTechPrompt: true,
        config,
        techPromptText,
      });

      await vscode.env.clipboard.writeText(contextText);
    } else {
      await vscode.window.showWarningMessage('No files found in explorer selection');
      return;
    }

    await this._showCopyResultNotification({
      commandName: 'Copy Explorer Items',
      copiedFilesCount: selection.fileItems.length,
      totalFilesCount,
      deletedFileUris: selection.deletedFileUris,
      unresolvedTabs: [],
    });
  }

  private async _showCopyResultNotification(args: {
    commandName: 'Copy All' | 'Copy Tab Group' | 'Copy File' | 'Copy Explorer Items' | 'Copy Pinned';
    copiedFilesCount: number;
    totalFilesCount: number;
    deletedFileUris: vscode.Uri[];
    unresolvedTabs: vscode.Tab[];
  }): Promise<void> {
    const unavailableFilesCount = args.totalFilesCount - args.copiedFilesCount;

    const message =
      unavailableFilesCount === 0
        ? `Copied ${args.copiedFilesCount} file(s) by '${args.commandName}' command`
        : `Copied ${args.copiedFilesCount}/${args.totalFilesCount} available file(s) by '${args.commandName}' command`;

    const closeUnavailableActionLabel =
      unavailableFilesCount > 0 ? `Close ${unavailableFilesCount} unavailable file(s) in Editor` : '';

    const selectedAction = closeUnavailableActionLabel
      ? await vscode.window.showInformationMessage(message, closeUnavailableActionLabel)
      : await vscode.window.showInformationMessage(message);

    if (selectedAction !== closeUnavailableActionLabel) return;

    await this._closeUnavailableTabs({
      deletedFileUris: args.deletedFileUris,
      unresolvedTabs: args.unresolvedTabs,
    });
  }

  private async _closeUnavailableTabs(args: { deletedFileUris: vscode.Uri[]; unresolvedTabs: vscode.Tab[] }): Promise<void> {
    const tabsToClose: vscode.Tab[] = [];

    for (const unresolvedTab of args.unresolvedTabs) tabsToClose.push(unresolvedTab);

    if (args.deletedFileUris.length > 0) {
      const deletedUriStrings = new Set<string>(args.deletedFileUris.map(uri => uri.toString()));

      for (const tabGroup of vscode.window.tabGroups.all) {
        for (const tab of tabGroup.tabs) {
          const tabUri = this._tryGetUriFromTab(tab);
          if (!tabUri) continue;

          if (deletedUriStrings.has(tabUri.toString())) tabsToClose.push(tab);
        }
      }
    }

    if (tabsToClose.length === 0) return;

    try {
      await vscode.window.tabGroups.close(tabsToClose);
    } catch (error) {
      this._logger.warn(`Failed closing unavailable tabs: ${String(error)}`);
    }
  }

  private async _collectActiveTabGroupFileItems(): Promise<TabBasedFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };
    }

    const activeGroup = vscode.window.tabGroups.activeTabGroup;

    const tabUris: vscode.Uri[] = [];
    const unresolvedTabs: vscode.Tab[] = [];

    for (const tab of activeGroup.tabs) {
      const tabUri = this._tryGetUriFromTab(tab);
      if (!tabUri) {
        unresolvedTabs.push(tab);
        continue;
      }

      if (tabUri.scheme !== 'file') continue;

      tabUris.push(tabUri);
    }

    const readResult = await this._readUrisAsFileItems(tabUris);

    return { ...readResult, unresolvedTabs };
  }

  private async _collectAllOpenTabsFileItems(): Promise<TabBasedFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };
    }

    const tabUris: vscode.Uri[] = [];
    const unresolvedTabs: vscode.Tab[] = [];

    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        const tabUri = this._tryGetUriFromTab(tab);
        if (!tabUri) {
          unresolvedTabs.push(tab);
          continue;
        }

        if (tabUri.scheme !== 'file') continue;

        tabUris.push(tabUri);
      }
    }

    const readResult = await this._readUrisAsFileItems(tabUris);

    return { ...readResult, unresolvedTabs };
  }

  private async _collectPinnedTabsFileItems(): Promise<TabBasedFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };
    }

    const tabUris: vscode.Uri[] = [];
    const unresolvedTabs: vscode.Tab[] = [];

    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        if (!tab.isPinned) continue;

        const tabUri = this._tryGetUriFromTab(tab);
        if (!tabUri) {
          unresolvedTabs.push(tab);
          continue;
        }

        if (tabUri.scheme !== 'file') continue;

        tabUris.push(tabUri);
      }
    }

    const readResult = await this._readUrisAsFileItems(tabUris);

    return { ...readResult, unresolvedTabs };
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
