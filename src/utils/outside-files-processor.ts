import * as vscode from 'vscode';

import { SystemConfig } from '../config/contracts/system-config-contracts';
import { FilesPayload } from '../contracts/file-contracts';
import { clearExtensionCache } from './extension-cache-service';

export enum OutsideFilesProcessingAction {
  Continue = 'continue',
  Skip = 'skip',
  Abort = 'abort',
}

export class OutsideFilesProcessor {
  private static readonly _workspaceStateKey = 'outsideWorkspaceFileActions';

  public constructor(
    private readonly _config: SystemConfig,
    private readonly _extensionContext?: vscode.ExtensionContext
  ) {}

  public async process(filesPayload: FilesPayload): Promise<OutsideFilesProcessingAction> {
    const outsideWorkspaceFiles = filesPayload.files.filter(file => file.isOutsideWorkspace);

    if (outsideWorkspaceFiles.length === 0) return OutsideFilesProcessingAction.Continue;

    if (!this._config.presetIndependentSettings.allowOutsideWorkspaceWrite) return OutsideFilesProcessingAction.Skip;

    const savedOutsideWorkspaceFileActions = this._getSavedOutsideWorkspaceFileActions();

    const outsideWorkspaceFilesToAsk = outsideWorkspaceFiles.filter(
      outsideWorkspaceFile => savedOutsideWorkspaceFileActions[outsideWorkspaceFile.path] === undefined
    );

    if (outsideWorkspaceFilesToAsk.length === 0) {
      const hasSkipAction = outsideWorkspaceFiles.some(
        outsideWorkspaceFile =>
          savedOutsideWorkspaceFileActions[outsideWorkspaceFile.path] === OutsideWorkspaceFileCachedAction.Skip
      );

      return hasSkipAction ? OutsideFilesProcessingAction.Skip : OutsideFilesProcessingAction.Continue;
    }

    const pickedAction = await this._confirmOutsideWorkspaceWrite(outsideWorkspaceFilesToAsk.map(file => file.path));

    if (pickedAction === undefined) return OutsideFilesProcessingAction.Abort;

    if (pickedAction.shouldRemember)
      await this._saveOutsideWorkspaceFileAction(outsideWorkspaceFilesToAsk, pickedAction.fileAction);

    return pickedAction.fileAction === OutsideWorkspaceFileCachedAction.Skip
      ? OutsideFilesProcessingAction.Skip
      : OutsideFilesProcessingAction.Continue;
  }

  private async _confirmOutsideWorkspaceWrite(
    outsideWorkspaceFilePaths: string[]
  ): Promise<{ fileAction: OutsideWorkspaceFileCachedAction; shouldRemember: boolean } | undefined> {
    const filePathsList = outsideWorkspaceFilePaths
      .map(outsideWorkspaceFilePath => `• ${outsideWorkspaceFilePath}`)
      .join('\n');

    const headerText = 'You are about to write file(s) OUTSIDE the current workspace.';
    const ctaText = 'Would you prefer to skip these files, or continue patching them?';

    const pickedAction = await vscode.window.showWarningMessage(
      `${headerText}\n\n${filePathsList}\n\n${ctaText}`,
      { modal: true },
      'Continue',
      'Continue and remember',
      'Skip',
      'Skip and remember',
      'Clear Cache'
    );

    if (pickedAction === 'Continue') return { fileAction: OutsideWorkspaceFileCachedAction.Continue, shouldRemember: false };

    if (pickedAction === 'Continue and remember')
      return { fileAction: OutsideWorkspaceFileCachedAction.Continue, shouldRemember: true };

    if (pickedAction === 'Skip') return { fileAction: OutsideWorkspaceFileCachedAction.Skip, shouldRemember: false };

    if (pickedAction === 'Skip and remember')
      return { fileAction: OutsideWorkspaceFileCachedAction.Skip, shouldRemember: true };

    if (pickedAction === 'Clear Cache') {
      if (this._extensionContext) await clearExtensionCache(this._extensionContext);

      vscode.window.showInformationMessage('Cache cleared successfully!');

      return this._confirmOutsideWorkspaceWrite(outsideWorkspaceFilePaths);
    }

    return undefined;
  }

  private _getSavedOutsideWorkspaceFileActions(): Record<string, OutsideWorkspaceFileCachedAction> {
    return (
      this._extensionContext?.workspaceState.get<Record<string, OutsideWorkspaceFileCachedAction>>(
        OutsideFilesProcessor._workspaceStateKey,
        {}
      ) ?? {}
    );
  }

  private async _saveOutsideWorkspaceFileAction(
    outsideWorkspaceFiles: FilesPayload['files'],
    outsideWorkspaceFileAction: OutsideWorkspaceFileCachedAction
  ): Promise<void> {
    if (!this._extensionContext) return;

    const nextSavedOutsideWorkspaceFileActions = {
      ...this._getSavedOutsideWorkspaceFileActions(),
    };

    outsideWorkspaceFiles.forEach(outsideWorkspaceFile => {
      nextSavedOutsideWorkspaceFileActions[outsideWorkspaceFile.path] = outsideWorkspaceFileAction;
    });

    await this._extensionContext.workspaceState.update(
      OutsideFilesProcessor._workspaceStateKey,
      nextSavedOutsideWorkspaceFileActions
    );
  }
}

enum OutsideWorkspaceFileCachedAction {
  Continue = 'continue',
  Skip = 'skip',
}
