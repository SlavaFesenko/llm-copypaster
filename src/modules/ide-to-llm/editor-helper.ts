import * as vscode from 'vscode';

import {
  EditorToLlmModulePrivateHelpersDependencies,
  readUrisAsFileItems,
  showCopyResultNotification,
  TabBasedFileItemsResult,
  tryGetUriFromTab,
} from './common.helpers';
import { buildTabGroupQuickPickItems, findTabGroupsContainingUri } from './tab-group-picker-helpers';
import { collectActiveFileSelection } from './utils/file-selection';
import { buildLlmContextText } from './utils/llm-context-formatter';
import { buildPromptWithSizeStats } from './utils/prompt-size-helper';
import { BuilderTechPrompt } from './utils/tech-prompt-builder';

export class EditorHelper {
  public constructor(private readonly _deps: EditorToLlmModulePrivateHelpersDependencies) {}

  public async copyThisFileAsContext(includeTechPrompt: boolean = true): Promise<void> {
    const selection = await collectActiveFileSelection(this._deps.logger);
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

    await this._copyFileItemsSelectionAsContext({
      selectionFileItems: nonDeletedFileItems,
      includeTechPrompt,
      warningWhenEmpty: 'No active file to copy',
      commandName: 'Copy File',
      totalFilesCount,
      copiedFilesCount,
      deletedFileUris: [],
      unresolvedTabs: [],
    });
  }

  public async copyThisTabGroupAsContext(includeTechPrompt: boolean = true): Promise<void> {
    const selection = await this._collectActiveTabGroupFileItems();

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No tab group files to copy!');
      return;
    }

    await this._copyTabBasedSelectionAsContext({
      selection,
      includeTechPrompt,
      warningWhenEmpty: 'No tab group files to copy!',
      commandName: 'Copy Tab Group',
      totalFilesCount,
    });
  }

  public async copyAllOpenFilesAsContext(includeTechPrompt: boolean = true): Promise<void> {
    const selection = await this._collectAllOpenTabsFileItems();

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No open files to copy');
      return;
    }

    await this._copyTabBasedSelectionAsContext({
      selection,
      includeTechPrompt,
      warningWhenEmpty: 'No open files to copy',
      commandName: 'Copy All',
      totalFilesCount,
    });
  }

  public async copyAllPinnedFilesAsContext(includeTechPrompt: boolean = true): Promise<void> {
    const selection = await this._collectAllPinnedTabsFileItems();

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No pinned files to copy');
      return;
    }

    await this._copyTabBasedSelectionAsContext({
      selection,
      includeTechPrompt,
      warningWhenEmpty: 'No pinned files to copy',
      commandName: 'Copy All Pinned',
      totalFilesCount,
    });
  }

  public async copyPinnedFilesInActiveTabGroupAsContext(includeTechPrompt: boolean = true): Promise<void> {
    const selection = await this._collectPinnedTabsInActiveTabGroupFileItems();

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No pinned tab group files to copy');
      return;
    }

    await this._copyTabBasedSelectionAsContext({
      selection,
      includeTechPrompt,
      warningWhenEmpty: 'No pinned tab group files to copy',
      commandName: 'Copy Pinned Tab Group',
      totalFilesCount,
    });
  }

  private async _collectActiveTabGroupFileItems(): Promise<TabBasedFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };

    const tabGroup = await this._pickTabGroupForTabGroupCopyCommand();
    if (!tabGroup) return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };

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

    const readResult = await readUrisAsFileItems(this._deps, tabUris);

    return { ...readResult, unresolvedTabs };
  }

  private async _collectAllOpenTabsFileItems(): Promise<TabBasedFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };

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

    const readResult = await readUrisAsFileItems(this._deps, tabUris);

    return { ...readResult, unresolvedTabs };
  }

  private async _collectAllPinnedTabsFileItems(): Promise<TabBasedFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };

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

    const readResult = await readUrisAsFileItems(this._deps, tabUris);

    return { ...readResult, unresolvedTabs };
  }

  private async _collectPinnedTabsInActiveTabGroupFileItems(): Promise<TabBasedFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };

    const tabGroup = await this._pickTabGroupForTabGroupCopyCommand();
    if (!tabGroup) return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };

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

    const readResult = await readUrisAsFileItems(this._deps, tabUris);

    return { ...readResult, unresolvedTabs };
  }

  private async _pickTabGroupForTabGroupCopyCommand(): Promise<vscode.TabGroup | null> {
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

  private async _copyTabBasedSelectionAsContext(args: {
    selection: TabBasedFileItemsResult;
    includeTechPrompt: boolean;
    warningWhenEmpty: string;
    commandName: string;
    totalFilesCount: number;
  }): Promise<void> {
    if (args.selection.fileItems.length > 0) {
      await this._copyFileItemsSelectionAsContext({
        selectionFileItems: args.selection.fileItems,
        includeTechPrompt: args.includeTechPrompt,
        warningWhenEmpty: args.warningWhenEmpty,
        commandName: args.commandName,
        totalFilesCount: args.totalFilesCount,
        copiedFilesCount: args.selection.fileItems.length,
        deletedFileUris: args.selection.deletedFileUris,
        unresolvedTabs: args.selection.unresolvedTabs,
      });

      return;
    }

    await vscode.window.showWarningMessage(args.warningWhenEmpty);
  }

  private async _copyFileItemsSelectionAsContext(args: {
    selectionFileItems: Array<{ path: string; content: string | null; languageId?: string; readError?: string }>;
    includeTechPrompt: boolean;
    warningWhenEmpty: string;
    commandName: string;
    totalFilesCount: number;
    copiedFilesCount: number;
    deletedFileUris: vscode.Uri[];
    unresolvedTabs: vscode.Tab[];
  }): Promise<void> {
    if (args.selectionFileItems.length === 0) {
      await vscode.window.showWarningMessage(args.warningWhenEmpty);
      return;
    }

    const config = await this._deps.configService.getConfig();

    const techPromptText = args.includeTechPrompt
      ? await new BuilderTechPrompt(this._deps.extensionContext, config).build()
      : '';

    const fileItems = args.selectionFileItems;

    const contextText = buildLlmContextText({
      fileItems,
      includeTechPrompt: args.includeTechPrompt,
      config,
      techPromptText,
    });

    const promptStatsResult = buildPromptWithSizeStats({
      promptText: contextText,
      config,
    });

    await vscode.env.clipboard.writeText(contextText);

    await showCopyResultNotification(this._deps, {
      commandName: args.commandName,
      includeTechPrompt: args.includeTechPrompt,
      copiedFilesCount: args.copiedFilesCount,
      totalFilesCount: args.totalFilesCount,
      deletedFileUris: args.deletedFileUris,
      unresolvedTabs: args.unresolvedTabs,
      promptSizeStats: {
        linesCount: promptStatsResult.linesCount,
        approxTokensCount: promptStatsResult.approxTokensCount,
        maxLinesCountInContext: promptStatsResult.maxLinesCountInContext,
        maxTokensCountInContext: promptStatsResult.maxTokensCountInContext,
        isExceeded: promptStatsResult.isExceeded,
        exceededBy: promptStatsResult.exceededBy,
      },
    });
  }
}
