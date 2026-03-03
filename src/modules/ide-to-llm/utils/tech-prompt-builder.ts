import * as path from 'node:path';
import * as vscode from 'vscode';

import { type LlmCopypasterConfig, type PromptInstructionsConfig } from '../../../config-service';
import { FilePayloadOperationType } from '../../../types/files-payload';
import { MustacheRenderer } from './mustache-renderer';

export class TechPromptBuilder {
  private readonly _mustacheRenderer: MustacheRenderer;

  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _config: LlmCopypasterConfig
  ) {
    this._mustacheRenderer = new MustacheRenderer(this._buildPlaceholderRegexPattern());
  }

  public async build(): Promise<string> {
    const promptInstructionConfig = this._config.baseSettings.promptInstructionConfig;
    const subInstructionsById = promptInstructionConfig.subInstructionsById ?? {};
    const promptIdsInConfig = Object.keys(subInstructionsById);

    if (promptIdsInConfig.length === 0) return '';

    const builtPrompts: string[] = [];
    const renderConstantsById = this._buildRenderConstantsById();

    for (const promptId of promptIdsInConfig) {
      const promptInstructionsConfig = subInstructionsById[promptId];
      if (!promptInstructionsConfig) continue;

      const builtPromptText = await this._tryBuildPromptText({
        promptId,
        promptInstructionsConfig,
        renderConstantsById,
      });

      if (!builtPromptText) continue;

      builtPrompts.push(builtPromptText);
    }

    if (builtPrompts.length === 0) return '';

    const delimiterLine = `\n${this._config.llmToIdeParsingAnchors.techPromptDelimiter}\n`;

    return builtPrompts.join(delimiterLine);
  }

  private async _tryBuildPromptText(args: {
    promptId: string;
    promptInstructionsConfig: PromptInstructionsConfig;
    renderConstantsById: Record<string, string>;
  }): Promise<string | null> {
    if (args.promptInstructionsConfig.ignore) return null;

    const promptText = await this._tryReadPromptText(args.promptInstructionsConfig, args.promptId);
    if (!promptText) return null;

    let nextPromptText = promptText;

    nextPromptText = this._renderConstants(nextPromptText, args.renderConstantsById);

    // Expressions are not evaluated; we render conditionals by explicit boolean map from builder-context
    nextPromptText = this._mustacheRenderer.renderIfBlocks(nextPromptText, {});

    if (!nextPromptText.trim()) return null;

    return nextPromptText;
  }

  private _renderConstants(promptText: string, constantsById: Record<string, string>): string {
    let nextPromptText = promptText;

    for (const [placeholderKey, placeholderValue] of Object.entries(constantsById ?? {})) {
      nextPromptText = this._mustacheRenderer.renderConstant(nextPromptText, placeholderKey, placeholderValue);
    }

    return nextPromptText;
  }

  private _buildRenderConstantsById(): Record<string, string> {
    const sharedVariablesById = this._config.baseSettings.promptInstructionConfig.sharedVariablesById ?? {};

    return {
      ...sharedVariablesById,

      // LLM-to-IDE parsing anchors (commonly needed by prompt-instructions)
      techPromptDelimiter: this._config.llmToIdeParsingAnchors.techPromptDelimiter,
      codeListingHeaderStartFragment: this._getCodeListingHeaderStartFragmentWithSpace(),
      fileStatusPrefix: this._config.llmToIdeParsingAnchors.fileStatusPrefix,
      placeholderStartFragment: this._config.llmToIdeParsingAnchors.placeholderStartFragment,
      placeholderEndFragment: this._config.llmToIdeParsingAnchors.placeholderEndFragment,

      // File payload operation types
      filePayloadOperationTypeEditedFull: FilePayloadOperationType.EditedFull,
      filePayloadOperationTypeCreated: FilePayloadOperationType.Created,
      filePayloadOperationTypeDeleted: FilePayloadOperationType.Deleted,
    };
  }

  private async _tryReadPromptText(
    promptInstructionsConfig: PromptInstructionsConfig,
    promptId: string
  ): Promise<string | null> {
    const promptUri = this._tryBuildPromptUri(promptInstructionsConfig);

    if (!promptUri) {
      this._showPromptReadWarning(promptInstructionsConfig, promptId, 'Workspace folder not found');
      return null;
    }

    try {
      const bytes = await vscode.workspace.fs.readFile(promptUri);

      return Buffer.from(bytes).toString('utf8');
    } catch (error: unknown) {
      this._showPromptReadWarning(promptInstructionsConfig, promptId, error, promptUri);
      return null;
    }
  }

  private _tryBuildPromptUri(promptInstructionsConfig: PromptInstructionsConfig): vscode.Uri | null {
    const rawPath = promptInstructionsConfig.relativePathToSubInstruction;

    if (rawPath.startsWith('file:')) return vscode.Uri.parse(rawPath); // support file:// URI values (not raw OS paths)
    if (path.isAbsolute(rawPath)) return vscode.Uri.file(rawPath);

    return promptInstructionsConfig.isSystemBundledFile
      ? vscode.Uri.joinPath(this._extensionContext.extensionUri, rawPath)
      : this._tryBuildWorkspacePromptUri(rawPath);
  }

  private _showPromptReadWarning(
    promptInstructionsConfig: PromptInstructionsConfig,
    promptId: string,
    errorOrMessage: unknown,
    promptUri?: vscode.Uri
  ): void {
    const source = promptInstructionsConfig.isSystemBundledFile ? 'extension' : 'workspace';

    let errorText = '';

    if (typeof errorOrMessage === 'string') errorText = errorOrMessage;
    else if (errorOrMessage instanceof Error) errorText = errorOrMessage.message || errorOrMessage.name;
    else if (errorOrMessage) errorText = String(errorOrMessage);
    else errorText = 'Unknown error';

    vscode.window.showWarningMessage(
      `Prompt file not found or unreadable: id="${promptId}", source="${source}", error="${errorText}"`
    );
  }

  private _tryBuildWorkspacePromptUri(relativePathToSubInstruction: string): vscode.Uri | null {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return null;

    return vscode.Uri.joinPath(workspaceFolder.uri, relativePathToSubInstruction);
  }

  private _getCodeListingHeaderStartFragmentWithSpace(): string {
    return this._config.llmToIdeParsingAnchors.codeListingHeaderStartFragment + ' ';
  }

  private _buildPlaceholderRegexPattern(): string {
    const placeholderStartFragment = this._escapeRegExp(this._config.llmToIdeParsingAnchors.placeholderStartFragment);
    const placeholderEndFragment = this._escapeRegExp(this._config.llmToIdeParsingAnchors.placeholderEndFragment);

    return String.raw`${placeholderStartFragment}([a-zA-Z0-9*_]+)${placeholderEndFragment}`;
  }

  private _escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[]]/g, '$&');
  }
}
