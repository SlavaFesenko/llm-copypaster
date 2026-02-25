import * as vscode from 'vscode';

import type { LlmCopypasterConfig, LlmCopypasterTechPromptBuilderDetails } from '../../../config';
import { buildDefaultConfig } from '../../../config';

export async function getTechPrompt(
  extensionContext: vscode.ExtensionContext,
  config?: LlmCopypasterConfig
): Promise<string> {
  const resolvedConfig = config ?? buildDefaultConfig();

  const promptBuilderDetailsList = resolvedConfig.techPromptBuilders;

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

  const delimiterLine = `\n${resolvedConfig.techPromptDelimiter}\n`;

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
  promptBuilderDetails: LlmCopypasterTechPromptBuilderDetails
): string {
  const promptBuilderHandlerById = _buildPromptBuilderHandlerById(config);

  const promptBuilderHandler = promptBuilderHandlerById[promptBuilderDetails.builderHandlerId];

  if (!promptBuilderHandler) return _buildGenericPrompt(promptText, config, promptBuilderDetails);

  return promptBuilderHandler(promptText, promptBuilderDetails);
}

function _buildPromptBuilderHandlerById(
  config: LlmCopypasterConfig
): Record<string, (promptText: string, promptBuilderDetails: LlmCopypasterTechPromptBuilderDetails) => string> {
  return {
    llmResponseRules: (promptText, promptBuilderDetails) =>
      _buildLlmResponseRulesPrompt(promptText, config, promptBuilderDetails),
    webGitPrompt: (promptText, promptBuilderDetails) => _buildWebGitPrompt(promptText, config, promptBuilderDetails),
  };
}

function _buildLlmResponseRulesPrompt(
  promptText: string,
  config: LlmCopypasterConfig,
  promptBuilderDetails: LlmCopypasterTechPromptBuilderDetails
): string {
  const placeholderValuesByKey = _buildCommonPlaceholderValuesByKey(config, promptBuilderDetails);

  return _replaceMustacheLikePlaceholders(promptText, placeholderValuesByKey);
}

function _buildWebGitPrompt(
  promptText: string,
  config: LlmCopypasterConfig,
  promptBuilderDetails: LlmCopypasterTechPromptBuilderDetails
): string {
  const placeholderValuesByKey = _buildCommonPlaceholderValuesByKey(config, promptBuilderDetails);

  return _replaceMustacheLikePlaceholders(promptText, placeholderValuesByKey);
}

function _buildGenericPrompt(
  promptText: string,
  config: LlmCopypasterConfig,
  promptBuilderDetails: LlmCopypasterTechPromptBuilderDetails
): string {
  const placeholderValuesByKey = _buildCommonPlaceholderValuesByKey(config, promptBuilderDetails);

  return _replaceMustacheLikePlaceholders(promptText, placeholderValuesByKey);
}

function _buildCommonPlaceholderValuesByKey(
  config: LlmCopypasterConfig,
  _promptBuilderDetails: LlmCopypasterTechPromptBuilderDetails
): Record<string, string> {
  return {
    codeListingHeaderStartFragment: config.codeListingHeaderStartFragment,
    techPromptDelimiter: config.techPromptDelimiter,
    codeListingHeaderRegex: config.codeListingHeaderRegex,
  };
}

function _replaceMustacheLikePlaceholders(promptText: string, placeholderValuesByKey: Record<string, string>): string {
  const placeholderRegex = /{{([a-zA-Z0-9*]+)}}/g;

  return promptText.replace(placeholderRegex, (fullMatch, key: string) => {
    const placeholderValue = placeholderValuesByKey[key];

    if (placeholderValue === undefined) return fullMatch;

    return placeholderValue;
  });
}
