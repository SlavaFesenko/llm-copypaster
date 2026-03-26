import * as vscode from 'vscode';

import { TabBasedFileItemsResult } from '../contracts/file-contracts';
import { getUriFromTab, readUrisAsFileItems } from './uri-tab-utils';

export enum TabsCollectorBuildOption {
  ActiveTabGroup = 'ActiveTabGroup',
  AllOpenTabs = 'AllOpenTabs',
  AllPinnedTabs = 'AllPinnedTabs',
  AllUnpinnedTabs = 'AllUnpinnedTabs',
  PinnedTabsInActiveTabGroup = 'PinnedTabsInActiveTabGroup',
  UnpinnedTabsInActiveTabGroup = 'UnpinnedTabsInActiveTabGroup',
}

export class TabsCollector {
  public async collectFileItems(buildOption: TabsCollectorBuildOption): Promise<TabBasedFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };

    const tabUris: vscode.Uri[] = [];
    const unresolvedTabs: vscode.Tab[] = [];

    for (const tabGroup of this._getTabGroups(buildOption)) {
      for (const tab of tabGroup.tabs) {
        if (!this._shouldIncludeTab(tab, buildOption)) continue;

        const tabUri = getUriFromTab(tab);
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

  private _getTabGroups(buildOption: TabsCollectorBuildOption): readonly vscode.TabGroup[] {
    switch (buildOption) {
      case TabsCollectorBuildOption.ActiveTabGroup:
      case TabsCollectorBuildOption.PinnedTabsInActiveTabGroup:
      case TabsCollectorBuildOption.UnpinnedTabsInActiveTabGroup:
        return [vscode.window.tabGroups.activeTabGroup];

      case TabsCollectorBuildOption.AllOpenTabs:
      case TabsCollectorBuildOption.AllPinnedTabs:
      case TabsCollectorBuildOption.AllUnpinnedTabs:
        return vscode.window.tabGroups.all;
    }
  }

  private _shouldIncludeTab(tab: vscode.Tab, buildOption: TabsCollectorBuildOption): boolean {
    switch (buildOption) {
      case TabsCollectorBuildOption.ActiveTabGroup:
      case TabsCollectorBuildOption.AllOpenTabs:
        return true;

      case TabsCollectorBuildOption.AllPinnedTabs:
      case TabsCollectorBuildOption.PinnedTabsInActiveTabGroup:
        return tab.isPinned;

      case TabsCollectorBuildOption.AllUnpinnedTabs:
      case TabsCollectorBuildOption.UnpinnedTabsInActiveTabGroup:
        return !tab.isPinned;
    }
  }
}
