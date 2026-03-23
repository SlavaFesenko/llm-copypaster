import * as vscode from 'vscode';

import { InstructionsBuilder } from '../common/instructions-builder/instructions-builder';
import {
  EditorToLlmModulePrivateHelpersDependencies,
  readUrisAsFileItems,
  TabBasedFileItemsResult,
  tryGetUriFromTab,
} from './common.helpers';
import { CopyResultNotificator } from './copy-result-notificator';
import { collectActiveFileSelection } from './utils/file-selection';
import { buildFinalPromptText } from './utils/llm-context-formatter';
import { buildTextSizeStats } from './utils/prompt-size-helper';

export class EditorHelper {
  public constructor(private readonly _deps: EditorToLlmModulePrivateHelpersDependencies) {}

  public async copyThisFileAsContext(): Promise<void> {
    const fileItem = await collectActiveFileSelection();
    if (!fileItem) return;

    await this._copyFileItemsSelectionAsContext({
      selectionFileItems: [fileItem],
      warningWhenEmpty: 'No active file to copy',
      commandName: 'Copy File',
      totalFilesCount: 1,
      copiedFilesCount: 1,
      deletedFileUris: [],
      unresolvedTabs: [],
    });
  }

  public async copyThisTabGroupAsContext(): Promise<void> {
    const selection = await this._collectActiveTabGroupFileItems();

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No tab group files to copy!');
      return;
    }

    await this._copyTabBasedSelectionAsContext({
      selection,
      warningWhenEmpty: 'No tab group files to copy!',
      commandName: 'Copy Tab Group',
      totalFilesCount,
    });
  }

  public async copyAllOpenFilesAsContext(): Promise<void> {
    const selection = await this._collectAllOpenTabsFileItems();

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No open files to copy');
      return;
    }

    await this._copyTabBasedSelectionAsContext({
      selection,
      warningWhenEmpty: 'No open files to copy',
      commandName: 'Copy All',
      totalFilesCount,
    });
  }

  public async copyAllPinnedFilesAsContext(): Promise<void> {
    const selection = await this._collectAllPinnedTabsFileItems();

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No pinned files to copy');
      return;
    }

    await this._copyTabBasedSelectionAsContext({
      selection,
      warningWhenEmpty: 'No pinned files to copy',
      commandName: 'Copy All Pinned',
      totalFilesCount,
    });
  }

  public async copyAllUnpinnedFilesAsContext(): Promise<void> {
    const selection = await this._collectAllUnpinnedTabsFileItems();

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No unpinned files to copy');
      return;
    }

    await this._copyTabBasedSelectionAsContext({
      selection,
      warningWhenEmpty: 'No unpinned files to copy',
      commandName: 'Copy All Unpinned',
      totalFilesCount,
    });
  }

  public async copyPinnedFilesInActiveTabGroupAsContext(): Promise<void> {
    const selection = await this._collectPinnedTabsInActiveTabGroupFileItems();

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No pinned tab group files to copy');
      return;
    }

    await this._copyTabBasedSelectionAsContext({
      selection,
      warningWhenEmpty: 'No pinned tab group files to copy',
      commandName: 'Copy Pinned Tab Group',
      totalFilesCount,
    });
  }

  public async copyUnpinnedFilesInActiveTabGroupAsContext(): Promise<void> {
    const selection = await this._collectUnpinnedTabsInActiveTabGroupFileItems();

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No unpinned tab group files to copy');
      return;
    }

    await this._copyTabBasedSelectionAsContext({
      selection,
      warningWhenEmpty: 'No unpinned tab group files to copy',
      commandName: 'Copy Unpinned Tab Group',
      totalFilesCount,
    });
  }

  private async _collectActiveTabGroupFileItems(): Promise<TabBasedFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };

    const tabGroup = vscode.window.tabGroups.activeTabGroup;

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

    const readResult = await readUrisAsFileItems(tabUris);

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

    const readResult = await readUrisAsFileItems(tabUris);

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

    const readResult = await readUrisAsFileItems(tabUris);

    return { ...readResult, unresolvedTabs };
  }

  private async _collectAllUnpinnedTabsFileItems(): Promise<TabBasedFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };

    const tabUris: vscode.Uri[] = [];
    const unresolvedTabs: vscode.Tab[] = [];

    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        if (tab.isPinned) continue;

        const tabUri = tryGetUriFromTab(tab);
        if (!tabUri) {
          unresolvedTabs.push(tab);
          continue;
        }

        if (tabUri.scheme !== 'file') continue;

        tabUris.push(tabUri);
      }
    }

    const readResult = await readUrisAsFileItems(tabUris);

    return { ...readResult, unresolvedTabs };
  }

  private async _collectPinnedTabsInActiveTabGroupFileItems(): Promise<TabBasedFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };

    const tabGroup = vscode.window.tabGroups.activeTabGroup;

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

    const readResult = await readUrisAsFileItems(tabUris);

    return { ...readResult, unresolvedTabs };
  }

  private async _collectUnpinnedTabsInActiveTabGroupFileItems(): Promise<TabBasedFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };

    const tabGroup = vscode.window.tabGroups.activeTabGroup;

    const tabUris: vscode.Uri[] = [];
    const unresolvedTabs: vscode.Tab[] = [];

    for (const tab of tabGroup.tabs) {
      if (tab.isPinned) continue;

      const tabUri = tryGetUriFromTab(tab);
      if (!tabUri) {
        unresolvedTabs.push(tab);
        continue;
      }

      if (tabUri.scheme !== 'file') continue;

      tabUris.push(tabUri);
    }

    const readResult = await readUrisAsFileItems(tabUris);

    return { ...readResult, unresolvedTabs };
  }

  private async _copyTabBasedSelectionAsContext(args: {
    selection: TabBasedFileItemsResult;
    warningWhenEmpty: string;
    commandName: string;
    totalFilesCount: number;
  }): Promise<void> {
    if (args.selection.fileItems.length > 0) {
      await this._copyFileItemsSelectionAsContext({
        selectionFileItems: args.selection.fileItems,
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

    const config = await this._deps.configService.getLlmCopypasterConfig();
    const fileItems = args.selectionFileItems;

    const instructionsText = await new InstructionsBuilder(this._deps.extensionContext, config).build();

    const finalPromptText = buildFinalPromptText({
      fileItems,
      config,
      instructionsText: instructionsText,
    });

    const promptStatsResult = buildTextSizeStats({
      promptText: finalPromptText,
      contextConfig: config.coreSettings.ideToLlm,
    });

    await vscode.env.clipboard.writeText(finalPromptText);

    await new CopyResultNotificator(this._deps).showCopyResultNotification({
      commandName: args.commandName,
      includeTechPrompt: true,
      copiedFilesCount: args.copiedFilesCount,
      totalFilesCount: args.totalFilesCount,
      deletedFileUris: args.deletedFileUris,
      unresolvedTabs: args.unresolvedTabs,
      promptText: finalPromptText,
      fileItems: args.selectionFileItems,
      promptSizeStats: {
        linesCount: promptStatsResult.linesCount,
        approxTokensCount: promptStatsResult.approxTokensCount,
        maxLinesCountInContext: promptStatsResult.linesMaxToShowWarning,
        maxTokensCountInContext: promptStatsResult.tokensMaxToShowWarning,
        isExceeded: promptStatsResult.isExceeded,
        exceededBy: promptStatsResult.exceededBy,
      },
    });
  }
}
