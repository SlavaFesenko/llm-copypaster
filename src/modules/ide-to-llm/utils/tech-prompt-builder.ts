import * as vscode from 'vscode';

import type { LlmCopypasterConfig, TechPromptBuilderDetails } from '../../../config';
import { buildDefaultConfig } from '../../../config';

export async function getTechPrompt(
  extensionContext: vscode.ExtensionContext,
  config?: LlmCopypasterConfig
): Promise<string> {
  const resolvedConfig = config ?? buildDefaultConfig();

  const techPromptConfig = resolvedConfig.techPrompt;

  const promptBuilderDetailsList = techPromptConfig.builders;

  const builtPrompts: string[] = [];

  for (const promptBuilderDetails of promptBuilderDetailsList) {
    if (!promptBuilderDetails.promptConcatenationEnabled) continue;

    const promptText = await _tryReadPromptText(extensionContext, promptBuilderDetails.relativePathToPrompt);

    if (!promptText) continue;

    const processedPromptText = _processPromptTextByBuilderHandlerId(promptText, resolvedConfig, promptBuilderDetails);

    if (!processedPromptText.trim()) continue;

    builtPrompts.push(processedPromptText);
  }

  if (builtPrompts.length === 0) return '';

  const delimiterLine = `\n${techPromptConfig.techPromptDelimiter}\n`;

  return builtPrompts.join(delimiterLine);
}

async function _tryReadPromptText(
  extensionContext: vscode.ExtensionContext,
  relativePathToPrompt: string
): Promise<string | null> {
  const promptUri = vscode.Uri.joinPath(extensionContext.extensionUri, relativePathToPrompt);

  try {
    const bytes = await vscode.workspace.fs.readFile(promptUri);

    return Buffer.from(bytes).toString('utf8');
  } catch {
    return null;
  }
}

function _processPromptTextByBuilderHandlerId(
  promptText: string,
  config: LlmCopypasterConfig,
  promptBuilderDetails: TechPromptBuilderDetails
): string {
  const promptBuilderHandlerById = _buildPromptBuilderHandlerById(config);

  const promptBuilderHandler = promptBuilderHandlerById[promptBuilderDetails.builderHandlerId];

  if (!promptBuilderHandler) return _buildGenericPrompt(promptText, config, promptBuilderDetails);

  return promptBuilderHandler(promptText, promptBuilderDetails);
}

function _buildPromptBuilderHandlerById(
  config: LlmCopypasterConfig
): Record<string, (promptText: string, promptBuilderDetails: TechPromptBuilderDetails) => string> {
  return {
    llmResponseRules: (promptText, promptBuilderDetails) =>
      _buildLlmResponseRulesPrompt(promptText, config, promptBuilderDetails),
    webGitPrompt: (promptText, promptBuilderDetails) => _buildWebGitPrompt(promptText, config, promptBuilderDetails),
  };
}

function _buildLlmResponseRulesPrompt(
  promptText: string,
  config: LlmCopypasterConfig,
  _promptBuilderDetails: TechPromptBuilderDetails
): string {
  const placeholderRegexPattern = config.techPrompt.placeholderRegexPattern;

  let nextPromptText = promptText;

  nextPromptText = _replacePlaceholdersWithData(
    nextPromptText,
    'codeListingHeaderStartFragment',
    config.codeListingHeaderStartFragment,
    placeholderRegexPattern
  );

  nextPromptText = _replacePlaceholdersWithData(
    nextPromptText,
    'codeListingHeaderRegex',
    config.codeListingHeaderRegex,
    placeholderRegexPattern
  );

  return nextPromptText;
}

function _buildWebGitPrompt(
  promptText: string,
  config: LlmCopypasterConfig,
  _promptBuilderDetails: TechPromptBuilderDetails
): string {
  const placeholderRegexPattern = config.techPrompt.placeholderRegexPattern;

  let nextPromptText = promptText;

  nextPromptText = _replacePlaceholdersWithData(
    nextPromptText,
    'codeListingHeaderStartFragment',
    config.codeListingHeaderStartFragment,
    placeholderRegexPattern
  );

  nextPromptText = _replacePlaceholdersWithData(
    nextPromptText,
    'codeListingHeaderRegex',
    config.codeListingHeaderRegex,
    placeholderRegexPattern
  );

  return nextPromptText;
}

function _buildGenericPrompt(
  promptText: string,
  config: LlmCopypasterConfig,
  _promptBuilderDetails: TechPromptBuilderDetails
): string {
  const placeholderRegexPattern = config.techPrompt.placeholderRegexPattern;

  let nextPromptText = promptText;

  nextPromptText = _replacePlaceholdersWithData(
    nextPromptText,
    'codeListingHeaderStartFragment',
    config.codeListingHeaderStartFragment,
    placeholderRegexPattern
  );

  nextPromptText = _replacePlaceholdersWithData(
    nextPromptText,
    'codeListingHeaderRegex',
    config.codeListingHeaderRegex,
    placeholderRegexPattern
  );

  return nextPromptText;
}

function _replacePlaceholdersWithData(
  promptText: string,
  placeholderKey: string,
  placeholderValue: string,
  placeholderRegexPattern: string
): string {
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
