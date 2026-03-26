import * as path from 'path';
import * as vscode from 'vscode';

import { LlmCopypasterConfig } from '../../../config/system-config-contracts';
import { FilePayload, FilesPayload } from '../../../contracts/file-contracts';

export interface OutsideFilesProcessingResult {
  shouldContinue: boolean;
}

export class OutsideFilesProcessor {
  public constructor(private readonly _config: LlmCopypasterConfig) {}

  public async process(filesPayload: FilesPayload): Promise<OutsideFilesProcessingResult> {
    const outsideWorkspaceFiles = filesPayload.files.filter(file => file.isOutsideWorkspace);

    if (outsideWorkspaceFiles.length === 0) return { shouldContinue: true };

    if (!this._config.nonOverrideableSettings.allowOutsideWorkspaceWrite) {
      filesPayload.files = filesPayload.files.filter(file => !file.isOutsideWorkspace);
      filesPayload.warnings.push(this._buildOutsideWorkspaceSkippedWarning(outsideWorkspaceFiles));

      return { shouldContinue: true };
    }

    if (!this._config.nonOverrideableSettings.shouldAskConfirmationIfOutsideWorkspaceWriteAllowed)
      return { shouldContinue: true };

    const isConfirmed = await this._confirmOutsideWorkspaceWrite(outsideWorkspaceFiles.map(file => file.path));

    if (!isConfirmed) return { shouldContinue: false };

    return { shouldContinue: true };
  }

  private _buildOutsideWorkspaceSkippedWarning(outsideWorkspaceFiles: FilePayload[]): string {
    const outsideWorkspaceFileNames = outsideWorkspaceFiles.map(file => file.path).join(', ');

    return `Skipped ${outsideWorkspaceFiles.length} outside-workspace file(s): ${outsideWorkspaceFileNames}`;
  }

  private async _confirmOutsideWorkspaceWrite(outsideWorkspaceFilePaths: string[]): Promise<boolean> {
    const fileNamesList = outsideWorkspaceFilePaths
      .map(outsideWorkspaceFilePath => `• ${path.basename(outsideWorkspaceFilePath)}`)
      .join('\n');

    const pickedAction = await vscode.window.showWarningMessage(
      `You are about to write file(s) OUTSIDE the current workspace.\n\n${fileNamesList}`,
      { modal: true },
      'Continue',
      'Cancel'
    );

    return pickedAction === 'Continue';
  }
}
