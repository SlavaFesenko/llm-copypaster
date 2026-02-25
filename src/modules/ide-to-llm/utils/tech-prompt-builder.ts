import * as vscode from 'vscode';

import {
  LLM_RESPONSE_RULES_PROMPT_ID,
  WEB_GIT_PROMPT_ID,
  type LlmCopypasterConfig,
  type TechPromptBuilderDetails,
} from '../../../config';

export class BuilderTechPrompt {
  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _config: LlmCopypasterConfig
  ) {}

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
    if (!promptBuilderDetails.promptConcatenationEnabled) return null;

    const promptText = await this._tryReadPromptText(promptBuilderDetails.relativePathToPrompt);
    if (!promptText) return null;

    let nextPromptText = promptText;

    nextPromptText = this._replacePlaceholdersWithData(
      nextPromptText,
      'codeListingHeaderStartFragment',
      this._config.codeListingHeaderStartFragment
    );

    if (!nextPromptText.trim()) return null;

    return nextPromptText;
  }

  private async _buildWebGitPrompt(): Promise<string | null> {
    const promptBuilderDetails = this._tryFindTechPromptBuilderDetailsById(WEB_GIT_PROMPT_ID);
    if (!promptBuilderDetails) return null;
    if (!promptBuilderDetails.promptConcatenationEnabled) return null;

    const promptText = await this._tryReadPromptText(promptBuilderDetails.relativePathToPrompt);
    if (!promptText) return null;

    let nextPromptText = promptText;

    // TO~DO: implement when needed
    // nextPromptText = this._replacePlaceholdersWithData(
    //   nextPromptText,
    //   'codeListingHeaderStartFragment',
    //   this._config.codeListingHeaderStartFragment
    // );

    if (!nextPromptText.trim()) return null;

    return nextPromptText;
  }

  private _tryFindTechPromptBuilderDetailsById(techPromptBuilderDetailsId: string): TechPromptBuilderDetails | null {
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
