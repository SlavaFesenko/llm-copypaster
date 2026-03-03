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

    const sharedVariablesBuildResult = this._buildResolvedSharedVariablesById();
    const resolvedSharedVariablesById = sharedVariablesBuildResult.resolvedSharedVariablesById;

    const unresolvedPromptSharedVariables = new Set<string>();
    const unresolvedPromptIfFlags = new Set<string>();

    for (const promptId of promptIdsInConfig) {
      const promptInstructionsConfig = subInstructionsById[promptId];
      if (!promptInstructionsConfig) continue;

      const builtPromptText = await this._tryBuildPromptText({
        promptId,
        promptInstructionsConfig,
        resolvedSharedVariablesById,
        unresolvedPromptSharedVariables,
        unresolvedPromptIfFlags,
      });

      if (!builtPromptText) continue;

      builtPrompts.push(builtPromptText);
    }

    this._showUnresolvedVariablesWarningIfNeeded({
      unresolvedConfigVariables: sharedVariablesBuildResult.unresolvedConfigVariableKeys,
      unresolvedSharedVariablesInSharedVariables: sharedVariablesBuildResult.unresolvedSharedVariableKeys,
      unresolvedPromptSharedVariables,
      unresolvedPromptIfFlags,
    });

    if (builtPrompts.length === 0) return '';

    const delimiterLine = `\n${this._config.llmToIdeParsingAnchors.techPromptDelimiter}\n`;

    return builtPrompts.join(delimiterLine);
  }

  private async _tryBuildPromptText(args: {
    promptId: string;
    promptInstructionsConfig: PromptInstructionsConfig;
    resolvedSharedVariablesById: Record<string, string>;
    unresolvedPromptSharedVariables: Set<string>;
    unresolvedPromptIfFlags: Set<string>;
  }): Promise<string | null> {
    if (args.promptInstructionsConfig.ignore) return null;

    const promptText = await this._tryReadPromptText(args.promptInstructionsConfig, args.promptId);
    if (!promptText) return null;

    let nextPromptText = promptText;

    nextPromptText = this._renderPlaceholdersFromSharedVariablesOnly(
      nextPromptText,
      args.resolvedSharedVariablesById,
      args.unresolvedPromptSharedVariables
    );

    const flagsById = this._buildIfFlagsById(nextPromptText, args.resolvedSharedVariablesById, args.unresolvedPromptIfFlags);
    nextPromptText = this._mustacheRenderer.renderIfBlocks(nextPromptText, flagsById);

    if (!nextPromptText.trim()) return null;

    return nextPromptText;
  }

  private _renderPlaceholdersFromSharedVariablesOnly(
    promptText: string,
    sharedVariablesById: Record<string, string>,
    unresolvedPromptSharedVariables: Set<string>
  ): string {
    return this._mustacheRenderer.renderPlaceholders(promptText, placeholderKey => {
      const resolvedValue = sharedVariablesById?.[placeholderKey];
      if (resolvedValue === undefined) {
        unresolvedPromptSharedVariables.add(placeholderKey);
        return null;
      }

      return resolvedValue;
    });
  }

  private _buildIfFlagsById(
    promptText: string,
    sharedVariablesById: Record<string, string>,
    unresolvedPromptIfFlags: Set<string>
  ): Record<string, boolean> {
    const flagsById: Record<string, boolean> = {};
    const ifFlagNames = this._extractIfFlagNames(promptText);

    for (const ifFlagName of ifFlagNames) {
      const didResolveFlagName = this._tryRegisterUnresolvedIfFlagName(
        ifFlagName,
        sharedVariablesById,
        unresolvedPromptIfFlags
      );
      flagsById[ifFlagName] = this._tryResolveIfFlagValueFromSharedVariablesOnly(ifFlagName, sharedVariablesById);

      if (!didResolveFlagName) continue;
    }

    return flagsById;
  }

  private _tryRegisterUnresolvedIfFlagName(
    flagExpression: string,
    sharedVariablesById: Record<string, string>,
    unresolvedPromptIfFlags: Set<string>
  ): boolean {
    const rawExpression = (flagExpression ?? '').trim();
    if (!rawExpression) return false;

    const match = /^(!+)?(.*)$/.exec(rawExpression);
    const rawFlagName = (match?.[2] ?? '').trim();
    if (!rawFlagName) return false;

    const rawValue = sharedVariablesById?.[rawFlagName];
    if (rawValue !== undefined) return true;

    unresolvedPromptIfFlags.add(rawFlagName);
    return false;
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

  private _buildResolvedSharedVariablesById(): {
    resolvedSharedVariablesById: Record<string, string>;
    unresolvedConfigVariableKeys: Set<string>;
    unresolvedSharedVariableKeys: Set<string>;
  } {
    const rawSharedVariablesById = this._config.baseSettings.promptInstructionConfig.sharedVariablesById ?? {};
    const sharedVariableTemplatesById = { ...rawSharedVariablesById };

    const attemptedConfigVariableKeys = new Set<string>();
    const attemptedSharedVariableKeys = new Set<string>();

    let resolvedSharedVariablesById = { ...rawSharedVariablesById };

    for (let passIndex = 0; passIndex < 10; passIndex++) {
      let didAnyValueChange = false;

      for (const sharedVariableId of Object.keys(sharedVariableTemplatesById)) {
        const rawTemplate = sharedVariableTemplatesById[sharedVariableId] ?? '';

        const directResolvedValue = this._tryResolveDirectLlmCppConfigTemplate(
          rawTemplate,
          resolvedSharedVariablesById,
          attemptedConfigVariableKeys
        );
        const normalizedTemplate = directResolvedValue !== null ? directResolvedValue : rawTemplate;

        const resolvedValue = this._mustacheRenderer.renderPlaceholders(normalizedTemplate, placeholderKey => {
          if (placeholderKey.startsWith('LLM_CPP_CFG.') || placeholderKey.startsWith('cfg.'))
            attemptedConfigVariableKeys.add(placeholderKey);
          else attemptedSharedVariableKeys.add(placeholderKey);

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

    const unresolvedConfigVariableKeys = new Set<string>();
    const unresolvedSharedVariableKeys = new Set<string>();

    for (const attemptedConfigVariableKey of attemptedConfigVariableKeys) {
      const resolved = this._configTreeValueResolver.tryResolvePlaceholderValue(
        attemptedConfigVariableKey,
        resolvedSharedVariablesById
      );
      if (resolved === null) unresolvedConfigVariableKeys.add(attemptedConfigVariableKey);
    }

    for (const attemptedSharedVariableKey of attemptedSharedVariableKeys) {
      const resolved = this._configTreeValueResolver.tryResolvePlaceholderValue(
        attemptedSharedVariableKey,
        resolvedSharedVariablesById
      );
      if (resolved === null) unresolvedSharedVariableKeys.add(attemptedSharedVariableKey);
    }

    return { resolvedSharedVariablesById, unresolvedConfigVariableKeys, unresolvedSharedVariableKeys };
  }

  private _tryResolveDirectLlmCppConfigTemplate(
    rawTemplate: string,
    resolvedSharedVariablesById: Record<string, string>,
    attemptedConfigVariableKeys: Set<string>
  ): string | null {
    const normalized = (rawTemplate ?? '').trim();
    if (!normalized.startsWith('LLM_CPP_CFG.')) return null;

    attemptedConfigVariableKeys.add(normalized);

    const resolved = this._configTreeValueResolver.tryResolvePlaceholderValue(normalized, resolvedSharedVariablesById);
    if (resolved === null) return rawTemplate;

    return resolved;
  }

  private _showUnresolvedVariablesWarningIfNeeded(args: {
    unresolvedConfigVariables: Set<string>;
    unresolvedSharedVariablesInSharedVariables: Set<string>;
    unresolvedPromptSharedVariables: Set<string>;
    unresolvedPromptIfFlags: Set<string>;
  }): void {
    const unresolvedConfigVariablesArray = Array.from(args.unresolvedConfigVariables ?? []).sort();
    const unresolvedSharedVariablesInSharedVariablesArray = Array.from(
      args.unresolvedSharedVariablesInSharedVariables ?? []
    ).sort();
    const unresolvedPromptSharedVariablesArray = Array.from(args.unresolvedPromptSharedVariables ?? []).sort();
    const unresolvedPromptIfFlagsArray = Array.from(args.unresolvedPromptIfFlags ?? []).sort();

    if (
      unresolvedConfigVariablesArray.length === 0 &&
      unresolvedSharedVariablesInSharedVariablesArray.length === 0 &&
      unresolvedPromptSharedVariablesArray.length === 0 &&
      unresolvedPromptIfFlagsArray.length === 0
    )
      return;

    const parts: string[] = [];

    if (unresolvedConfigVariablesArray.length > 0)
      parts.push(`Unresolved config variables: ${unresolvedConfigVariablesArray.join(', ')}`);
    if (unresolvedSharedVariablesInSharedVariablesArray.length > 0) {
      parts.push(
        `Unresolved shared variables (used inside sharedVariablesById): ${unresolvedSharedVariablesInSharedVariablesArray.join(', ')}`
      );
    }
    if (unresolvedPromptSharedVariablesArray.length > 0) {
      parts.push(`Unresolved shared variables (used in prompt files): ${unresolvedPromptSharedVariablesArray.join(', ')}`);
    }
    if (unresolvedPromptIfFlagsArray.length > 0)
      parts.push(`Unresolved if-flags (used in prompt files): ${unresolvedPromptIfFlagsArray.join(', ')}`);

    vscode.window.showWarningMessage(parts.join(' | '));
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
