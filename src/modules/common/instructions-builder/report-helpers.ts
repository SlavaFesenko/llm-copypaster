import * as vscode from 'vscode';

import { ensureReadonlyVirtualMarkdownDocOpened } from '../../../utils/editor-virtual-doc-helpers';

export interface InstructionsResolveIssuesBag {
  instructionFileIssues: InstructionFileIssue[];
  configVariablesIssues: ConfigVariablesResolveIssue[];
  liquidJsIssues: LiquidJsResolveIssue[];
}

export interface InstructionFileIssue {
  instructionId: string;
  source: 'extension' | 'workspace';
  pathToInstruction: string;
  instructionUri?: string;
  errorText: string;
}

export interface ConfigVariablesResolveIssue {
  sharedVariableId: string;
  rawTemplate: string;
  configVariablePath?: string;
  errorText: string;
}

export interface LiquidJsResolveIssue {
  promptId: string;
  errorText: string;
}

export function showNotificationIfAnyIssues(args: {
  extensionContext: vscode.ExtensionContext;
  resolveIssues: InstructionsResolveIssuesBag;
}): void {
  const issuesCount = calculateTotalIssuesCount(args.resolveIssues);
  if (issuesCount === 0) return;

  void buildAndShowNotification({
    extensionContext: args.extensionContext,
    resolveIssues: args.resolveIssues,
    issuesCount,
  });
}

function calculateTotalIssuesCount(resolveIssues: InstructionsResolveIssuesBag): number {
  return (
    resolveIssues.instructionFileIssues.length +
    resolveIssues.configVariablesIssues.length +
    resolveIssues.liquidJsIssues.length
  );
}

async function buildAndShowNotification(args: {
  extensionContext: vscode.ExtensionContext;
  resolveIssues: InstructionsResolveIssuesBag;
  issuesCount: number;
}): Promise<void> {
  const selection = await vscode.window.showWarningMessage(
    `Tech prompt resolve issues detected: ${args.issuesCount} error(s)`,
    'Show Report'
  );

  if (selection !== 'Show Report') return;

  const markdownText = buildMarkdownReport(args.resolveIssues, args.issuesCount);

  await ensureReadonlyVirtualMarkdownDocOpened({
    extensionContext: args.extensionContext,
    docId: 'resolve-report',
    markdownText,
  });
}

function buildMarkdownReport(resolveIssues: InstructionsResolveIssuesBag, totalIssuesCount: number): string {
  const sections: string[] = [];

  sections.push(`# Tech Prompt Resolve Report`);
  sections.push(`Total errors: ${totalIssuesCount}`);
  sections.push('');

  sections.push(`## File Prompts Resolve Issues`);
  sections.push(buildFilePromptsIssuesMarkdown(resolveIssues.instructionFileIssues));
  sections.push('');

  sections.push(`## Config Variables Resolve Issues`);
  sections.push(buildConfigVariablesIssuesMarkdown(resolveIssues.configVariablesIssues));
  sections.push('');

  sections.push(`## LiquidJS Issues`);
  sections.push(buildLiquidJsIssuesMarkdown(resolveIssues.liquidJsIssues));
  sections.push('');

  return sections.join('\n');
}

function buildFilePromptsIssuesMarkdown(filePromptsIssues: InstructionFileIssue[]): string {
  if (filePromptsIssues.length === 0) return `No issues`;

  const lines: string[] = [];

  for (const issue of filePromptsIssues) {
    lines.push(`- Prompt id: "${issue.instructionId}"`);
    lines.push(`  Source: "${issue.source}"`);
    lines.push(`  Path: "${issue.pathToInstruction}"`);
    if (issue.instructionUri) lines.push(`  Uri: "${issue.instructionUri}"`);
    lines.push(`  Error: ${issue.errorText}`);
  }

  return lines.join('\n');
}

function buildConfigVariablesIssuesMarkdown(configVariablesIssues: ConfigVariablesResolveIssue[]): string {
  if (configVariablesIssues.length === 0) return `No issues`;

  const lines: string[] = [];

  for (const issue of configVariablesIssues) {
    lines.push(`- Shared var id: "${issue.sharedVariableId}"`);
    if (issue.configVariablePath) lines.push(`  Config variable: "${issue.configVariablePath}"`);
    lines.push(`  Template: ${issue.rawTemplate}`);
    lines.push(`  Error: ${issue.errorText}`);
  }

  return lines.join('\n');
}

function buildLiquidJsIssuesMarkdown(liquidJsIssues: LiquidJsResolveIssue[]): string {
  if (liquidJsIssues.length === 0) return `No issues`;

  const lines: string[] = [];

  for (const issue of liquidJsIssues) {
    lines.push(`- Prompt id: "${issue.promptId}"`);
    lines.push(`  Error: ${issue.errorText}`);
  }

  return lines.join('\n');
}
