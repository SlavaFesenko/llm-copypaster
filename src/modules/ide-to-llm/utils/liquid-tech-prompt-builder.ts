import * as path from 'node:path';
import * as vscode from 'vscode';

import { Liquid } from 'liquidjs';
import get from 'lodash/get';

import {
  type LlmCopypasterConfig,
  type PromptInstructionConfig,
  type PromptInstructionsConfig,
} from '../../../config-service';
import { showTechPromptResolveIssuesIfAny, type TechPromptResolveIssues } from './tech-prompt-resolve-report-helpers';

export class LiquidTechPromptBuilder {
  private readonly _liquidStrict: Liquid;
  private readonly _liquidLight: Liquid;

  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _config: LlmCopypasterConfig
  ) {
    this._liquidStrict = new Liquid({ cache: false, strictVariables: true, strictFilters: false });
    this._liquidLight = new Liquid({ cache: false, strictVariables: false, strictFilters: false });
  }

  public async build(): Promise<string> {
    const promptInstructionConfig: Partial<PromptInstructionConfig> =
      this._config.baseSettings.promptInstructionConfig ?? {};
    const subInstructionsById = promptInstructionConfig.subInstructionsById ?? {};
    const promptIdsInConfig = Object.keys(subInstructionsById);

    if (promptIdsInConfig.length === 0) return '';

    const resolveIssues: TechPromptResolveIssues = {
      filePromptsIssues: [],
      configVariablesIssues: [],
      liquidJsIssues: [],
    };

    const resolvedSharedVariablesById = await this._buildResolvedSharedVariablesById(resolveIssues);

    const builtPrompts: string[] = [];

    for (const promptId of promptIdsInConfig) {
      const promptInstructionsConfig = subInstructionsById[promptId] as PromptInstructionsConfig | undefined;
      if (!promptInstructionsConfig) continue;
      if (promptInstructionsConfig.ignore) continue;

      const builtPromptText = await this._tryBuildPromptText({
        promptId,
        promptInstructionsConfig,
        resolvedSharedVariablesById,
        resolveIssues,
      });

      if (!builtPromptText) continue;

      builtPrompts.push(builtPromptText);
    }

    showTechPromptResolveIssuesIfAny({ extensionContext: this._extensionContext, resolveIssues });

    if (builtPrompts.length === 0) return '';

    const delimiterLine = `\n${this._config.llmToIdeParsingAnchors.techPromptDelimiter}\n`;

    return builtPrompts.join(delimiterLine);
  }

  private async _tryBuildPromptText(args: {
    promptId: string;
    promptInstructionsConfig: PromptInstructionsConfig;
    resolvedSharedVariablesById: Record<string, string>;
    resolveIssues: TechPromptResolveIssues;
  }): Promise<string | null> {
    if (args.promptInstructionsConfig.ignore) return null;

    const promptText = await this._tryReadPromptText(args.promptInstructionsConfig, args.promptId, args.resolveIssues);
    if (!promptText) return null;

    let renderedTextOrNull: string | null = null;

    try {
      renderedTextOrNull = await this._liquidStrict.parseAndRender(promptText, { ...args.resolvedSharedVariablesById });
    } catch (error: unknown) {
      const errorText = error instanceof Error ? error.message || error.name : String(error);

      args.resolveIssues.liquidJsIssues.push({
        promptId: args.promptId,
        errorText,
      });
    }

    if (renderedTextOrNull === null) {
      try {
        renderedTextOrNull = await this._liquidLight.parseAndRender(promptText, { ...args.resolvedSharedVariablesById });
      } catch {
        return null;
      }
    }

    const renderedText = renderedTextOrNull ?? '';
    if (!renderedText.trim()) return null;

    return renderedText;
  }

  private async _buildResolvedSharedVariablesById(resolveIssues: TechPromptResolveIssues): Promise<Record<string, string>> {
    const rawSharedVariablesById = this._config.baseSettings.promptInstructionConfig.sharedVariablesById ?? {};

    const resolvedSharedVariablesById: Record<string, string> = {};

    for (const sharedVariableId of Object.keys(rawSharedVariablesById)) {
      const rawTemplate = rawSharedVariablesById[sharedVariableId] ?? '';

      const directResolvedConfigValueOrUndefined = this._tryResolveDirectConfigTemplate(
        rawTemplate,
        sharedVariableId,
        resolveIssues
      );
      if (directResolvedConfigValueOrUndefined !== undefined) {
        resolvedSharedVariablesById[sharedVariableId] = directResolvedConfigValueOrUndefined;
        continue;
      }

      let renderedValueOrNull: string | null = null;

      try {
        renderedValueOrNull = await this._liquidStrict.parseAndRender(rawTemplate, {
          LLM_CPP_CFG: this._config,
        });
      } catch (error: unknown) {
        const errorText = error instanceof Error ? error.message || error.name : String(error);

        resolveIssues.configVariablesIssues.push({
          sharedVariableId,
          rawTemplate,
          configVariablePath: this._tryExtractConfigVariablePath(rawTemplate),
          errorText,
        });
      }

      if (renderedValueOrNull === null) {
        try {
          renderedValueOrNull = await this._liquidLight.parseAndRender(rawTemplate, {
            LLM_CPP_CFG: this._config,
          });
        } catch {
          renderedValueOrNull = rawTemplate;
        }
      }

      resolvedSharedVariablesById[sharedVariableId] = renderedValueOrNull ?? '';
    }

    return resolvedSharedVariablesById;
  }

  private _tryResolveDirectConfigTemplate(
    rawTemplate: string,
    sharedVariableId: string,
    resolveIssues: TechPromptResolveIssues
  ): string | undefined {
    const configVariablePrefix = this._config.llmToIdeParsingAnchors.configVariablePrefix;

    const normalized = (rawTemplate ?? '').trim();
    if (!configVariablePrefix) return undefined;
    if (!normalized.startsWith(configVariablePrefix)) return undefined;

    const rawPath = normalized.slice(configVariablePrefix.length).trim();
    if (!rawPath) return rawTemplate;

    const resolvedValue = get(this._config, rawPath);
    if (resolvedValue === undefined) {
      resolveIssues.configVariablesIssues.push({
        sharedVariableId,
        rawTemplate,
        configVariablePath: this._tryExtractConfigVariablePath(rawTemplate),
        errorText: 'Config value not found for direct placeholder resolution',
      });

      return rawTemplate;
    }

    return this._stringifyPlaceholderValue(resolvedValue);
  }

  private _stringifyPlaceholderValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return '';

    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private _tryExtractConfigVariablePath(rawTemplate: string): string | undefined {
    const configVariablePrefix = this._config.llmToIdeParsingAnchors.configVariablePrefix;

    const normalized = (rawTemplate ?? '').trim();
    if (!configVariablePrefix) return undefined;
    if (!normalized.startsWith(configVariablePrefix)) return undefined;

    return normalized;
  }

  private async _tryReadPromptText(
    promptInstructionsConfig: PromptInstructionsConfig,
    promptId: string,
    resolveIssues: TechPromptResolveIssues
  ): Promise<string | null> {
    const promptUri = this._tryBuildPromptUri(promptInstructionsConfig);

    if (!promptUri) {
      resolveIssues.filePromptsIssues.push({
        promptId,
        source: promptInstructionsConfig.isSystemBundledFile ? 'extension' : 'workspace',
        relativePathToSubInstruction: promptInstructionsConfig.relativePathToSubInstruction,
        errorText: 'Workspace folder not found',
      });

      return null;
    }

    try {
      const bytes = await vscode.workspace.fs.readFile(promptUri);

      return Buffer.from(bytes).toString('utf8');
    } catch (error: unknown) {
      const errorText = error instanceof Error ? error.message || error.name : String(error);

      resolveIssues.filePromptsIssues.push({
        promptId,
        source: promptInstructionsConfig.isSystemBundledFile ? 'extension' : 'workspace',
        relativePathToSubInstruction: promptInstructionsConfig.relativePathToSubInstruction,
        errorText,
        promptUriString: promptUri.toString(),
      });

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

  private _tryBuildWorkspacePromptUri(relativePathToSubInstruction: string): vscode.Uri | null {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return null;

    return vscode.Uri.joinPath(workspaceFolder.uri, relativePathToSubInstruction);
  }
}
