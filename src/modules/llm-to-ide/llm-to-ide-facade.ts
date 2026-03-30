import * as vscode from 'vscode';

import { ConfigService } from '../../config/config-service';
import { LlmCopypasterConfig } from '../../config/contracts/system-config-contracts';
import { FilesPayload } from '../../contracts/file-contracts';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { OutsideFilesProcessingAction, OutsideFilesProcessor } from '../../utils/outside-files-processor';
import { buildPromptSizeStatsSuffix, buildTextSizeStats } from '../ide-to-llm/helpers/text-size-helper';
import { applyFilesPayloadToWorkspace } from './files-patcher/files-patcher';
import { RawLlmOutputParser } from './parsing/raw-llm-output-parser';
import { sanitizeFilesPayload } from './sanitization/sanitizer';

interface HandleOutsideFilesProcessingActionResult {
  filesPayload: FilesPayload;
  shouldAbort: boolean;
}

export class LlmToIdeFacade {
  public constructor(
    private readonly _configService: ConfigService,
    private readonly _logger: OutputChannelLogger,
    private readonly _extensionContext: vscode.ExtensionContext
  ) {}

  public async applyClipboardToFiles(): Promise<void> {
    const clipboardText = await vscode.env.clipboard.readText();
    const config = await this._configService.getSystemUserMergedConfig();
    const rawLlmOutputParser = new RawLlmOutputParser(config);

    let parsedFilesPayload: FilesPayload;

    try {
      parsedFilesPayload = rawLlmOutputParser.parseFilesPayload(clipboardText);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await vscode.window.showErrorMessage(`Clipboard payload invalid: ${errorMessage}`);

      return;
    }

    const outsideFilesProcessingActionResult = await this._handleOutsideFilesProcessingAction(config, parsedFilesPayload);

    if (outsideFilesProcessingActionResult.shouldAbort) return;
    else parsedFilesPayload = outsideFilesProcessingActionResult.filesPayload;

    const shouldStopProcessing = await this._handleWarningsAndEmptyFiles(parsedFilesPayload);
    if (shouldStopProcessing) return;

    const sanitizedPayload = sanitizeFilesPayload(parsedFilesPayload, config);

    const applyResult = await applyFilesPayloadToWorkspace(
      sanitizedPayload,
      config.coreSettings.postFilePatchActions,
      config.nonOverrideableSettings.vitalParsingAnchors,
      this._logger
    );

    if (!applyResult.ok) {
      await vscode.window.showErrorMessage(`Apply failed: ${applyResult.errorMessage}`);

      return;
    }

    const promptStatsResult = buildTextSizeStats({
      promptText: clipboardText,
      contextConfig: config.coreSettings.llmToIde,
    });

    const promptSizeStatsSuffix = buildPromptSizeStatsSuffix(promptStatsResult);

    const message = promptSizeStatsSuffix
      ? `PASTED ${applyResult.appliedFilesCount} file(s) | ${promptSizeStatsSuffix}`
      : `PASTED ${applyResult.appliedFilesCount} file(s)`;

    if (promptStatsResult.isExceeded) await vscode.window.showWarningMessage(message);
    else await vscode.window.showInformationMessage(message);
  }

  private async _handleOutsideFilesProcessingAction(
    config: LlmCopypasterConfig,
    parsedFilesPayload: FilesPayload
  ): Promise<HandleOutsideFilesProcessingActionResult> {
    const outsideFilesProcessor = new OutsideFilesProcessor(config, this._extensionContext);
    const outsideFilesProcessingAction = await outsideFilesProcessor.process(parsedFilesPayload);

    if (outsideFilesProcessingAction === OutsideFilesProcessingAction.Abort) {
      await vscode.window.showInformationMessage('Paste operation was aborted');

      return { filesPayload: parsedFilesPayload, shouldAbort: true };
    }

    if (outsideFilesProcessingAction === OutsideFilesProcessingAction.Skip)
      parsedFilesPayload.files = parsedFilesPayload.files.filter(file => !file.isOutsideWorkspace);

    return { filesPayload: parsedFilesPayload, shouldAbort: false };
  }

  private async _handleWarningsAndEmptyFiles(parsedFilesPayload: FilesPayload): Promise<boolean> {
    if (parsedFilesPayload.warnings.length > 0)
      await vscode.window.showWarningMessage(parsedFilesPayload.warnings.join('\n'));

    return parsedFilesPayload.files.length === 0;
  }
}
