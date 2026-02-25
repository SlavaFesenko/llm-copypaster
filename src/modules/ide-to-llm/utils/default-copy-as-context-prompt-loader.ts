import * as vscode from 'vscode';

import type { LlmCopypasterConfig } from '../../../config';

let cachedDefaultCopyAsContextPrompt: string | null = null;

export async function loadDefaultCopyAsContextPrompt(
  extensionContext: vscode.ExtensionContext,
  config?: LlmCopypasterConfig
): Promise<string> {
  if (cachedDefaultCopyAsContextPrompt !== null) {
    return applyPromptPlaceholders(cachedDefaultCopyAsContextPrompt, { config: config ?? null });
  }

  const promptFileUri = vscode.Uri.joinPath(extensionContext.extensionUri, 'prompts', 'default-copy-as-context-prompt.md');

  try {
    const bytes = await vscode.workspace.fs.readFile(promptFileUri);
    const text = Buffer.from(bytes).toString('utf8');

    cachedDefaultCopyAsContextPrompt = text;

    return applyPromptPlaceholders(text, { config: config ?? null });
  } catch {
    cachedDefaultCopyAsContextPrompt = '';

    return '';
  }
}

interface PromptPlaceholderContext {
  config: LlmCopypasterConfig | null;
}

type PromptPlaceholderResolver = (context: PromptPlaceholderContext) => string | null;

interface PromptPlaceholderResolversMap {
  [placeholderName: string]: PromptPlaceholderResolver;
}

interface ApplyPromptPlaceholdersOptions {
  resolvers?: PromptPlaceholderResolversMap;
}

const placeholderRegex = /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g;

function buildDefaultPromptPlaceholderResolvers(): PromptPlaceholderResolversMap {
  return {
    diffMarkerAtAt: () => '@' + '@', // avoid a literal token in source
    diffMarkerPlusPlusPlus: () => '+' + '+' + '+', // avoid a literal token in source
    diffFileLabel: () => 'Fil' + 'e' + ':', // avoid a literal token in source
  };
}

function buildConfigPromptPlaceholderResolvers(): PromptPlaceholderResolversMap {
  return {
    codeListingHeaderStartFragment: context => context.config?.codeListingHeaderStartFragment ?? null,
    diffMarkerDashDashDash: context => context.config?.techPromptDelimiter ?? null,
  };
}

function buildPromptPlaceholderResolvers(context: PromptPlaceholderContext): PromptPlaceholderResolversMap {
  return {
    ...buildDefaultPromptPlaceholderResolvers(),
    ...buildConfigPromptPlaceholderResolvers(),
  };
}

function applyPromptPlaceholders(
  promptTemplate: string,
  context: PromptPlaceholderContext,
  options?: ApplyPromptPlaceholdersOptions
): string {
  const resolvers = options?.resolvers ?? buildPromptPlaceholderResolvers(context);

  const replaced = promptTemplate.replace(placeholderRegex, (fullMatch: string, placeholderName: string) => {
    const resolver = resolvers[placeholderName];

    if (!resolver) return fullMatch;

    const resolvedValue = resolver(context);

    if (resolvedValue === null) return fullMatch;

    return resolvedValue;
  });

  return replaced;
}
