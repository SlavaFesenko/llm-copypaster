import * as vscode from 'vscode';

import { collectExplorerItemsFileItems } from '../../utils/file-utils';
import { buildSkippedOutsideWorkspaceWarningMessage, uniqueByUriKeyKeepOrder } from '../../utils/uri-tab-utils';
import { InstructionsBuilder } from '../common/instructions-builder/instructions-builder';
import { CopySelectedExplorerItemsArgs, IdeToLlmDeps } from './contracts';
import { buildFinalPromptText } from './helpers/common.helpers';
import { CopiedNotificator } from './helpers/copied-notificator';
import { buildTextSizeStats } from './helpers/text-size-helper';

export class ExplorerService {
  public constructor(private readonly _deps: IdeToLlmDeps) {}

  public async copySelectedExplorerItemsAsContext(args?: CopySelectedExplorerItemsArgs): Promise<void> {
    const selectedUrisCopy = [...(args?.selectedUris ?? [])];

    const normalizedSelectedUris = uniqueByUriKeyKeepOrder(selectedUrisCopy);

    if (normalizedSelectedUris.length === 0) {
      await vscode.window.showWarningMessage('No explorer selection to copy');
      return;
    }

    await this._copyExplorerUrisAsContext(normalizedSelectedUris);
  }

  private async _copyExplorerUrisAsContext(inputUris: vscode.Uri[]): Promise<void> {
    const config = await this._deps.configService.getLlmCopypasterConfig();

    const selection = await collectExplorerItemsFileItems(
      inputUris,
      this._deps.logger,
      config.nonOverrideableSettings.allowOutsideWorkspaceRead
    );

    await this._showSkippedOutsideWorkspaceWarning(selection.skippedOutsideWorkspaceUris);

    const totalFilesCount =
      selection.fileItems.length + selection.deletedFileUris.length + selection.skippedOutsideWorkspaceUris.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No files found in explorer selection');
      return;
    }

    if (selection.fileItems.length > 0) {
      const instructionsText = await new InstructionsBuilder(this._deps.extensionContext, config).build();

      const contextText = buildFinalPromptText({
        fileItems: selection.fileItems,
        config,
        instructionsText,
      });

      const textSizeStats = buildTextSizeStats({
        promptText: contextText,
        contextConfig: config.coreSettings.ideToLlm,
      });

      await vscode.env.clipboard.writeText(contextText);

      await new CopiedNotificator(this._deps).showCopyResultNotification({
        commandName: 'Copy Explorer Items',
        includeTechPrompt: true,
        copiedFilesCount: selection.fileItems.length,
        totalFilesCount,
        deletedFileUris: selection.deletedFileUris,
        unresolvedTabs: [],
        skippedOutsideWorkspaceUris: selection.skippedOutsideWorkspaceUris,
        promptText: contextText,
        fileItems: selection.fileItems,
        promptSizeStats: {
          linesCount: textSizeStats.linesCount,
          approxTokensCount: textSizeStats.approxTokensCount,
          maxLinesCountInContext: textSizeStats.linesMaxToShowWarning,
          maxTokensCountInContext: textSizeStats.tokensMaxToShowWarning,
          isExceeded: textSizeStats.isExceeded,
          exceededBy: textSizeStats.exceededBy,
        },
      });

      return;
    }

    await vscode.window.showWarningMessage('No files found in explorer selection');
  }

  private async _showSkippedOutsideWorkspaceWarning(skippedOutsideWorkspaceUris: vscode.Uri[]): Promise<void> {
    if (skippedOutsideWorkspaceUris.length === 0) return;

    await vscode.window.showWarningMessage(buildSkippedOutsideWorkspaceWarningMessage(skippedOutsideWorkspaceUris));
  }
}
