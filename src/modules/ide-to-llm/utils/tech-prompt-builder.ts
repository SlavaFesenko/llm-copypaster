import * as vscode from 'vscode';

import type {
  LlmCopypasterConfig,
  LlmCopypasterTechPromptBuilderDetails,
  LlmCopypasterTechPromptBuilderOverrides,
} from '../../../config';
import { buildDefaultConfig } from '../../../config';

const LLM_RESPONSE_RULES_PROMPT_ID = 'llm-response-rules';
const WEB_GIT_PROMPT_ID = 'web-git-prompt';

export async function getTechPrompt(
  extensionContext: vscode.ExtensionContext,
  config?: LlmCopypasterConfig
): Promise<string> {
  const resolvedConfig = config ?? buildDefaultConfig();

  const promptBuilderDetailsList = _resolvePromptBuilderDetailsList(resolvedConfig);

  const builtPrompts: string[] = [];

  for (const promptBuilderDetails of promptBuilderDetailsList) {
    if (!promptBuilderDetails.promptConcatenationEnabled) continue;

    const promptText = await _tryReadPromptText(extensionContext, promptBuilderDetails.relativePathToPrompt);

    if (!promptText) continue;

    const processedPromptText = await _processPromptTextByPromptId(
      promptBuilderDetails.id,
      promptText,
      resolvedConfig,
      promptBuilderDetails
    );

    if (!processedPromptText.trim()) continue;

    builtPrompts.push(processedPromptText);
  }

  if (builtPrompts.length === 0) return '';

  const delimiterLine = `\n${resolvedConfig.techPromptDelimiter}\n`;

  return builtPrompts.join(delimiterLine);
}

function _resolvePromptBuilderDetailsList(config: LlmCopypasterConfig): LlmCopypasterTechPromptBuilderDetails[] {
  const basePromptBuilderDetailsList = config.techPromptBuilders;

  const promptBuilderOverridesById = config.techPromptBuildersOverrides ?? {};

  if (Object.keys(promptBuilderOverridesById).length === 0) return basePromptBuilderDetailsList;

  return basePromptBuilderDetailsList.map(promptBuilderDetails => {
    const promptBuilderOverrides = promptBuilderOverridesById[promptBuilderDetails.id];

    if (!promptBuilderOverrides) return promptBuilderDetails;

    return {
      ...promptBuilderDetails,
      ...promptBuilderOverrides,
    };
  });
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

async function _processPromptTextByPromptId(
  promptId: string,
  promptText: string,
  config: LlmCopypasterConfig,
  promptBuilderDetails: LlmCopypasterTechPromptBuilderDetails
): Promise<string> {
  if (promptId === LLM_RESPONSE_RULES_PROMPT_ID)
    return _buildLlmResponseRulesPrompt(promptText, config, promptBuilderDetails);
  if (promptId === WEB_GIT_PROMPT_ID) return _buildWebGitPrompt(promptText, config, promptBuilderDetails);

  return _buildGenericPrompt(promptText, config, promptBuilderDetails);
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

export type { LlmCopypasterTechPromptBuilderOverrides };
