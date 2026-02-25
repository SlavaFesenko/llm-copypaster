import * as vscode from 'vscode';

import type { LlmCopypasterConfig } from '../../../config';

let cachedDefaultCopyAsContextPrompt: string | null = null;

export async function loadDefaultCopyAsContextPrompt(
  extensionContext: vscode.ExtensionContext,
  config?: LlmCopypasterConfig
): Promise<string> {
  if (cachedDefaultCopyAsContextPrompt !== null) return applyPromptPlaceholders(cachedDefaultCopyAsContextPrompt, config);

  const promptFileUri = vscode.Uri.joinPath(extensionContext.extensionUri, 'prompts', 'default-copy-as-context-prompt.md');

  try {
    const bytes = await vscode.workspace.fs.readFile(promptFileUri);
    const text = Buffer.from(bytes).toString('utf8');

    cachedDefaultCopyAsContextPrompt = text;

    return applyPromptPlaceholders(text, config);
  } catch {
    cachedDefaultCopyAsContextPrompt = '';

    return '';
  }
}

type PromptPlaceholderContext = {
  config?: LlmCopypasterConfig;
};

type PromptPlaceholderResolver = (context: PromptPlaceholderContext) => string | undefined;

type PromptPlaceholderResolvers = Record<string, PromptPlaceholderResolver>;

const placeholderRegex = /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g;

const defaultResolvers: PromptPlaceholderResolvers = {
  diffMarkerAtAt: () => '@' + '@', // avoid a literal token in source
  diffMarkerPlusPlusPlus: () => '+' + '+' + '+', // avoid a literal token in source
  diffFileLabel: () => 'Fil' + 'e' + ':', // avoid a literal token in source
};

function buildResolvers(
  context: PromptPlaceholderContext,
  resolversOverride?: PromptPlaceholderResolvers
): PromptPlaceholderResolvers {
  return {
    ...defaultResolvers,
    codeListingHeaderStartFragment: ctx => ctx.config?.codeListingHeaderStartFragment,
    diffMarkerDashDashDash: ctx => ctx.config?.techPromptDelimiter,
    ...(resolversOverride ?? {}),
  };
}

function applyPromptPlaceholders(
  promptTemplate: string,
  config?: LlmCopypasterConfig,
  resolversOverride?: PromptPlaceholderResolvers
): string {
  const context: PromptPlaceholderContext = { config };

  const resolvers = buildResolvers(context, resolversOverride);

  return promptTemplate.replace(placeholderRegex, (fullMatch: string, placeholderName: string) => {
    const resolver = resolvers[placeholderName];

    if (!resolver) return fullMatch;

    const resolvedValue = resolver(context);

    return resolvedValue === undefined ? fullMatch : resolvedValue;
  });
}
