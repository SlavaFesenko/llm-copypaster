import * as path from 'node:path';
import * as vscode from 'vscode';

import { Liquid } from 'liquidjs';
import { InstructionConfig, InstructionsConfig, SystemConfig } from '../../../config/contracts/system-config-contracts';
import { GLOB_CONSTS } from '../../../contracts/global-constants';
import { collapseEmptyLines } from './helpers';
import { showNotificationIfAnyIssues, type InstructionsResolveIssuesBag } from './report-helpers';

export enum InstructionsBuilderMode {
  Override = 'override',
  QuickInstruction = 'quickInstruction',
}

export interface BuildInstructionsArgs {
  mode: InstructionsBuilderMode;
  onlyForInstructionsIds?: string[];
}

export class InstructionsBuilder {
  private readonly _liquidStrict: Liquid;
  private readonly _liquidLight: Liquid;

  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _config: SystemConfig
  ) {
    this._liquidStrict = new Liquid({ cache: false, strictVariables: true, strictFilters: false });
    this._liquidLight = new Liquid({ cache: false, strictVariables: false, strictFilters: false });
  }

  public async build(args?: BuildInstructionsArgs): Promise<string> {
    const resolvedBuildInstructionsArgs = this._resolveBuildInstructionsArgs(args);

    const instructionsAndVariablesConfig: Partial<InstructionsConfig> =
      this._config.presetDependentSettings.instructionsSettings ?? {};
    const instructionsById = instructionsAndVariablesConfig.instructionsById ?? {};

    const effectiveInstructionsIds = this._calculateInstructionIdsToBuild({
      instructionsById,
      onlyForInstructionsIds: resolvedBuildInstructionsArgs.onlyForInstructionsIds,
      mode: resolvedBuildInstructionsArgs.mode,
    });

    if (effectiveInstructionsIds.length === 0) return '';

    const resolveIssuesBag: InstructionsResolveIssuesBag = {
      filePromptsIssues: [],
      configVariablesIssues: [],
      liquidJsIssues: [],
    };

    const finalInstructionsText: string[] = [];

    for (const instructionId of effectiveInstructionsIds) {
      const instructionDetails = instructionsById[instructionId];
      if (!instructionDetails) continue;

      const instructionText = await this._buildInstructionsText({
        instructionId: instructionId,
        instructionDetails: instructionDetails,
        variablesById: this._config.presetDependentSettings.instructionsSettings.variablesById ?? {},
        resolveIssuesBag: resolveIssuesBag,
      });

      if (!instructionText) continue;

      finalInstructionsText.push(instructionText);
    }

    showNotificationIfAnyIssues({ extensionContext: this._extensionContext, resolveIssues: resolveIssuesBag });

    if (finalInstructionsText.length === 0) return '';

    const delimiterLine = `\n${this._config.presetIndependentSettings.vitalParsingAnchors.PROMPT_DELIMITER_ANCHOR}\n`;

    return finalInstructionsText.join(delimiterLine);
  }

  private _calculateInstructionIdsToBuild(args: {
    instructionsById: Record<string, InstructionConfig>;
    onlyForInstructionsIds?: string[];
    mode: InstructionsBuilderMode;
  }): string[] {
    const allowedInstructionIds = Object.entries(args.instructionsById)
      .filter(([, instructionDetails]) => {
        if (instructionDetails.skip) return false;
        if (args.mode === InstructionsBuilderMode.Override && !instructionDetails.showInPresetsMode) return false;
        if (args.mode === InstructionsBuilderMode.QuickInstruction && !instructionDetails.showInQuickInstructionMode)
          return false;

        return true;
      })
      .map(([instructionId]) => instructionId);

    const selectedInstructionIds = args.onlyForInstructionsIds?.filter(Boolean) ?? [];

    if (selectedInstructionIds.length === 0) return allowedInstructionIds;

    const allowedInstructionIdsSet = new Set(allowedInstructionIds);
    const extraInstructionIds = selectedInstructionIds.filter(instructionId => !allowedInstructionIdsSet.has(instructionId));

    if (extraInstructionIds.length > 0) {
      void vscode.window.showWarningMessage(
        `Some onlyForInstructionsIds are not allowed by config for mode: ${extraInstructionIds.join(', ')}`
      );
    }

    return allowedInstructionIds.filter(instructionId => selectedInstructionIds.includes(instructionId));
  }

  private async _buildInstructionsText(args: {
    instructionId: string;
    instructionDetails: InstructionConfig;
    variablesById: Record<string, unknown>;
    resolveIssuesBag: InstructionsResolveIssuesBag;
  }): Promise<string | null> {
    if (args.instructionDetails.skip) return null;

    const instructionText = await this._readInstructionTextFromFile(
      args.instructionDetails,
      args.instructionId,
      args.resolveIssuesBag
    );
    if (!instructionText) return null;

    let renderedTextOrNull: string | null = null;

    try {
      renderedTextOrNull = await this._liquidStrict.parseAndRender(instructionText, {
        ...args.variablesById,
      });
    } catch (error: unknown) {
      const errorText = error instanceof Error ? error.message || error.name : String(error);

      args.resolveIssuesBag.liquidJsIssues.push({
        promptId: args.instructionId,
        errorText,
      });
    }

    if (renderedTextOrNull === null) {
      try {
        renderedTextOrNull = await this._liquidLight.parseAndRender(instructionText, {
          ...args.variablesById,
        });
      } catch {
        return null;
      }
    }

    const renderedText = renderedTextOrNull ?? '';
    const normalizedRenderedText = collapseEmptyLines(renderedText);

    if (!normalizedRenderedText.trim()) return null;

    return normalizedRenderedText;
  }

  private async _readInstructionTextFromFile(
    promptInstructionsConfig: InstructionConfig,
    promptId: string,
    resolveIssues: InstructionsResolveIssuesBag
  ): Promise<string | null> {
    const promptUri = this._tryBuildPromptUri(promptInstructionsConfig.path);
    const isSystemBundledPromptFile = this._isSystemBundledInstructionFile(promptInstructionsConfig.path);
    const promptSource = isSystemBundledPromptFile ? 'extension' : 'workspace';

    if (!promptUri) {
      resolveIssues.filePromptsIssues.push({
        promptId,
        source: promptSource,
        relativePathToSubInstruction: promptInstructionsConfig.path,
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
        relativePathToSubInstruction: promptInstructionsConfig.path,
        errorText,
        promptUriString: promptUri.toString(),
      });

      return null;
    }
  }

  private _tryBuildPromptUri(relativePathToSubInstruction: string): vscode.Uri | null {
    if (this._isSystemBundledInstructionFile(relativePathToSubInstruction))
      return vscode.Uri.joinPath(this._extensionContext.extensionUri, relativePathToSubInstruction);

    if (relativePathToSubInstruction.startsWith('file:')) return vscode.Uri.parse(relativePathToSubInstruction);

    if (path.isAbsolute(relativePathToSubInstruction)) return vscode.Uri.file(relativePathToSubInstruction);

    const workspaceRootUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!workspaceRootUri) return null;

    return vscode.Uri.joinPath(workspaceRootUri, relativePathToSubInstruction);
  }

  private _isSystemBundledInstructionFile(relativePathToSubInstruction: string): boolean {
    const normalizedRelativePathToSubInstruction = (relativePathToSubInstruction ?? '').replaceAll('\\', '/');

    return (Object.values(GLOB_CONSTS.SYSTEM_INSTRUCTIONS) as readonly string[]).includes(
      normalizedRelativePathToSubInstruction
    );
  }

  private _resolveBuildInstructionsArgs(args?: BuildInstructionsArgs): BuildInstructionsArgs {
    return {
      mode: args?.mode ?? InstructionsBuilderMode.Override,
      onlyForInstructionsIds: args?.onlyForInstructionsIds,
    };
  }
}
