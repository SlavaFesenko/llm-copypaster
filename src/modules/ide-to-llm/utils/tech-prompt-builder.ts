import * as vscode from 'vscode';

import { type LlmCopypasterConfig, type PromptInstructionsConfig } from '../../../config-service';
import { FilePayloadOperationType } from '../../../types/files-payload';
import { MustacheRenderer } from './mustache-renderer';

export const LLM_RESPONSE_RULES_PROMPT_ID = 'llm-response-rules';
export const WEB_GIT_PROMPT_ID = 'web-git-prompt';

export class TechPromptBuilder {
  private readonly _mustacheRenderer: MustacheRenderer;

  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _config: LlmCopypasterConfig
  ) {
    this._mustacheRenderer = new MustacheRenderer(this._config.techPrompt.placeholderRegexPattern);
  }

  public async build(): Promise<string> {
    const techPromptConfig = this._config.techPrompt;
    const builtPrompts: string[] = [];

    const llmResponseRulesPrompt = await this._buildLlmResponseRulesPrompt();
    if (llmResponseRulesPrompt) builtPrompts.push(llmResponseRulesPrompt);

    const webGitPrompt = await this._buildWebGitPrompt();
    if (webGitPrompt) builtPrompts.push(webGitPrompt);

    if (builtPrompts.length === 0) return '';

    const delimiterLine = `\n${techPromptConfig.techPromptDelimiter}\n`;

    return builtPrompts.join(delimiterLine);
  }

  private async _buildLlmResponseRulesPrompt(): Promise<string | null> {
    const promptBuilderDetails = this._tryFindTechPromptBuilderDetailsById(LLM_RESPONSE_RULES_PROMPT_ID);
    if (!promptBuilderDetails) return null;
    if (!promptBuilderDetails.skipSubInstruction) return null;

    const promptText = await this._tryReadPromptText(promptBuilderDetails.relativePathToSubInstruction);
    if (!promptText) return null;

    const webGitPromptConcatenationEnabled = this._tryResolveWebGitPromptConcatenationEnabled();

    let nextPromptText = promptText;

    nextPromptText = this._mustacheRenderer.renderConstant(
      nextPromptText,
      'codeListingHeaderStartFragment',
      this._config.codeListingHeaderStartFragmentWithSpace
    );

    nextPromptText = this._mustacheRenderer.renderConstant(
      nextPromptText,
      'fileStatusPrefix',
      this._config.techPrompt.fileStatusPrefix
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
    const promptBuilderDetails = this._tryFindTechPromptBuilderDetailsById(WEB_GIT_PROMPT_ID);
    if (!promptBuilderDetails) return null;
    if (!promptBuilderDetails.skipSubInstruction) return null;

    const promptText = await this._tryReadPromptText(promptBuilderDetails.relativePathToSubInstruction);
    if (!promptText) return null;

    let nextPromptText = promptText;

    const constants = promptBuilderDetails.constants ?? {};

    for (const [placeholderKey, placeholderValue] of Object.entries(constants)) {
      nextPromptText = this._mustacheRenderer.renderConstant(nextPromptText, placeholderKey, placeholderValue);
    }

    if (!nextPromptText.trim()) return null;

    return nextPromptText;
  }

  private _tryResolveWebGitPromptConcatenationEnabled(): boolean {
    const webGitPromptBuilderDetails = this._tryFindTechPromptBuilderDetailsById(WEB_GIT_PROMPT_ID);
    return webGitPromptBuilderDetails?.skipSubInstruction ?? false;
  }

  private _tryFindTechPromptBuilderDetailsById(techPromptBuilderDetailsId: string): PromptInstructionsConfig | null {
    const techPromptBuilderDetailsList = this._config.techPrompt.builders;

    const foundTechPromptBuilderDetails = techPromptBuilderDetailsList.find(
      techPromptBuilderDetails => techPromptBuilderDetails.id === techPromptBuilderDetailsId
    );

    if (!foundTechPromptBuilderDetails) return null;

    return foundTechPromptBuilderDetails;
  }

  private async _tryReadPromptText(relativePathToPrompt: string): Promise<string | null> {
    const promptUri = vscode.Uri.joinPath(this._extensionContext.extensionUri, relativePathToPrompt);

    try {
      const bytes = await vscode.workspace.fs.readFile(promptUri);

      return Buffer.from(bytes).toString('utf8');
    } catch {
      return null;
    }
  }
}
