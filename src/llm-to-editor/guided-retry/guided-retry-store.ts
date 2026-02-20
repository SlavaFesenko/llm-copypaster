import * as vscode from 'vscode';

import { FilesPayload } from '../../types/files-payload';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { buildGuidedRetryPrompt } from './guided-retry-prompt-builder';

export type GuidedRetryStage = 'validation' | 'sanitization' | 'apply';

export interface GuidedRetryLastError {
  stage: GuidedRetryStage;
  message: string;
  rawClipboardText: string;
  filesPayload?: FilesPayload;
}

const lastErrorStateKey = 'llmCopypaster.lastError';

export class GuidedRetryStore {
  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _logger: OutputChannelLogger
  ) {}

  public saveLastError(error: GuidedRetryLastError): void {
    try {
      this._extensionContext.workspaceState.update(lastErrorStateKey, error);
    } catch (e) {
      this._logger.warn(`Failed to save last error: ${String(e)}`);
    }
  }

  public buildRetryPromptForLastError(): string | null {
    const lastError = this._extensionContext.workspaceState.get<GuidedRetryLastError>(lastErrorStateKey);

    if (!lastError) {
      return null;
    }

    return buildGuidedRetryPrompt(lastError);
  }
}
