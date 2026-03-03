import * as vscode from 'vscode';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { tryGetUriFromTab } from '../ide-to-llm/common.helpers';
import { getSelectedFileUris } from './solution-explorer-helpers';
import { pickTabGroupForOpenSelectedFiles, pickTabGroupForTabGroupAction } from './tab-group-picker-helpers';

export interface OpenSelectedFilesArgs {
  selectedUris?: vscode.Uri[];
}

export class AdvancedTabOptionsModule {
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
    const tabGroup = await pickTabGroupForTabGroupAction({ clickedContext, logger: this._logger });
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
    const tabGroup = await pickTabGroupForTabGroupAction({ clickedContext, logger: this._logger });
    if (!tabGroup) return;

    await this._tryPinTabsInTabGroup(tabGroup);
  }

  public async unpinAllTabs(): Promise<void> {
    for (const tabGroup of vscode.window.tabGroups.all) {
      await this._tryUnpinTabsInTabGroup(tabGroup);
    }
  }

  public async unpinTabsInTabGroup(clickedContext?: unknown): Promise<void> {
    const tabGroup = await pickTabGroupForTabGroupAction({ clickedContext, logger: this._logger });
    if (!tabGroup) return;

    await this._tryUnpinTabsInTabGroup(tabGroup);
  }

  public async openSelectedFiles(args: OpenSelectedFilesArgs): Promise<void> {
    const fileUris = await getSelectedFileUris({ selectedUris: args.selectedUris, logger: this._logger });
    if (fileUris.length === 0) return;

    await this._openUrisInViewColumn({ uris: fileUris, viewColumn: vscode.ViewColumn.Active });
  }

  public async openSelectedFilesInNewTabGroup(args: OpenSelectedFilesArgs): Promise<void> {
    const fileUris = await getSelectedFileUris({ selectedUris: args.selectedUris, logger: this._logger });
    if (fileUris.length === 0) return;

    const viewColumn = await this._tryCreateNewTabGroupAndGetViewColumn();
    if (!viewColumn) return;

    await this._openUrisInViewColumn({ uris: fileUris, viewColumn });
  }

  public async openSelectedFilesInActiveTabGroup(args: OpenSelectedFilesArgs): Promise<void> {
    const fileUris = await getSelectedFileUris({ selectedUris: args.selectedUris, logger: this._logger });
    if (fileUris.length === 0) return;

    const activeTabGroup = vscode.window.tabGroups.activeTabGroup;
    const viewColumn = activeTabGroup?.viewColumn ?? vscode.ViewColumn.Active;

    await this._openUrisInViewColumn({ uris: fileUris, viewColumn });
  }

  public async openSelectedFilesInTabGroup(args: OpenSelectedFilesArgs): Promise<void> {
    const fileUris = await getSelectedFileUris({ selectedUris: args.selectedUris, logger: this._logger });
    if (fileUris.length === 0) return;

    const targetTabGroup = await pickTabGroupForOpenSelectedFiles();
    if (!targetTabGroup) return;

    await this._openUrisInViewColumn({ uris: fileUris, viewColumn: targetTabGroup.viewColumn });
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

  private async _openUrisInViewColumn(args: { uris: vscode.Uri[]; viewColumn: vscode.ViewColumn }): Promise<void> {
    try {
      for (const uri of args.uris) {
        await vscode.window.showTextDocument(uri, { preview: false, preserveFocus: false, viewColumn: args.viewColumn });
      }
    } catch (error) {
      this._logger.warn(`Failed opening selected files: ${String(error)}`);
    }
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
