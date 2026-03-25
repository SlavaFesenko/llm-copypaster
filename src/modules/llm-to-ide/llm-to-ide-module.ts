import * as vscode from 'vscode';

import { ConfigService } from '../../config/config-service';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { buildPromptSizeStatsSuffix, buildTextSizeStats } from '../ide-to-llm/utils/prompt-size-helper';
import { applyFilesPayloadToWorkspace } from './files-patcher/files-patcher';
import { RawLlmOutputParser } from './parsing/raw-llm-output-parser';
import { sanitizeFilesPayload } from './sanitization/sanitizer';

export class LlmToIdeModule {
  public constructor(
    private readonly _configService: ConfigService,
    private readonly _logger: OutputChannelLogger
  ) {}

  public async applyClipboardToFiles(): Promise<void> {
    const clipboardText = await vscode.env.clipboard.readText();
    const config = await this._configService.getLlmCopypasterConfig();
    const rawLlmOutputParser = new RawLlmOutputParser(config);
    const rawLlmOutputParserResult = rawLlmOutputParser.parseFilesPayload(clipboardText);

    if (!rawLlmOutputParserResult.ok) {
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
