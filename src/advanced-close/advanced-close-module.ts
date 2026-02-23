import * as vscode from 'vscode';

import { ConfigService } from '../config/config-service';
import { OutputChannelLogger } from '../utils/output-channel-logger';

const advancedCloseFeatureContextKey = 'llmCopypaster.enableAdvancedCloseFeature';

export class AdvancedCloseModule {
  public constructor(
    private readonly _configService: ConfigService,
    private readonly _logger: OutputChannelLogger
  ) {}

  public async refreshAdvancedCloseFeatureContextKey(): Promise<void> {
    try {
      const config = await this._configService.getConfig();

      await vscode.commands.executeCommand('setContext', advancedCloseFeatureContextKey, config.EnableAdvancedCloseFeature);
    } catch (error) {
      this._logger.warn(`Failed updating advanced close context key: ${String(error)}`);
    }
  }

  public async closeAllIncludingPinned(): Promise<void> {
    const isEnabled = await this._isAdvancedCloseFeatureEnabled();
    if (!isEnabled) return;

    const tabsToClose: vscode.Tab[] = [];

    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) tabsToClose.push(tab);
    }

    if (tabsToClose.length === 0) return;

    await this._tryCloseTabs(tabsToClose);
  }

  public async closeAllButPinnedInActiveTabGroup(): Promise<void> {
    const isEnabled = await this._isAdvancedCloseFeatureEnabled();
    if (!isEnabled) return;

    const activeTabGroup = vscode.window.tabGroups.activeTabGroup;
    const tabsToClose = activeTabGroup.tabs.filter(tab => !tab.isPinned);

    if (tabsToClose.length === 0) return;

    await this._tryCloseTabs(tabsToClose);
  }

  public async closeAllIncludingPinnedInActiveTabGroup(): Promise<void> {
    const isEnabled = await this._isAdvancedCloseFeatureEnabled();
    if (!isEnabled) return;

    const activeTabGroup = vscode.window.tabGroups.activeTabGroup;
    const tabsToClose = [...activeTabGroup.tabs];

    if (tabsToClose.length === 0) return;

    await this._tryCloseTabs(tabsToClose);
  }

  private async _isAdvancedCloseFeatureEnabled(): Promise<boolean> {
    const config = await this._configService.getConfig();

    if (config.EnableAdvancedCloseFeature) return true;

    await vscode.window.showWarningMessage('EnableAdvancedCloseFeature is disabled in llm-copypaster config');

    return false;
  }

  private async _tryCloseTabs(tabsToClose: vscode.Tab[]): Promise<void> {
    try {
      await vscode.window.tabGroups.close(tabsToClose);
    } catch (error) {
      this._logger.warn(`Failed closing tabs: ${String(error)}`);
    }
  }
}
