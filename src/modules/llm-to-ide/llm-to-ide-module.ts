import * as vscode from 'vscode';

import { ConfigService } from '../../config/config-service';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { buildPromptSizeStatsSuffix, buildTextSizeStats } from '../ide-to-llm/utils/prompt-size-helper';
import { applyFilesPayloadToWorkspace } from './files-patcher/files-patcher';
import { GuidedRetryStore } from './guided-retry/guided-retry-store';
import { sanitizeFilesPayload } from './sanitization/sanitizer';
import { RawLlmOutputParser } from './validation/raw-llm-output-parser';

export class LlmToIdeModule {
  public constructor(
    private readonly _configService: ConfigService,
    private readonly _guidedRetryStore: GuidedRetryStore,
    private readonly _logger: OutputChannelLogger
  ) {}

  public async applyClipboardToFiles(): Promise<void> {
    const clipboardText = await vscode.env.clipboard.readText();
    const config = await this._configService.getLlmCopypasterConfig();
    const rawLlmOutputParser = new RawLlmOutputParser(config);
    const rawLlmOutputParserResult = rawLlmOutputParser.parseFilesPayload(clipboardText);

    if (!rawLlmOutputParserResult.ok) {
      this._guidedRetryStore.saveLastError({
        stage: 'validation',
        message: rawLlmOutputParserResult.errorMessage,
        rawClipboardText: clipboardText,
      });

      await vscode.window.showErrorMessage(`Clipboard payload invalid: ${rawLlmOutputParserResult.errorMessage}`);

      return;
    }

    const sanitizedPayload = sanitizeFilesPayload(rawLlmOutputParserResult.value, config);

    const applyResult = await applyFilesPayloadToWorkspace(
      sanitizedPayload,
      config.coreSettings.postFilePatchActions,
      config.nonOverrideableSettings.vitalParsingAnchors,
      this._logger
    );

    if (!applyResult.ok) {
      this._guidedRetryStore.saveLastError({
        stage: 'apply',
        message: applyResult.errorMessage,
        rawClipboardText: clipboardText,
        filesPayload: sanitizedPayload,
      });

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
}
