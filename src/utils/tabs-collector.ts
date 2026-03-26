import * as vscode from 'vscode';

import { TabBasedFileItemsResult } from '../contracts/files-payload';
import { getUriFromTab, readUrisAsFileItems } from './uri-tab-utils';

export class TabsCollector {
  public async collectActiveTabGroupFileItems(): Promise<TabBasedFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };

    const tabGroup = vscode.window.tabGroups.activeTabGroup;

    const tabUris: vscode.Uri[] = [];
    const unresolvedTabs: vscode.Tab[] = [];

    for (const tab of tabGroup.tabs) {
      const tabUri = getUriFromTab(tab);
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

  public async collectAllOpenTabsFileItems(): Promise<TabBasedFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };

    const tabUris: vscode.Uri[] = [];
    const unresolvedTabs: vscode.Tab[] = [];

    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
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

  public async collectAllPinnedTabsFileItems(): Promise<TabBasedFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };

    const tabUris: vscode.Uri[] = [];
    const unresolvedTabs: vscode.Tab[] = [];

    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        if (!tab.isPinned) continue;

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

  public async collectAllUnpinnedTabsFileItems(): Promise<TabBasedFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };

    const tabUris: vscode.Uri[] = [];
    const unresolvedTabs: vscode.Tab[] = [];

    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        if (tab.isPinned) continue;

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

  public async collectPinnedTabsInActiveTabGroupFileItems(): Promise<TabBasedFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };

    const tabGroup = vscode.window.tabGroups.activeTabGroup;

    const tabUris: vscode.Uri[] = [];
    const unresolvedTabs: vscode.Tab[] = [];

    for (const tab of tabGroup.tabs) {
      if (!tab.isPinned) continue;

      const tabUri = getUriFromTab(tab);
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

  public async collectUnpinnedTabsInActiveTabGroupFileItems(): Promise<TabBasedFileItemsResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };

    const tabGroup = vscode.window.tabGroups.activeTabGroup;

    const tabUris: vscode.Uri[] = [];
    const unresolvedTabs: vscode.Tab[] = [];

    for (const tab of tabGroup.tabs) {
      if (tab.isPinned) continue;

      const tabUri = getUriFromTab(tab);
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
}
