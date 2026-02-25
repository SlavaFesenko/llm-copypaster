import * as vscode from 'vscode';

import type { LlmCopypasterConfig, TechPromptBuilderDetails } from '../../../config';

const TECH_PROMPT_BUILDER_DETAILS_ID_LLM_RESPONSE_RULES = 'llm-response-rules';
const TECH_PROMPT_BUILDER_DETAILS_ID_WEB_GIT_PROMPT = 'web-git-prompt';

export class BuilderTechPrompt {
  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _config: LlmCopypasterConfig
  ) {}

  public async build(): Promise<string> {
    const techPromptConfig = this._config.techPrompt;

    const builtPrompts: string[] = [];

    const llmResponseRulesPromptBuilderDetails = this._tryFindTechPromptBuilderDetailsById(
      techPromptConfig.builders,
      TECH_PROMPT_BUILDER_DETAILS_ID_LLM_RESPONSE_RULES
    );

    const llmResponseRulesPrompt = await this._tryBuildPromptByDetails(llmResponseRulesPromptBuilderDetails, promptText =>
      this._buildLlmResponseRulesPrompt(promptText, llmResponseRulesPromptBuilderDetails)
    );

    if (llmResponseRulesPrompt) builtPrompts.push(llmResponseRulesPrompt);

    const webGitPromptBuilderDetails = this._tryFindTechPromptBuilderDetailsById(
      techPromptConfig.builders,
      TECH_PROMPT_BUILDER_DETAILS_ID_WEB_GIT_PROMPT
    );

    const webGitPrompt = await this._tryBuildPromptByDetails(webGitPromptBuilderDetails, promptText =>
      this._buildWebGitPrompt(promptText, webGitPromptBuilderDetails)
    );

    if (webGitPrompt) builtPrompts.push(webGitPrompt);

    if (builtPrompts.length === 0) return '';

    const delimiterLine = `\n${techPromptConfig.techPromptDelimiter}\n`;

    return builtPrompts.join(delimiterLine);
  }

  private _tryFindTechPromptBuilderDetailsById(
    techPromptBuilderDetailsList: TechPromptBuilderDetails[],
    techPromptBuilderDetailsId: string
  ): TechPromptBuilderDetails | null {
    const foundTechPromptBuilderDetails = techPromptBuilderDetailsList.find(
      techPromptBuilderDetails => techPromptBuilderDetails.id === techPromptBuilderDetailsId
    );

    if (!foundTechPromptBuilderDetails) return null;

    return foundTechPromptBuilderDetails;
  }

  private async _tryBuildPromptByDetails(
    techPromptBuilderDetails: TechPromptBuilderDetails | null,
    buildPromptText: (promptText: string) => string
  ): Promise<string | null> {
    if (!techPromptBuilderDetails) return null;

    if (!techPromptBuilderDetails.promptConcatenationEnabled) return null;

    const promptText = await this._tryReadPromptText(techPromptBuilderDetails.relativePathToPrompt);

    if (!promptText) return null;

    const processedPromptText = buildPromptText(promptText);

    if (!processedPromptText.trim()) return null;

    return processedPromptText;
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

  private _buildLlmResponseRulesPrompt(promptText: string, promptBuilderDetails: TechPromptBuilderDetails | null): string {
    if (!promptBuilderDetails) return '';

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

  private _buildWebGitPrompt(promptText: string, promptBuilderDetails: TechPromptBuilderDetails | null): string {
    if (!promptBuilderDetails) return '';

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
