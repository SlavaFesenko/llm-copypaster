import * as path from 'node:path';
import * as vscode from 'vscode';

import { Liquid } from 'liquidjs';

import {
  type LlmCopypasterConfig,
  type PromptInstructionConfig,
  type PromptInstructionsConfig,
} from '../../../config-service';
import { ConfigTreeValueResolver } from './config-tree-value-resolver';
import { MustacheRenderer } from './mustache-renderer';

export class LiquidTechPromptBuilder {
  private readonly _liquid: Liquid;
  private readonly _mustacheRenderer: MustacheRenderer;
  private readonly _configTreeValueResolver: ConfigTreeValueResolver;

  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _config: LlmCopypasterConfig
  ) {
    this._liquid = new Liquid({ cache: false, strictVariables: false, strictFilters: false });
    this._mustacheRenderer = new MustacheRenderer(this._buildPlaceholderRegexPattern()); // used only for sharedVariablesById resolution
    this._configTreeValueResolver = new ConfigTreeValueResolver(this._config);
  }

  public async build(): Promise<string> {
    const promptInstructionConfig: Partial<PromptInstructionConfig> =
      this._config.baseSettings.promptInstructionConfig ?? {};
    const subInstructionsById = promptInstructionConfig.subInstructionsById ?? {};
    const promptIdsInConfig = Object.keys(subInstructionsById);

    if (promptIdsInConfig.length === 0) return '';

    const builtPrompts: string[] = [];

    const sharedVariablesBuildResult = this._buildResolvedSharedVariablesById();
    const resolvedSharedVariablesById = sharedVariablesBuildResult.resolvedSharedVariablesById;

    const unresolvedPromptSharedVariables = new Set<string>();
    const unresolvedPromptIfFlags = new Set<string>();

    for (const promptId of promptIdsInConfig) {
      const promptInstructionsConfig = subInstructionsById[promptId] as PromptInstructionsConfig | undefined;
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

    this._registerUnresolvedLiquidVariables(
      promptText,
      args.resolvedSharedVariablesById,
      args.unresolvedPromptSharedVariables
    );
    this._registerUnresolvedLiquidIfFlags(promptText, args.resolvedSharedVariablesById, args.unresolvedPromptIfFlags);

    const liquidContext = { ...args.resolvedSharedVariablesById };

    let renderedText: string;

    try {
      renderedText = await this._liquid.parseAndRender(promptText, liquidContext);
    } catch (error: unknown) {
      const errorText = error instanceof Error ? error.message || error.name : String(error);
      vscode.window.showWarningMessage(`Liquid render failed: id="${args.promptId}", error="${errorText}"`);
      return null;
    }

    if (!renderedText.trim()) return null;

    return renderedText;
  }

  private _registerUnresolvedLiquidVariables(
    promptText: string,
    resolvedSharedVariablesById: Record<string, string>,
    unresolvedPromptSharedVariables: Set<string>
  ): void {
    const outputTagRegex = /{{\s*([^}]+)\s*}}/g;

    let match: RegExpExecArray | null;

    while ((match = outputTagRegex.exec(promptText)) !== null) {
      const rawExpression = (match[1] ?? '').trim();
      if (!rawExpression) continue;

      const beforeFilter = rawExpression.split('|')[0]?.trim() ?? '';
      const variableMatch = /([a-zA-Z0-9_.-]+)/.exec(beforeFilter);
      const variableName = (variableMatch?.[1] ?? '').trim();

      if (!variableName) continue;
      if (resolvedSharedVariablesById?.[variableName] !== undefined) continue;

      unresolvedPromptSharedVariables.add(variableName);
    }
  }

  private _registerUnresolvedLiquidIfFlags(
    promptText: string,
    resolvedSharedVariablesById: Record<string, string>,
    unresolvedPromptIfFlags: Set<string>
  ): void {
    const ifTagRegex = /{%\s*(if|elsif)\s+([^%]+?)\s*%}/g;
    const ignored = new Set<string>(['true', 'false', 'nil', 'blank', 'empty', 'null']);

    let match: RegExpExecArray | null;

    while ((match = ifTagRegex.exec(promptText)) !== null) {
      const rawExpression = (match[2] ?? '').trim();
      if (!rawExpression) continue;

      const tokenMatch = /([a-zA-Z_][a-zA-Z0-9_.-]*)/.exec(rawExpression);
      const token = (tokenMatch?.[1] ?? '').trim();

      if (!token) continue;
      if (ignored.has(token.toLowerCase())) continue;

      const resolved = resolvedSharedVariablesById?.[token];
      if (resolved !== undefined) continue;

      unresolvedPromptIfFlags.add(token);
    }
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

        const directResolvedValue = this._tryResolveDirectConfigTemplate(
          rawTemplate,
          resolvedSharedVariablesById,
          attemptedConfigVariableKeys
        );
        const normalizedTemplate = directResolvedValue !== null ? directResolvedValue : rawTemplate;

        const resolvedValue = this._mustacheRenderer.renderPlaceholders(normalizedTemplate, placeholderKey => {
          const configVariablePrefix = this._getConfigVariablePrefix();
          if (configVariablePrefix && placeholderKey.startsWith(configVariablePrefix))
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

  private _tryResolveDirectConfigTemplate(
    rawTemplate: string,
    resolvedSharedVariablesById: Record<string, string>,
    attemptedConfigVariableKeys: Set<string>
  ): string | null {
    const configVariablePrefix = this._getConfigVariablePrefix();

    const normalized = (rawTemplate ?? '').trim();
    if (!configVariablePrefix) return null;
    if (!normalized.startsWith(configVariablePrefix)) return null;

    attemptedConfigVariableKeys.add(normalized);

    const resolved = this._configTreeValueResolver.tryResolvePlaceholderValue(normalized, resolvedSharedVariablesById);
    if (resolved === null) return rawTemplate;

    return resolved;
  }

  private _getConfigVariablePrefix(): string {
    return this._config.llmToIdeParsingAnchors.configVariablePrefix;
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

  private _buildPlaceholderRegexPattern(): string {
    const placeholderStartFragment = this._escapeRegExp(this._config.llmToIdeParsingAnchors.placeholderStartFragment);
    const placeholderEndFragment = this._escapeRegExp(this._config.llmToIdeParsingAnchors.placeholderEndFragment);

    return String.raw`${placeholderStartFragment}([a-zA-Z0-9*_.-]+)${placeholderEndFragment}`;
  }

  private _escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[]]/g, '$&');
  }
}
