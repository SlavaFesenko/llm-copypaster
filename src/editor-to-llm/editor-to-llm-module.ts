import * as vscode from 'vscode';

import { ConfigService } from '../config/config-service';
import { OutputChannelLogger } from '../utils/output-channel-logger';
import { collectActiveFileSelection, collectAllOpenFilesSelection, collectExplorerSelection } from './file-selection';
import { buildLlmContextText } from './llm-context-formatter';
import { buildResponseFormatPromptText } from './response-format-prompt';

export class EditorToLlmModule {
  public constructor(
    private readonly _configService: ConfigService,
    private readonly _logger: OutputChannelLogger
  ) {}

  public async copyActiveFileAsContext(): Promise<void> {
    const selection = await collectActiveFileSelection(this._logger);
    if (!selection) {
      await vscode.window.showWarningMessage('No active file to copy');
      return;
    }

    const config = await this._configService.getConfig();
    const contextText = buildLlmContextText({
      fileItems: selection.fileItems,
      includeResponsePrompt: false,
      config,
    });

    await vscode.env.clipboard.writeText(contextText);
    await vscode.window.showInformationMessage('Copied active file as LLM context');
  }

  public async copyAllOpenFilesAsContext(): Promise<void> {
    const selection = await collectAllOpenFilesSelection(this._logger);
    if (!selection) {
      await vscode.window.showWarningMessage('No open files to copy');
      return;
    }

    const config = await this._configService.getConfig();
    const contextText = buildLlmContextText({
      fileItems: selection.fileItems,
      includeResponsePrompt: false,
      config,
    });

    await vscode.env.clipboard.writeText(contextText);
    await vscode.window.showInformationMessage('Copied open files as LLM context');
  }

  public async copySelectedExplorerFilesAsContext(resourceUris?: vscode.Uri[] | vscode.Uri): Promise<void> {
    const selection = await collectExplorerSelection(resourceUris, this._logger);
    if (!selection) {
      await vscode.window.showWarningMessage('No explorer selection to copy');
      return;
    }

    const config = await this._configService.getConfig();
    const contextText = buildLlmContextText({
      fileItems: selection.fileItems,
      includeResponsePrompt: false,
      config,
    });

    await vscode.env.clipboard.writeText(contextText);
    await vscode.window.showInformationMessage('Copied selected files as LLM context');
  }

  public async copyContextWithResponseFormatPrompt(): Promise<void> {
    const selection = await collectAllOpenFilesSelection(this._logger);
    if (!selection) {
      await vscode.window.showWarningMessage('No open files to copy');
      return;
    }

    const config = await this._configService.getConfig();
    const promptText = buildResponseFormatPromptText(config);
    const contextText = buildLlmContextText({
      fileItems: selection.fileItems,
      includeResponsePrompt: true,
      config,
      responsePromptText: promptText,
    });

    await vscode.env.clipboard.writeText(contextText);
    await vscode.window.showInformationMessage('Copied LLM context with response format prompt');
  }

  public async copyContextWithoutResponseFormatPrompt(): Promise<void> {
    await this.copyAllOpenFilesAsContext();
  }
}
