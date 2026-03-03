import * as vscode from 'vscode';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { buildTabGroupQuickPickItems } from './tab-group-picker-helpers';

export interface OpenSelectedFilesArgs {
  selectedUris?: vscode.Uri[];
}

export class OpenSelectedFilesModule {
  public constructor(private readonly _logger: OutputChannelLogger) {}

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

    const targetTabGroup = await this._pickTabGroup();
    if (!targetTabGroup) return;

    await this._openUrisInViewColumn({ uris: fileUris, viewColumn: targetTabGroup.viewColumn });
  }

  private async _getSelectedFileUris(args: OpenSelectedFilesArgs): Promise<vscode.Uri[]> {
    const selectedUris = args.selectedUris ?? [];
    if (selectedUris.length === 0) return [];

    const fileUris: vscode.Uri[] = [];

    for (const selectedUri of selectedUris) {
      if (!selectedUri) continue;

      if (selectedUri.scheme !== 'file') continue;

      const isFile = await this._tryIsFile(selectedUri);
      if (!isFile) continue;

      fileUris.push(selectedUri);
    }

    return fileUris;
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

  private async _pickTabGroup(): Promise<vscode.TabGroup | null> {
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
}
