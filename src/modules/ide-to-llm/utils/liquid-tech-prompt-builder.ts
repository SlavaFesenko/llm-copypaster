import * as path from 'node:path';
import * as vscode from 'vscode';

import { Liquid } from 'liquidjs';

import {
  type LlmCopypasterConfig,
  type PromptInstructionConfig,
  type PromptInstructionsConfig,
} from '../../../config-service';

export class LiquidTechPromptBuilder {
  private readonly _liquid: Liquid;

  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _config: LlmCopypasterConfig
  ) {
    this._liquid = new Liquid({ cache: false, strictVariables: false, strictFilters: false });
  }

  public async build(): Promise<string> {
    const promptInstructionConfig: Partial<PromptInstructionConfig> =
      this._config.baseSettings.promptInstructionConfig ?? {};
    const subInstructionsById = promptInstructionConfig.subInstructionsById ?? {};
    const promptIdsInConfig = Object.keys(subInstructionsById);

    if (promptIdsInConfig.length === 0) return '';

    const builtPrompts: string[] = [];
    const resolvedSharedVariablesById = await this._buildResolvedSharedVariablesById();

    for (const promptId of promptIdsInConfig) {
      const promptInstructionsConfig = subInstructionsById[promptId] as PromptInstructionsConfig | undefined;
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

    let renderedText: string;

    try {
      renderedText = await this._liquid.parseAndRender(promptText, { ...args.resolvedSharedVariablesById });
    } catch (error: unknown) {
      const errorText = error instanceof Error ? error.message || error.name : String(error);
      vscode.window.showWarningMessage(`Liquid render failed: id="${args.promptId}", error="${errorText}"`);
      return null;
    }

    if (!renderedText.trim()) return null;

    return renderedText;
  }

  private async _buildResolvedSharedVariablesById(): Promise<Record<string, string>> {
    const rawSharedVariablesById = this._config.baseSettings.promptInstructionConfig.sharedVariablesById ?? {};
    let resolvedSharedVariablesById: Record<string, string> = { ...rawSharedVariablesById };

    for (let passIndex = 0; passIndex < 10; passIndex++) {
      let didAnyValueChange = false;

      for (const sharedVariableId of Object.keys(rawSharedVariablesById)) {
        const rawTemplate = rawSharedVariablesById[sharedVariableId] ?? '';

        let resolvedValue: string;

        try {
          resolvedValue = await this._liquid.parseAndRender(rawTemplate, {
            ...resolvedSharedVariablesById,
            LLM_CPP_CFG: this._config,
          });
        } catch {
          resolvedValue = rawTemplate;
        }

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
}
