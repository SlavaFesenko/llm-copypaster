import * as path from 'node:path';
import * as vscode from 'vscode';

import { type LlmCopypasterConfig, type PromptInstructionsConfig } from '../../../config-service';
import { ConfigTreeValueResolver } from './config-tree-value-resolver';
import { MustacheRenderer } from './mustache-renderer';

// 'Supported Mustache-like syntax (NEW RULES):',
// '',
// '1) Prompt files can use ONLY shared variables:',
// '   - {{someSharedVariableId}}',
// '   - shared variables are taken from config: baseSettings.promptInstructionConfig.sharedVariablesById',
// '',
// '2) sharedVariablesById values can be computed from config via a special prefix:',
// '   - sharedVariablesById["SOME_VALUE"] = "{{LLM_CPP_CFG.some.path}}"',
// '   - LLM_CPP_CFG.* is supported ONLY inside sharedVariablesById values (not in prompt files)',
// '',
// '3) Conditional blocks in prompt files use ONLY shared variables:',
// '   - {{#if someSharedVariableId}} ... {{/if}}',
// '   - {{#if !someSharedVariableId}} ... {{/if}}',
// '   - {{#if !!!someSharedVariableId}} ... {{/if}}',
// '   - {{#if someSharedVariableId}} ... {{else}} ... {{/if}}',
// '   - {{#if someSharedVariableId}} ... {{else if otherSharedVariableId}} ... {{else}} ... {{/if}}',
// '   - Flags are coerced to boolean (true/false, 1/0, yes/no, on/off, non-empty strings)',
// '',
// 'Notes:',
// ' - Unknown/mismatched tags are kept unchanged',
// ' - renderIf/renderIfElse supports nested {{#if ...}} blocks',
export class TechPromptBuilder {
  private readonly _mustacheRenderer: MustacheRenderer;
  private readonly _configTreeValueResolver: ConfigTreeValueResolver;

  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _config: LlmCopypasterConfig
  ) {
    this._mustacheRenderer = new MustacheRenderer(this._buildPlaceholderRegexPattern());
    this._configTreeValueResolver = new ConfigTreeValueResolver(this._config);
  }

  public async build(): Promise<string> {
    const promptInstructionConfig = this._config.baseSettings.promptInstructionConfig;
    const subInstructionsById = promptInstructionConfig.subInstructionsById ?? {};
    const promptIdsInConfig = Object.keys(subInstructionsById);

    if (promptIdsInConfig.length === 0) return '';

    const builtPrompts: string[] = [];
    const resolvedSharedVariablesById = this._buildResolvedSharedVariablesById();

    for (const promptId of promptIdsInConfig) {
      const promptInstructionsConfig = subInstructionsById[promptId];
      if (!promptInstructionsConfig) continue;

      const builtPromptText = await this._tryBuildPromptText({
        promptId,
        promptInstructionsConfig,
        resolvedSharedVariablesById,
      });

      if (!builtPromptText) continue;

      builtPrompts.push(builtPromptText);
    }

    if (builtPrompts.length === 0) return '';

    const delimiterLine = `\n${this._config.llmToIdeParsingAnchors.techPromptDelimiter}\n`;

    return builtPrompts.join(delimiterLine);
  }

  private async _tryBuildPromptText(args: {
    promptId: string;
    promptInstructionsConfig: PromptInstructionsConfig;
    resolvedSharedVariablesById: Record<string, string>;
  }): Promise<string | null> {
    if (args.promptInstructionsConfig.ignore) return null;

    const promptText = await this._tryReadPromptText(args.promptInstructionsConfig, args.promptId);
    if (!promptText) return null;

    let nextPromptText = promptText;

    nextPromptText = this._renderPlaceholdersFromSharedVariablesOnly(nextPromptText, args.resolvedSharedVariablesById);

    const flagsById = this._buildIfFlagsById(nextPromptText, args.resolvedSharedVariablesById);
    nextPromptText = this._mustacheRenderer.renderIfBlocks(nextPromptText, flagsById);

    if (!nextPromptText.trim()) return null;

    return nextPromptText;
  }

  private _renderPlaceholdersFromSharedVariablesOnly(
    promptText: string,
    sharedVariablesById: Record<string, string>
  ): string {
    return this._mustacheRenderer.renderPlaceholders(promptText, placeholderKey => {
      const resolvedValue = sharedVariablesById?.[placeholderKey];
      if (resolvedValue === undefined) return null;

      return resolvedValue;
    });
  }

  private _buildIfFlagsById(promptText: string, sharedVariablesById: Record<string, string>): Record<string, boolean> {
    const flagsById: Record<string, boolean> = {};
    const ifFlagNames = this._extractIfFlagNames(promptText);

    for (const ifFlagName of ifFlagNames) {
      flagsById[ifFlagName] = this._tryResolveIfFlagValueFromSharedVariablesOnly(ifFlagName, sharedVariablesById);
    }

    return flagsById;
  }

  private _tryResolveIfFlagValueFromSharedVariablesOnly(
    flagExpression: string,
    sharedVariablesById: Record<string, string>
  ): boolean {
    const rawExpression = (flagExpression ?? '').trim();
    if (!rawExpression) return false;

    const match = /^(!+)?(.*)$/.exec(rawExpression);
    const negationPrefix = (match?.[1] ?? '').trim();
    const rawFlagName = (match?.[2] ?? '').trim();

    const negationsCount = negationPrefix.length;
    const shouldNegate = negationsCount % 2 === 1;

    const rawValue = sharedVariablesById?.[rawFlagName];
    const isTruthy = this._coerceTextToBoolean(rawValue);

    return shouldNegate ? !isTruthy : isTruthy;
  }

  private _coerceTextToBoolean(text: string | undefined): boolean {
    if (text === undefined) return false;

    const normalized = String(text).trim();
    if (!normalized) return false;

    const lowered = normalized.toLowerCase();

    if (lowered === 'true') return true;
    if (lowered === 'false') return false;

    if (lowered === '1') return true;
    if (lowered === '0') return false;

    if (lowered === 'yes') return true;
    if (lowered === 'no') return false;

    if (lowered === 'on') return true;
    if (lowered === 'off') return false;

    return true;
  }

  private _extractIfFlagNames(promptText: string): string[] {
    const foundFlagNames: string[] = [];

    const ifStartTagRegex = /{{#if\s+([^}]+)}}/g;
    const elseIfTagRegex = /{{else\s+if\s+([^}]+)}}/g;

    let match: RegExpExecArray | null;

    while ((match = ifStartTagRegex.exec(promptText)) !== null) {
      const rawFlagName = (match[1] ?? '').trim();
      if (!rawFlagName) continue;

      foundFlagNames.push(rawFlagName);
    }

    while ((match = elseIfTagRegex.exec(promptText)) !== null) {
      const rawFlagName = (match[1] ?? '').trim();
      if (!rawFlagName) continue;

      foundFlagNames.push(rawFlagName);
    }

    return foundFlagNames;
  }

  private _buildResolvedSharedVariablesById(): Record<string, string> {
    const rawSharedVariablesById = this._config.baseSettings.promptInstructionConfig.sharedVariablesById ?? {};
    const sharedVariableTemplatesById = { ...rawSharedVariablesById };

    let resolvedSharedVariablesById = { ...rawSharedVariablesById };

    for (let passIndex = 0; passIndex < 10; passIndex++) {
      let didAnyValueChange = false;

      for (const sharedVariableId of Object.keys(sharedVariableTemplatesById)) {
        const rawTemplate = sharedVariableTemplatesById[sharedVariableId] ?? '';

        const resolvedValue = this._mustacheRenderer.renderPlaceholders(rawTemplate, placeholderKey => {
          return this._configTreeValueResolver.tryResolvePlaceholderValue(placeholderKey, resolvedSharedVariablesById);
        });

        const previousValue = resolvedSharedVariablesById[sharedVariableId];

        if (previousValue === resolvedValue) continue;

        resolvedSharedVariablesById = {
          ...resolvedSharedVariablesById,
          [sharedVariableId]: resolvedValue,
        };

        didAnyValueChange = true;
      }

      if (!didAnyValueChange) break;
    }

    return resolvedSharedVariablesById;
  }

  private async _tryReadPromptText(
    promptInstructionsConfig: PromptInstructionsConfig,
    promptId: string
  ): Promise<string | null> {
    const promptUri = this._tryBuildPromptUri(promptInstructionsConfig);

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

  private _tryBuildPromptUri(promptInstructionsConfig: PromptInstructionsConfig): vscode.Uri | null {
    const rawPath = promptInstructionsConfig.relativePathToSubInstruction;

    if (rawPath.startsWith('file:')) return vscode.Uri.parse(rawPath); // support file:// URI values (not raw OS paths)
    if (path.isAbsolute(rawPath)) return vscode.Uri.file(rawPath);

    return promptInstructionsConfig.isSystemBundledFile
      ? vscode.Uri.joinPath(this._extensionContext.extensionUri, rawPath)
      : this._tryBuildWorkspacePromptUri(rawPath);
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

    return String.raw`${placeholderStartFragment}([a-zA-Z0-9*_.-]+)${placeholderEndFragment}`;
  }

  private _escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[]]/g, '$&');
  }
}
