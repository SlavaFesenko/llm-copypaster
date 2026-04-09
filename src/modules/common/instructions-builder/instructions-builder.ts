import * as path from 'node:path';
import * as vscode from 'vscode';

import { Liquid } from 'liquidjs';
import { InstructionConfig, InstructionsConfig, SystemConfig } from '../../../config/contracts/system-config-contracts';
import { GLOB_CONSTS } from '../../../contracts/global-constants';
import { collapseEmptyLines } from './helpers';
import { buildAndShowNotification, type InstructionsResolveIssuesBag } from './report-helpers';

export enum InstructionsBuilderMode {
  Override = 'override',
  QuickInstruction = 'quickInstruction',
}

export interface BuildInstructionsArgs {
  mode: InstructionsBuilderMode;
  onlyForInstructionsIds?: string[];
}

export class InstructionsBuilder {
  private readonly _liquid: Liquid;
  private _resolveIssuesBag: InstructionsResolveIssuesBag = {
    instructionFileIssues: [],
    liquidJsIssues: [],
  };

  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _config: SystemConfig
  ) {
    this._liquid = new Liquid({
      cache: false, // do not reuse parsed templates between runs (instruction files may be changed)
      strictVariables: true, // fail when template uses missing variable
      strictFilters: true, // fail on unknown filter (i.e. {{ name | upcsae }})
      catchAllErrors: true, // collect as many Liquid errors as possible instead of failing on first occurrence
    });
  }

  public async build(args?: BuildInstructionsArgs): Promise<string | null> {
    // reset issues between runs
    this._resolveIssuesBag = {
      instructionFileIssues: [],
      liquidJsIssues: [],
    };

    const buildInstructionsArgs = {
      mode: args?.mode ?? InstructionsBuilderMode.Override,
      onlyForInstructionsIds: args?.onlyForInstructionsIds,
    } as BuildInstructionsArgs;

    const instructionsSettings: Partial<InstructionsConfig> =
      this._config.presetDependentSettings.instructionsSettings ?? {};
    const instructionsById = instructionsSettings.instructionsById ?? {};

    const effectiveInstructionsIds = this._calculateInstructionIdsToBuild({
      instructionsById,
      onlyForInstructionsIds: buildInstructionsArgs.onlyForInstructionsIds,
      mode: buildInstructionsArgs.mode,
    });

    if (effectiveInstructionsIds.length === 0) return null;

    const finalInstructionsText: string[] = [];

    for (const instructionId of effectiveInstructionsIds) {
      const instructionDetails = instructionsById[instructionId];
      if (!instructionDetails) continue;

      const instructionText = await this._buildInstructionsText({
        instructionId: instructionId,
        instructionDetails: instructionDetails,
        variablesById: this._config.presetDependentSettings.instructionsSettings.variablesById ?? {},
      });

      if (!instructionText) continue;

      finalInstructionsText.push(instructionText);
    }

    const issuesCount = this._resolveIssuesBag.instructionFileIssues.length + this._resolveIssuesBag.liquidJsIssues.length;
    if (issuesCount > 0) {
      await buildAndShowNotification({
        extensionContext: this._extensionContext,
        resolveIssues: this._resolveIssuesBag,
        issuesCount,
      });
    }

    if (finalInstructionsText.length === 0) return null;

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
  }): Promise<string | null> {
    if (args.instructionDetails.skip) return null;

    const rawInstructionText = await this._tryReadRawInstructionTextFromFile(args.instructionDetails, args.instructionId);
    if (!rawInstructionText) return null;

    try {
      const liquidProcessedInstructionText = await this._liquid.parseAndRender(rawInstructionText, {
        ...args.variablesById,
      });

      const normalizedRenderedText = collapseEmptyLines(liquidProcessedInstructionText);

      if (!normalizedRenderedText.trim()) return null;

      return normalizedRenderedText;
    } catch (error: unknown) {
      const errorText = error instanceof Error ? error.message || error.name : String(error);

      this._resolveIssuesBag.liquidJsIssues.push({
        instructionId: args.instructionId,
        errorText,
      });

      return null;
    }
  }

  private async _tryReadRawInstructionTextFromFile(
    instructionsConfig: InstructionConfig,
    instructionId: string
  ): Promise<string | null> {
    const instructionFileUri = this._tryBuildInstructionFileUri(instructionsConfig.path);

    if (!instructionFileUri) {
      this._resolveIssuesBag.instructionFileIssues.push({
        instructionId: instructionId,
        pathToInstruction: instructionsConfig.path,
        errorText: 'File location uri build process failes',
      });

      return null;
    }

    try {
      // readFile can handle any type of url, so the most important is correctly calculated instructionFileUri
      const bytes = await vscode.workspace.fs.readFile(instructionFileUri);

      return Buffer.from(bytes).toString('utf8');
    } catch (error: unknown) {
      const errorText = error instanceof Error ? error.message || error.name : String(error);

      this._resolveIssuesBag.instructionFileIssues.push({
        instructionId: instructionId,
        pathToInstruction: instructionsConfig.path,
        errorText,
        instructionUri: instructionFileUri.toString(),
      });

      return null;
    }
  }

  private _tryBuildInstructionFileUri(pathToInstruction: string): vscode.Uri | null {
    if (this._isSystemBundledInstructionFile(pathToInstruction))
      return vscode.Uri.joinPath(this._extensionContext.extensionUri, pathToInstruction);

    if (pathToInstruction.startsWith('file:')) return vscode.Uri.parse(pathToInstruction);

    if (path.isAbsolute(pathToInstruction)) return vscode.Uri.file(pathToInstruction);

    const workspaceRootUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!workspaceRootUri) return null;

    return vscode.Uri.joinPath(workspaceRootUri, pathToInstruction);
  }

  private _isSystemBundledInstructionFile(pathToSubInstruction: string): boolean {
    const normalizedPathToSubInstruction = (pathToSubInstruction ?? '').replaceAll('\\', '/');

    return (Object.values(GLOB_CONSTS.SYSTEM_INSTRUCTIONS) as readonly string[]).includes(normalizedPathToSubInstruction);
  }
}
