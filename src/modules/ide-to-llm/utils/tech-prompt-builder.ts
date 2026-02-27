import * as vscode from 'vscode';

import { type LlmCopypasterConfig, type PromptInstructionsConfig } from '../../../config-service';
import { FilePayloadOperationType } from '../../../types/files-payload';
import { MustacheRenderer } from './mustache-renderer';

export const LLM_RESPONSE_RULES_PROMPT_ID = 'llm-response-rules-prompt';
export const WEB_GIT_PROMPT_ID = 'web-git-prompt';

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
    const builtPrompts: string[] = [];

    const llmResponseRulesPrompt = await this._buildLlmResponseRulesPrompt();
    if (llmResponseRulesPrompt) builtPrompts.push(llmResponseRulesPrompt);

    const webGitPrompt = await this._buildWebGitPrompt();
    if (webGitPrompt) builtPrompts.push(webGitPrompt);

    const otherPromptIds = Object.keys(subInstructionsById).filter(
      promptId => promptId !== LLM_RESPONSE_RULES_PROMPT_ID && promptId !== WEB_GIT_PROMPT_ID
    );

    for (const promptId of otherPromptIds) {
      const otherPromptText = await this._buildGenericPrompt(promptId);
      if (otherPromptText) builtPrompts.push(otherPromptText);
    }

    if (builtPrompts.length === 0) return '';

    const delimiterLine = `\n${this._config.llmToIdeParsingAnchors.techPromptDelimiter}\n`;

    return builtPrompts.join(delimiterLine);
  }

  private async _buildLlmResponseRulesPrompt(): Promise<string | null> {
    const promptInstructionsConfig = this._tryFindPromptInstructionsConfigById(LLM_RESPONSE_RULES_PROMPT_ID);
    if (!promptInstructionsConfig) return null;
    if (promptInstructionsConfig.ignore) return null;

    const promptText = await this._tryReadPromptText(promptInstructionsConfig, LLM_RESPONSE_RULES_PROMPT_ID);
    if (!promptText) return null;

    const webGitPromptConcatenationEnabled = this._tryResolveWebGitPromptConcatenationEnabled();

    let nextPromptText = promptText;

    nextPromptText = this._renderSharedVariables(nextPromptText);

    nextPromptText = this._mustacheRenderer.renderConstant(
      nextPromptText,
      'codeListingHeaderStartFragment',
      this._getCodeListingHeaderStartFragmentWithSpace()
    );

    nextPromptText = this._mustacheRenderer.renderConstant(
      nextPromptText,
      'fileStatusPrefix',
      this._config.llmToIdeParsingAnchors.fileStatusPrefix
    );

    nextPromptText = this._mustacheRenderer.renderConstant(
      nextPromptText,
      'filePayloadOperationTypeEditedFull',
      FilePayloadOperationType.EditedFull
    );

    nextPromptText = this._mustacheRenderer.renderConstant(
      nextPromptText,
      'filePayloadOperationTypeCreated',
      FilePayloadOperationType.Created
    );

    nextPromptText = this._mustacheRenderer.renderConstant(
      nextPromptText,
      'filePayloadOperationTypeDeleted',
      FilePayloadOperationType.Deleted
    );

    nextPromptText = this._mustacheRenderer.renderIf(
      nextPromptText,
      'webGitPromptConcatenationEnabled',
      webGitPromptConcatenationEnabled
    );

    if (!nextPromptText.trim()) return null;

    return nextPromptText;
  }

  private async _buildWebGitPrompt(): Promise<string | null> {
    const promptInstructionsConfig = this._tryFindPromptInstructionsConfigById(WEB_GIT_PROMPT_ID);
    if (!promptInstructionsConfig) return null;
    if (promptInstructionsConfig.ignore) return null;

    const promptText = await this._tryReadPromptText(promptInstructionsConfig, WEB_GIT_PROMPT_ID);
    if (!promptText) return null;

    let nextPromptText = promptText;

    nextPromptText = this._renderSharedVariables(nextPromptText);

    if (!nextPromptText.trim()) return null;

    return nextPromptText;
  }

  private async _buildGenericPrompt(promptId: string): Promise<string | null> {
    const promptInstructionsConfig = this._tryFindPromptInstructionsConfigById(promptId);
    if (!promptInstructionsConfig) return null;
    if (promptInstructionsConfig.ignore) return null;

    const promptText = await this._tryReadPromptText(promptInstructionsConfig, promptId);
    if (!promptText) return null;

    const nextPromptText = this._renderSharedVariables(promptText);

    if (!nextPromptText.trim()) return null;

    return nextPromptText;
  }

  private _renderSharedVariables(promptText: string): string {
    const sharedVariablesById = this._config.baseSettings.promptInstructionConfig.sharedVariablesById ?? {};
    let nextPromptText = promptText;

    for (const [placeholderKey, placeholderValue] of Object.entries(sharedVariablesById)) {
      nextPromptText = this._mustacheRenderer.renderConstant(nextPromptText, placeholderKey, placeholderValue);
    }

    return nextPromptText;
  }

  private _tryResolveWebGitPromptConcatenationEnabled(): boolean {
    const webGitPromptInstructionsConfig = this._tryFindPromptInstructionsConfigById(WEB_GIT_PROMPT_ID);
    return !webGitPromptInstructionsConfig?.ignore;
  }

  private _tryFindPromptInstructionsConfigById(promptInstructionsConfigId: string): PromptInstructionsConfig | null {
    const subInstructionsById = this._config.baseSettings.promptInstructionConfig.subInstructionsById ?? {};
    const foundPromptInstructionsConfig = subInstructionsById[promptInstructionsConfigId];

    if (!foundPromptInstructionsConfig) return null;

    return foundPromptInstructionsConfig;
  }

  private async _tryReadPromptText(
    promptInstructionsConfig: PromptInstructionsConfig,
    promptId: string
  ): Promise<string | null> {
    const promptUri = promptInstructionsConfig.isSystemBundledFile
      ? vscode.Uri.joinPath(this._extensionContext.extensionUri, promptInstructionsConfig.relativePathToSubInstruction)
      : this._tryBuildWorkspacePromptUri(promptInstructionsConfig.relativePathToSubInstruction);

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
