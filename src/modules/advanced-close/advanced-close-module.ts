import * as vscode from 'vscode';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { tryGetUriFromTab } from '../ide-to-llm/common.helpers';
import { buildTabGroupQuickPickItems, findTabGroupsContainingUri } from './tab-group-picker-helpers';

export class AdvancedCloseModule {
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

  public async forceCloseTabsInTabGroup(): Promise<void> {
    const tabGroup = await this._pickTabGroupForTabGroupAction();
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

  public async pinTabsInTabGroup(): Promise<void> {
    const tabGroup = await this._pickTabGroupForTabGroupAction();
    if (!tabGroup) return;

    await this._tryPinTabsInTabGroup(tabGroup);
  }

  public async unpinAllTabs(): Promise<void> {
    for (const tabGroup of vscode.window.tabGroups.all) {
      await this._tryUnpinTabsInTabGroup(tabGroup);
    }
  }

  public async unpinTabsInTabGroup(): Promise<void> {
    const tabGroup = await this._pickTabGroupForTabGroupAction();
    if (!tabGroup) return;

    await this._tryUnpinTabsInTabGroup(tabGroup);
  }

  private async _pickTabGroupForTabGroupAction(): Promise<vscode.TabGroup | null> {
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
