import * as path from 'node:path';
import * as vscode from 'vscode';

import { Liquid } from 'liquidjs';
import get from 'lodash/get';

import {
  type LlmCopypasterConfig,
  type PromptInstructionConfig,
  type PromptInstructionsConfig,
} from '../../../config-service';
import { GLOB_CONSTS } from '../../../global-constants';
import {
  collapseEmptyLines,
  normalizeDirectPlaceholderValue,
  tryExtractConfigVariablePath,
  tryParseScalarLiquidValue,
} from './liquid-tech-prompt-builder-helpers';
import { showTechPromptResolveIssuesIfAny, type TechPromptResolveIssues } from './variables-resolve-report-helpers';

export class PromptBuilder {
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
      this._config.coreSettings.promptInstructionConfig ?? {};
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

    const delimiterLine = `\n${this._config.vitalParsingAnchors.techPromptDelimiter}\n`;

    return builtPrompts.join(delimiterLine);
  }

  private async _tryBuildPromptText(args: {
    promptId: string;
    promptInstructionsConfig: PromptInstructionsConfig;
    resolvedSharedVariablesById: Record<string, unknown>;
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
    const normalizedRenderedText = collapseEmptyLines(renderedText);

    if (!normalizedRenderedText.trim()) return null;

    return normalizedRenderedText;
  }

  private async _buildResolvedSharedVariablesById(resolveIssues: TechPromptResolveIssues): Promise<Record<string, unknown>> {
    const rawSharedVariablesById = this._config.coreSettings.promptInstructionConfig.sharedVariablesById ?? {};

    const resolvedSharedVariablesById: Record<string, unknown> = {};

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
          configVariablePath: tryExtractConfigVariablePath(
            rawTemplate,
            this._config.vitalParsingAnchors.configVariablePrefix
          ),
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

      resolvedSharedVariablesById[sharedVariableId] = tryParseScalarLiquidValue(renderedValueOrNull ?? '');
    }

    return resolvedSharedVariablesById;
  }

  private _tryResolveDirectConfigTemplate(
    rawTemplate: string,
    sharedVariableId: string,
    resolveIssues: TechPromptResolveIssues
  ): unknown | undefined {
    const configVariablePrefix = this._config.vitalParsingAnchors.configVariablePrefix;

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
        configVariablePath: tryExtractConfigVariablePath(rawTemplate, configVariablePrefix),
        errorText: 'Config value not found for direct placeholder resolution',
      });

      return rawTemplate;
    }

    return normalizeDirectPlaceholderValue(resolvedValue);
  }

  private async _tryReadPromptText(
    promptInstructionsConfig: PromptInstructionsConfig,
    promptId: string,
    resolveIssues: TechPromptResolveIssues
  ): Promise<string | null> {
    const promptUri = this._tryBuildPromptUri(promptInstructionsConfig.relativePathToSubInstruction);
    const isSystemBundledPromptFile = this._isSystemBundledPromptFile(promptInstructionsConfig.relativePathToSubInstruction);
    const promptSource = isSystemBundledPromptFile ? 'extension' : 'workspace';

    if (!promptUri) {
      resolveIssues.filePromptsIssues.push({
        promptId,
        source: promptSource,
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
        source: promptSource,
        relativePathToSubInstruction: promptInstructionsConfig.relativePathToSubInstruction,
        errorText,
        promptUriString: promptUri.toString(),
      });

      return null;
    }
  }

  private _tryBuildPromptUri(relativePathToSubInstruction: string): vscode.Uri | null {
    if (this._isSystemBundledPromptFile(relativePathToSubInstruction))
      return vscode.Uri.joinPath(this._extensionContext.extensionUri, relativePathToSubInstruction);

    if (relativePathToSubInstruction.startsWith('file:')) return vscode.Uri.parse(relativePathToSubInstruction);

    if (path.isAbsolute(relativePathToSubInstruction)) return vscode.Uri.file(relativePathToSubInstruction);

    const workspaceRootUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!workspaceRootUri) return null;

    return vscode.Uri.joinPath(workspaceRootUri, relativePathToSubInstruction);
  }

  private _isSystemBundledPromptFile(relativePathToSubInstruction: string): boolean {
    const normalizedRelativePathToSubInstruction = (relativePathToSubInstruction ?? '').replaceAll('\\', '/');

    return normalizedRelativePathToSubInstruction === GLOB_CONSTS.LLM_RESPONSE_RULES_PROMPT_RELATIVE_PATH;
  }
}
