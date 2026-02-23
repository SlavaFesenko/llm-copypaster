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

    const config = await this._configService.getConfig();
    const techPromptText = config.includeTechPrompt ? buildTechPromptText(config) : '';

    const contextText = buildLlmContextText({
      fileItems: selection.fileItems,
      includeTechPrompt: config.includeTechPrompt,
      config,
      techPromptText,
    });

    await vscode.env.clipboard.writeText(contextText);
    await vscode.window.showInformationMessage('Copied this file as LLM context');
  }

  public async copyThisTabGroupAsContext(resourceUri?: vscode.Uri): Promise<void> {
    const fileItems = await this._collectTabGroupFileItemsByResourceUri(resourceUri);
    if (!fileItems.length) {
      await vscode.window.showWarningMessage('No tab group files to copy');
      return;
    }

    const config = await this._configService.getConfig();
    const techPromptText = config.includeTechPrompt ? buildTechPromptText(config) : '';

    const contextText = buildLlmContextText({
      fileItems,
      includeTechPrompt: config.includeTechPrompt,
      config,
      techPromptText,
    });

    await vscode.env.clipboard.writeText(contextText);
    await vscode.window.showInformationMessage('Copied this tab group as LLM context');
  }

  public async copyAllOpenFilesAsContext(): Promise<void> {
    const fileItems = await this._collectAllOpenTabsFileItems();
    if (!fileItems.length) {
      await vscode.window.showWarningMessage('No open files to copy');
      return;
    }

    const config = await this._configService.getConfig();
    const techPromptText = config.includeTechPrompt ? buildTechPromptText(config) : '';

    const contextText = buildLlmContextText({
      fileItems,
      includeTechPrompt: config.includeTechPrompt,
      config,
      techPromptText,
    });

    await vscode.env.clipboard.writeText(contextText);
    await vscode.window.showInformationMessage('Copied all open files as LLM context');
  }

  public async copySelectedExplorerItemsAsContext(resourceUris?: vscode.Uri[] | vscode.Uri): Promise<void> {
    const selectedUris = this._normalizeExplorerSelectionUris(resourceUris);
    if (!selectedUris.length) {
      await vscode.window.showWarningMessage('No explorer selection to copy');
      return;
    }

    const fileItems = await this._collectExplorerItemsFileItems(selectedUris);
    if (!fileItems.length) {
      await vscode.window.showWarningMessage('No files found in explorer selection');
      return;
    }

    const config = await this._configService.getConfig();
    const techPromptText = config.includeTechPrompt ? buildTechPromptText(config) : '';

    const contextText = buildLlmContextText({
      fileItems,
      includeTechPrompt: config.includeTechPrompt,
      config,
      techPromptText,
    });

    await vscode.env.clipboard.writeText(contextText);
    await vscode.window.showInformationMessage('Copied explorer selection as LLM context');
  }

  private async _collectTabGroupFileItemsByResourceUri(resourceUri?: vscode.Uri): Promise<EditorToLlmCollectedFileItem[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return [];
    }

    const targetGroup = this._tryResolveTabGroupByResourceUri(resourceUri) ?? vscode.window.tabGroups.activeTabGroup;

    const tabUris = targetGroup.tabs
      .map(tab => this._tryGetUriFromTab(tab))
      .filter((tabUri): tabUri is vscode.Uri => Boolean(tabUri))
      .filter(tabUri => tabUri.scheme === 'file');

    return await this._readUrisAsFileItems(tabUris);
  }

  private _tryResolveTabGroupByResourceUri(resourceUri?: vscode.Uri): vscode.TabGroup | null {
    if (!resourceUri) return null;

    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        const tabUri = this._tryGetUriFromTab(tab);
        if (!tabUri) continue;

        if (tabUri.toString() === resourceUri.toString()) return tabGroup;
      }
    }

    return null;
  }

  private async _collectAllOpenTabsFileItems(): Promise<EditorToLlmCollectedFileItem[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return [];
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

  private async _collectExplorerItemsFileItems(selectedUris: vscode.Uri[]): Promise<EditorToLlmCollectedFileItem[]> {
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

  private async _readUrisAsFileItems(uris: vscode.Uri[]): Promise<EditorToLlmCollectedFileItem[]> {
    const dedupedByPathMap = new Map<string, vscode.Uri>();

    for (const uri of uris) {
      const relativePath = vscode.workspace.asRelativePath(uri, false);
      if (!relativePath) continue;

      if (!dedupedByPathMap.has(relativePath)) dedupedByPathMap.set(relativePath, uri);
    }

    const fileItems: EditorToLlmCollectedFileItem[] = [];

    for (const [relativePath, uri] of dedupedByPathMap.entries()) {
      const readResult = await this._tryReadFileAsText(uri);

      fileItems.push({
        path: relativePath,
        content: readResult.text,
        readError: readResult.readError,
      });
    }

    return fileItems;
  }

  private async _tryReadFileAsText(uri: vscode.Uri): Promise<{ text: string | null; readError?: string }> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(bytes).toString('utf8');

      return { text };
    } catch (error) {
      const message = String(error);

      return { text: null, readError: message };
    }
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
