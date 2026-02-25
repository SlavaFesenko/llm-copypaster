import * as vscode from 'vscode';

import type { LlmCopypasterConfig, TechPromptBuilderDetails } from '../../../config';

export class BuilderTechPrompt {
  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _config: LlmCopypasterConfig
  ) {}

  public async build(): Promise<string> {
    const techPromptConfig = this._config.techPrompt;

    const promptBuilderDetailsList = techPromptConfig.builders;

    const builtPrompts: string[] = [];

    for (const promptBuilderDetails of promptBuilderDetailsList) {
      if (!promptBuilderDetails.promptConcatenationEnabled) continue;

      const promptText = await this._tryReadPromptText(promptBuilderDetails.relativePathToPrompt);

      if (!promptText) continue;

      const processedPromptText = this._processPromptTextByBuilderHandlerId(promptText, promptBuilderDetails);

      if (!processedPromptText.trim()) continue;

      builtPrompts.push(processedPromptText);
    }

    if (builtPrompts.length === 0) return '';

    const delimiterLine = `\n${techPromptConfig.techPromptDelimiter}\n`;

    return builtPrompts.join(delimiterLine);
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

  private _processPromptTextByBuilderHandlerId(promptText: string, promptBuilderDetails: TechPromptBuilderDetails): string {
    const promptBuilderHandlerById = this._buildPromptBuilderHandlerById();

    const promptBuilderHandler = promptBuilderHandlerById[promptBuilderDetails.builderHandlerId];

    if (!promptBuilderHandler) return this._buildGenericPrompt(promptText);

    return promptBuilderHandler(promptText);
  }

  private _buildPromptBuilderHandlerById(): Record<string, (promptText: string) => string> {
    return {
      llmResponseRules: promptText => this._buildLlmResponseRulesPrompt(promptText),
      webGitPrompt: promptText => this._buildWebGitPrompt(promptText),
    };
  }

  private _buildLlmResponseRulesPrompt(promptText: string): string {
    let nextPromptText = promptText;

    nextPromptText = this._replacePlaceholdersWithData(
      nextPromptText,
      'codeListingHeaderStartFragment',
      this._config.codeListingHeaderStartFragment
    );

    nextPromptText = this._replacePlaceholdersWithData(
      nextPromptText,
      'codeListingHeaderRegex',
      this._config.codeListingHeaderRegex
    );

    return nextPromptText;
  }

  private _buildWebGitPrompt(promptText: string): string {
    let nextPromptText = promptText;

    nextPromptText = this._replacePlaceholdersWithData(
      nextPromptText,
      'codeListingHeaderStartFragment',
      this._config.codeListingHeaderStartFragment
    );

    nextPromptText = this._replacePlaceholdersWithData(
      nextPromptText,
      'codeListingHeaderRegex',
      this._config.codeListingHeaderRegex
    );

    return nextPromptText;
  }

  private _buildGenericPrompt(promptText: string): string {
    let nextPromptText = promptText;

    nextPromptText = this._replacePlaceholdersWithData(
      nextPromptText,
      'codeListingHeaderStartFragment',
      this._config.codeListingHeaderStartFragment
    );

    nextPromptText = this._replacePlaceholdersWithData(
      nextPromptText,
      'codeListingHeaderRegex',
      this._config.codeListingHeaderRegex
    );

    return nextPromptText;
  }

  private _replacePlaceholdersWithData(promptText: string, placeholderKey: string, placeholderValue: string): string {
    const placeholderRegexPattern = this._config.techPrompt.placeholderRegexPattern;

    let placeholderRegex: RegExp;

    try {
      placeholderRegex = new RegExp(placeholderRegexPattern, 'g');
    } catch {
      return promptText;
    }

    return promptText.replace(placeholderRegex, (fullMatch, foundPlaceholderKey: string) => {
      if (foundPlaceholderKey !== placeholderKey) return fullMatch;

      return placeholderValue;
    });
  }
}
