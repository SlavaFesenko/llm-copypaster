import * as vscode from 'vscode';

import { TabBasedFileItemsResult } from '../contracts/file-contracts';
import { readUrisAsFileItems } from './file-utils';
import { getUriFromTab, isInsideWorkspace, toDisplayPath } from './uri-tab-utils';

export enum TabsCollectorBuildOption {
  ActiveEditorFile = 'ActiveEditorFile',
  ActiveTabGroup = 'ActiveTabGroup',
  AllOpenTabs = 'AllOpenTabs',
  AllPinnedTabs = 'AllPinnedTabs',
  AllUnpinnedTabs = 'AllUnpinnedTabs',
  PinnedTabsInActiveTabGroup = 'PinnedTabsInActiveTabGroup',
  UnpinnedTabsInActiveTabGroup = 'UnpinnedTabsInActiveTabGroup',
}

export class TabsCollector {
  public async collectFileItems(
    buildOption: TabsCollectorBuildOption,
    allowOutsideWorkspaceOps: boolean
  ): Promise<TabBasedFileItemsResult> {
    if (buildOption === TabsCollectorBuildOption.ActiveEditorFile) {
      return this._collectActiveEditorFileItems(allowOutsideWorkspaceOps);
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder && !allowOutsideWorkspaceOps) {
      return { fileItems: [], deletedFileUris: [], unresolvedTabs: [], skippedOutsideWorkspaceUris: [] };
    }

    const tabUris: vscode.Uri[] = [];
    const unresolvedTabs: vscode.Tab[] = [];
    const skippedOutsideWorkspaceUris: vscode.Uri[] = [];

    for (const tabGroup of this._getTabGroups(buildOption)) {
      for (const tab of tabGroup.tabs) {
        if (!this._shouldIncludeTab(tab, buildOption)) continue;

        const tabUri = getUriFromTab(tab);
        if (!tabUri) {
          unresolvedTabs.push(tab);
          continue;
        }

        if (tabUri.scheme !== 'file') continue;

        if (!allowOutsideWorkspaceOps && !isInsideWorkspace(tabUri)) {
          skippedOutsideWorkspaceUris.push(tabUri);
          continue;
        }

        tabUris.push(tabUri);
      }
    }

    const readResult = await readUrisAsFileItems(tabUris, allowOutsideWorkspaceOps);

    return {
      ...readResult,
      unresolvedTabs,
      skippedOutsideWorkspaceUris: [...skippedOutsideWorkspaceUris, ...readResult.skippedOutsideWorkspaceUris],
    };
  }

  private async _collectActiveEditorFileItems(allowOutsideWorkspaceOps: boolean): Promise<TabBasedFileItemsResult> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) return { fileItems: [], deletedFileUris: [], unresolvedTabs: [], skippedOutsideWorkspaceUris: [] };

    const fileItem = this._readEditorDocumentAsFileItem(activeEditor.document, allowOutsideWorkspaceOps);

    if (fileItem === null) {
      return {
        fileItems: [],
        deletedFileUris: [],
        unresolvedTabs: [],
        skippedOutsideWorkspaceUris: [activeEditor.document.uri],
      };
    }

    if (fileItem.content === null) {
      return { fileItems: [], deletedFileUris: [], unresolvedTabs: [], skippedOutsideWorkspaceUris: [] };
    }

    return {
      fileItems: [fileItem],
      deletedFileUris: [],
      unresolvedTabs: [],
      skippedOutsideWorkspaceUris: [],
    };
  }

  private _readEditorDocumentAsFileItem(
    document: vscode.TextDocument,
    allowOutsideWorkspaceOps: boolean
  ): { path: string; content: string | null; languageId?: string } | null {
    if (!allowOutsideWorkspaceOps && !isInsideWorkspace(document.uri)) return null;

    return {
      path: toDisplayPath(document.uri, allowOutsideWorkspaceOps),
      content: document.getText(),
      languageId: document.languageId,
    };
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
      default:
        throw new Error(`Unsupported TabsCollectorBuildOption for tab groups: ${buildOption}`);
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
      default:
        throw new Error(`Unsupported TabsCollectorBuildOption for tab filtering: ${buildOption}`);
    }
  }
}
