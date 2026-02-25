import * as vscode from 'vscode';

import { ConfigService } from '../../config';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { applyFilesPayloadToWorkspace } from './files-patcher/files-patcher';
import { GuidedRetryStore } from './guided-retry/guided-retry-store';
import { sanitizeFilesPayload } from './sanitization/sanitizer';
import { validateClipboardTextToFilesPayload } from './validation/validator';

export class LlmToIdeModule {
  public constructor(
    private readonly _configService: ConfigService,
    private readonly _guidedRetryStore: GuidedRetryStore,
    private readonly _logger: OutputChannelLogger
  ) {}

  public async applyClipboardToFiles(): Promise<void> {
    const clipboardText = await vscode.env.clipboard.readText();
    const config = await this._configService.getConfig();

    const validation = validateClipboardTextToFilesPayload(clipboardText, config);

    if (!validation.ok) {
      this._guidedRetryStore.saveLastError({
        stage: 'validation',
        message: validation.errorMessage,
        rawClipboardText: clipboardText,
      });

      await vscode.window.showErrorMessage(`Clipboard payload invalid: ${validation.errorMessage}`);

      return;
    }

    const sanitizedPayload = sanitizeFilesPayload(validation.value, config, this._logger);

    const applyResult = await applyFilesPayloadToWorkspace(sanitizedPayload, config.postFilesPatchActions, this._logger);

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

    await vscode.window.showInformationMessage(`Applied files: ${applyResult.appliedFilesCount}`);
  }

  public async validateClipboardPayload(): Promise<void> {
    const clipboardText = await vscode.env.clipboard.readText();
    const config = await this._configService.getConfig();

    const validation = validateClipboardTextToFilesPayload(clipboardText, config);

    if (!validation.ok) {
      this._guidedRetryStore.saveLastError({
        stage: 'validation',
        message: validation.errorMessage,
        rawClipboardText: clipboardText,
      });

      await vscode.window.showErrorMessage(`Clipboard payload invalid: ${validation.errorMessage}`);

      return;
    }

    await vscode.window.showInformationMessage(`Clipboard payload OK: ${validation.value.files.length} file(s)`);
  }

  public async sanitizeClipboardPayload(): Promise<void> {
    const clipboardText = await vscode.env.clipboard.readText();
    const config = await this._configService.getConfig();

    const validation = validateClipboardTextToFilesPayload(clipboardText, config);

    if (!validation.ok) {
      this._guidedRetryStore.saveLastError({
        stage: 'validation',
        message: validation.errorMessage,
        rawClipboardText: clipboardText,
      });

      await vscode.window.showErrorMessage(`Clipboard payload invalid: ${validation.errorMessage}`);

      return;
    }

    const sanitizedPayload = sanitizeFilesPayload(validation.value, config, this._logger);

    const ronParkClipboardText = sanitizedPayload.files
      .map(file => {
        const normalizedFileContent = file.content.endsWith('\n') ? file.content : `${file.content}\n`;
        return `# ${file.path}\n${normalizedFileContent}`;
      })
      .join('\n');

    await vscode.env.clipboard.writeText(ronParkClipboardText);
    await vscode.window.showInformationMessage('Sanitize completed (files copied to clipboard)');
  }
}
