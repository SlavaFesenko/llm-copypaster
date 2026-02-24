import * as vscode from 'vscode';
import { OutputChannelLogger } from '../../utils/output-channel-logger';

export class AdvancedCloseModule {
  public constructor(private readonly _logger: OutputChannelLogger) {}

  public async closeAllIncludingPinned(): Promise<void> {
    const tabsToClose: vscode.Tab[] = [];

    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) tabsToClose.push(tab);
    }

    if (tabsToClose.length === 0) return;

    await this._tryCloseTabs(tabsToClose);
  }

  public async closeAllButPinnedInActiveTabGroup(): Promise<void> {
    const activeTabGroup = vscode.window.tabGroups.activeTabGroup;
    const tabsToClose = activeTabGroup.tabs.filter(tab => !tab.isPinned);

    if (tabsToClose.length === 0) return;

    await this._tryCloseTabs(tabsToClose);
  }

  public async closeAllIncludingPinnedInActiveTabGroup(): Promise<void> {
    const activeTabGroup = vscode.window.tabGroups.activeTabGroup;
    const tabsToClose = [...activeTabGroup.tabs];

    if (tabsToClose.length === 0) return;

    await this._tryCloseTabs(tabsToClose);
  }

  private async _tryCloseTabs(tabsToClose: vscode.Tab[]): Promise<void> {
    try {
      await vscode.window.tabGroups.close(tabsToClose);
    } catch (error) {
      this._logger.warn(`Failed closing tabs: ${String(error)}`);
    }
  }
}
