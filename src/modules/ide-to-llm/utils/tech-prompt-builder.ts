import * as path from 'node:path';
import * as vscode from 'vscode';

import { type LlmCopypasterConfig, type PromptInstructionsConfig } from '../../../config-service';
import { ConfigTreeValueResolver } from './config-tree-value-resolver';
import { MustacheRenderer } from './mustache-renderer';

// 'Supported Mustache-like syntax:',
// '',
// '1) Placeholder replacement:',
// '   - {{someKey}}',
// '   - {{cfg.some.path}}',
// '   - Placeholder keys are resolved by caller (e.g., sharedVariablesById by default; cfg.* can be resolved from config tree)',
// '   - cfg.* may resolve to both leaf values (string/number/bool) and section nodes (object/array)',
// '   - Leaf values are stringified as-is; object/array nodes are stringified via JSON.stringify(...)',
// '',
// '2) Conditional blocks (evaluation is passed by caller):',
// '   - {{#if someFlag}} ... {{/if}}',
// '   - {{#if !someFlag}} ... {{/if}}',
// '   - {{#if !!!someFlag}} ... {{/if}}',
// '   - {{#if cfg.some.path.to-boolean}} ... {{/if}}',
// '   - {{#if !cfg.some.path.to-boolean}} ... {{/if}}',
// '   - {{#if someFlag}} ... {{else}} ... {{/if}}',
// '   - {{#if someFlag}} ... {{else if otherFlag}} ... {{else}} ... {{/if}}',
// '   - {{#if someFlag}} ... {{else if !otherFlag}} ... {{else}} ... {{/if}}',
// '   - Leaf values are coerced to boolean (true/false, 1/0, yes/no, on/off, non-empty strings); object/array nodes are truthy',
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
    const renderConstantsById = this._buildRenderConstantsById();

    for (const promptId of promptIdsInConfig) {
      const promptInstructionsConfig = subInstructionsById[promptId];
      if (!promptInstructionsConfig) continue;

      const builtPromptText = await this._tryBuildPromptText({
        promptId,
        promptInstructionsConfig,
        renderConstantsById,
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
    renderConstantsById: Record<string, string>;
  }): Promise<string | null> {
    if (args.promptInstructionsConfig.ignore) return null;

    const promptText = await this._tryReadPromptText(args.promptInstructionsConfig, args.promptId);
    if (!promptText) return null;

    let nextPromptText = promptText;

    nextPromptText = this._renderPlaceholders(nextPromptText, args.renderConstantsById);

    const flagsById = this._buildIfFlagsById(nextPromptText, args.renderConstantsById);
    nextPromptText = this._mustacheRenderer.renderIfBlocks(nextPromptText, flagsById);

    if (!nextPromptText.trim()) return null;

    return nextPromptText;
  }

  private _renderPlaceholders(promptText: string, constantsById: Record<string, string>): string {
    return this._mustacheRenderer.renderPlaceholders(promptText, placeholderKey =>
      this._configTreeValueResolver.tryResolvePlaceholderValue(placeholderKey, constantsById)
    );
  }

  private _buildIfFlagsById(promptText: string, constantsById: Record<string, string>): Record<string, boolean> {
    const flagsById: Record<string, boolean> = {};
    const ifFlagNames = this._extractIfFlagNames(promptText);

    for (const ifFlagName of ifFlagNames) {
      flagsById[ifFlagName] = this._configTreeValueResolver.tryResolveIfFlagValue(ifFlagName, constantsById);
    }

    return flagsById;
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

  private _buildRenderConstantsById(): Record<string, string> {
    const sharedVariablesById = this._config.baseSettings.promptInstructionConfig.sharedVariablesById ?? {};

    return sharedVariablesById;
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
    return text.replace(/[.*+?^${}()|[]\]/g, '$&');
  }
}
