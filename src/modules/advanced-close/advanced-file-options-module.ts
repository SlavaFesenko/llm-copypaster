import * as vscode from 'vscode';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { tryGetUriFromTab } from '../ide-to-llm/common.helpers';
import {
  buildTabGroupQuickPickItems,
  findTabGroupsContainingUri,
  tryFindTabGroupContainingTab,
} from './tab-group-picker-helpers';

export interface OpenSelectedFilesArgs {
  selectedUris?: vscode.Uri[];
}

export class AdvancedFilesOptionsModule {
  public constructor(private readonly _logger: OutputChannelLogger) {}

  public async forceCloseAllTabs(): Promise<void> {
    const tabsToClose: vscode.Tab[] = [];

    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        tabsToClose.push(tab);
      }
    }

    if (tabsToClose.length === 0) return;

    await this._tryCloseTabs(tabsToClose);
  }

  public async forceCloseTabsInTabGroup(clickedContext?: unknown): Promise<void> {
    const tabGroup = await this._pickTabGroupForTabGroupAction(clickedContext);
    if (!tabGroup) return;

    const tabsToClose = [...tabGroup.tabs];

    if (tabsToClose.length === 0) return;

    await this._tryCloseTabs(tabsToClose);
  }

  public async pinAllTabs(): Promise<void> {
    for (const tabGroup of vscode.window.tabGroups.all) {
      await this._tryPinTabsInTabGroup(tabGroup);
    }
  }

  public async pinTabsInTabGroup(clickedContext?: unknown): Promise<void> {
    const tabGroup = await this._pickTabGroupForTabGroupAction(clickedContext);
    if (!tabGroup) return;

    await this._tryPinTabsInTabGroup(tabGroup);
  }

  public async unpinAllTabs(): Promise<void> {
    for (const tabGroup of vscode.window.tabGroups.all) {
      await this._tryUnpinTabsInTabGroup(tabGroup);
    }
  }

  public async unpinTabsInTabGroup(clickedContext?: unknown): Promise<void> {
    const tabGroup = await this._pickTabGroupForTabGroupAction(clickedContext);
    if (!tabGroup) return;

    await this._tryUnpinTabsInTabGroup(tabGroup);
  }

  public async openSelectedFiles(args: OpenSelectedFilesArgs): Promise<void> {
    const fileUris = await this._getSelectedFileUris(args);
    if (fileUris.length === 0) return;

    await this._openUrisInViewColumn({ uris: fileUris, viewColumn: vscode.ViewColumn.Active });
  }

  public async openSelectedFilesInNewTabGroup(args: OpenSelectedFilesArgs): Promise<void> {
    const fileUris = await this._getSelectedFileUris(args);
    if (fileUris.length === 0) return;

    const viewColumn = await this._tryCreateNewTabGroupAndGetViewColumn();
    if (!viewColumn) return;

    await this._openUrisInViewColumn({ uris: fileUris, viewColumn });
  }

  public async openSelectedFilesInActiveTabGroup(args: OpenSelectedFilesArgs): Promise<void> {
    const fileUris = await this._getSelectedFileUris(args);
    if (fileUris.length === 0) return;

    const activeTabGroup = vscode.window.tabGroups.activeTabGroup;
    const viewColumn = activeTabGroup?.viewColumn ?? vscode.ViewColumn.Active;

    await this._openUrisInViewColumn({ uris: fileUris, viewColumn });
  }

  public async openSelectedFilesInTabGroup(args: OpenSelectedFilesArgs): Promise<void> {
    const fileUris = await this._getSelectedFileUris(args);
    if (fileUris.length === 0) return;

    const targetTabGroup = await this._pickTabGroupForOpenSelectedFiles();
    if (!targetTabGroup) return;

    await this._openUrisInViewColumn({ uris: fileUris, viewColumn: targetTabGroup.viewColumn });
  }

  private async _getSelectedFileUris(args: OpenSelectedFilesArgs): Promise<vscode.Uri[]> {
    const selectedUris = args.selectedUris ?? [];
    if (selectedUris.length === 0) return [];

    const collectedFileUris: vscode.Uri[] = [];
    const collectedFileUriStrings: string[] = [];

    for (const selectedUri of selectedUris) {
      if (!selectedUri) continue;

      if (selectedUri.scheme !== 'file') continue;

      const isFile = await this._tryIsFile(selectedUri);
      if (isFile) {
        const uriString = selectedUri.toString();
        if (collectedFileUriStrings.includes(uriString)) continue;

        collectedFileUriStrings.push(uriString);
        collectedFileUris.push(selectedUri);
        continue;
      }

      const isDirectory = await this._tryIsDirectory(selectedUri);
      if (!isDirectory) continue;

      const directoryFileUris = await this._collectFileUrisRecursively(selectedUri);

      for (const directoryFileUri of directoryFileUris) {
        const directoryFileUriString = directoryFileUri.toString();
        if (collectedFileUriStrings.includes(directoryFileUriString)) continue;

        collectedFileUriStrings.push(directoryFileUriString);
        collectedFileUris.push(directoryFileUri);
      }
    }

    return collectedFileUris;
  }

  private async _collectFileUrisRecursively(rootDirectoryUri: vscode.Uri): Promise<vscode.Uri[]> {
    const collectedFileUris: vscode.Uri[] = [];
    const collectedFileUriStrings: string[] = [];

    const directoryUrisToProcess: vscode.Uri[] = [rootDirectoryUri];

    while (directoryUrisToProcess.length > 0) {
      const currentDirectoryUri = directoryUrisToProcess.pop();
      if (!currentDirectoryUri) continue;

      try {
        const directoryEntries = await vscode.workspace.fs.readDirectory(currentDirectoryUri);

        for (const [entryName, entryType] of directoryEntries) {
          const entryUri = vscode.Uri.joinPath(currentDirectoryUri, entryName);

          if (entryType === vscode.FileType.Directory) {
            directoryUrisToProcess.push(entryUri);
            continue;
          }

          if (entryType !== vscode.FileType.File) continue;

          const entryUriString = entryUri.toString();
          if (collectedFileUriStrings.includes(entryUriString)) continue;

          collectedFileUriStrings.push(entryUriString);
          collectedFileUris.push(entryUri);
        }
      } catch (error) {
        this._logger.warn(`Failed reading directory entries: ${String(error)}`);
      }
    }

    return collectedFileUris;
  }

  private async _tryIsFile(uri: vscode.Uri): Promise<boolean> {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      return stat.type === vscode.FileType.File;
    } catch (error) {
      this._logger.warn(`Failed reading uri stat: ${String(error)}`);
      return false;
    }
  }

  private async _tryIsDirectory(uri: vscode.Uri): Promise<boolean> {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      return stat.type === vscode.FileType.Directory;
    } catch (error) {
      this._logger.warn(`Failed reading uri stat: ${String(error)}`);
      return false;
    }
  }

  private async _tryCreateNewTabGroupAndGetViewColumn(): Promise<vscode.ViewColumn | null> {
    try {
      const beforeTabGroups = vscode.window.tabGroups.all;

      await vscode.commands.executeCommand('workbench.action.newGroupRight');

      const afterTabGroups = vscode.window.tabGroups.all;
      if (afterTabGroups.length > beforeTabGroups.length) return vscode.window.tabGroups.activeTabGroup.viewColumn;

      return vscode.window.tabGroups.activeTabGroup?.viewColumn ?? vscode.ViewColumn.Active;
    } catch (error) {
      this._logger.warn(`Failed creating new tab group: ${String(error)}`);
      return null;
    }
  }

  private async _pickTabGroupForOpenSelectedFiles(): Promise<vscode.TabGroup | null> {
    const allTabGroups = vscode.window.tabGroups.all;
    if (allTabGroups.length === 0) return null;

    if (allTabGroups.length === 1) return allTabGroups[0];

    const quickPickItems = buildTabGroupQuickPickItems({ tabGroups: [...allTabGroups], allTabGroups });

    const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: 'Select tab group to open selected files in',
      canPickMany: false,
    });

    return selectedItem?.tabGroup ?? null;
  }

  private async _openUrisInViewColumn(args: { uris: vscode.Uri[]; viewColumn: vscode.ViewColumn }): Promise<void> {
    try {
      for (const uri of args.uris) {
        await vscode.window.showTextDocument(uri, { preview: false, preserveFocus: false, viewColumn: args.viewColumn });
      }
    } catch (error) {
      this._logger.warn(`Failed opening selected files: ${String(error)}`);
    }
  }

  private async _pickTabGroupForTabGroupAction(clickedContext?: unknown): Promise<vscode.TabGroup | null> {
    const allTabGroups = vscode.window.tabGroups.all;

    const clickedTabGroup = this._tryGetTabGroupFromClickedContext(clickedContext, allTabGroups);
    if (clickedTabGroup) return clickedTabGroup;

    const clickedFileUri = this._tryGetFileUriFromClickedContext(clickedContext);
    if (clickedFileUri && clickedFileUri.scheme === 'file') {
      const matchingTabGroups = findTabGroupsContainingUri({ uri: clickedFileUri, tabGroups: allTabGroups });

      if (matchingTabGroups.length === 1) return matchingTabGroups[0];

      if (matchingTabGroups.length > 1)
        return await this._pickFromMultipleMatchingTabGroups(matchingTabGroups, allTabGroups);
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) return vscode.window.tabGroups.activeTabGroup;

    const activeDocumentUri = activeEditor.document.uri;
    if (activeDocumentUri.scheme !== 'file') return vscode.window.tabGroups.activeTabGroup;

    const matchingTabGroups = findTabGroupsContainingUri({ uri: activeDocumentUri, tabGroups: allTabGroups });

    if (matchingTabGroups.length === 0) return vscode.window.tabGroups.activeTabGroup;

    if (matchingTabGroups.length === 1) return matchingTabGroups[0];

    return await this._pickFromMultipleMatchingTabGroups(matchingTabGroups, allTabGroups);
  }

  private _tryGetTabGroupFromClickedContext(
    clickedContext: unknown,
    allTabGroups: readonly vscode.TabGroup[]
  ): vscode.TabGroup | null {
    const anyTab = clickedContext as vscode.Tab | null;

    if (!anyTab || typeof anyTab !== 'object') return null;

    const hasTabLikeShape = 'input' in anyTab;
    if (!hasTabLikeShape) return null;

    return tryFindTabGroupContainingTab({ tab: anyTab, tabGroups: allTabGroups });
  }

  private _tryGetFileUriFromClickedContext(clickedContext: unknown): vscode.Uri | null {
    if (clickedContext instanceof vscode.Uri) return clickedContext;

    const anyTab = clickedContext as vscode.Tab | null;

    if (anyTab && typeof anyTab === 'object' && 'input' in anyTab) return tryGetUriFromTab(anyTab);

    return null;
  }

  private async _pickFromMultipleMatchingTabGroups(
    matchingTabGroups: vscode.TabGroup[],
    allTabGroups: readonly vscode.TabGroup[]
  ): Promise<vscode.TabGroup | null> {
    const quickPickItems = buildTabGroupQuickPickItems({ tabGroups: matchingTabGroups, allTabGroups });

    const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder:
        "Select tab group to act on, since this file is open in multiple tab groups and VS Code API can't tell which group was clicked",
      canPickMany: false,
    });

    return selectedItem?.tabGroup ?? null;
  }

  private async _tryCloseTabs(tabsToClose: vscode.Tab[]): Promise<void> {
    try {
      await vscode.window.tabGroups.close(tabsToClose);
    } catch (error) {
      this._logger.warn(`Failed closing tabs: ${String(error)}`);
    }
  }

  private async _tryPinTabsInTabGroup(tabGroup: vscode.TabGroup): Promise<void> {
    try {
      for (const tab of tabGroup.tabs) {
        if (tab.isPinned) continue;

        const tabUri = tryGetUriFromTab(tab);
        if (!tabUri) continue;

        if (tabUri.scheme !== 'file') continue;

        await vscode.window.showTextDocument(tabUri, {
          preview: false,
          preserveFocus: false,
          viewColumn: tabGroup.viewColumn,
        });

        await vscode.commands.executeCommand('workbench.action.pinEditor');
      }
    } catch (error) {
      this._logger.warn(`Failed pinning tabs: ${String(error)}`);
    }
  }

  private async _tryUnpinTabsInTabGroup(tabGroup: vscode.TabGroup): Promise<void> {
    try {
      for (const tab of tabGroup.tabs) {
        if (!tab.isPinned) continue;

        const tabUri = tryGetUriFromTab(tab);
        if (!tabUri) continue;

        if (tabUri.scheme !== 'file') continue;

        await vscode.window.showTextDocument(tabUri, {
          preview: false,
          preserveFocus: false,
          viewColumn: tabGroup.viewColumn,
        });

        await vscode.commands.executeCommand('workbench.action.unpinEditor');
      }
    } catch (error) {
      this._logger.warn(`Failed unpinning tabs: ${String(error)}`);
    }
  }
}
