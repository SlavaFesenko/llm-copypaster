import * as vscode from 'vscode';

import { ensureReadonlyVirtualMarkdownDocOpened } from './editor-virtual-doc-helpers';

export interface TechPromptResolveIssues {
  filePromptsIssues: FilePromptResolveIssue[];
  configVariablesIssues: ConfigVariablesResolveIssue[];
  liquidJsIssues: LiquidJsResolveIssue[];
}

export interface FilePromptResolveIssue {
  promptId: string;
  source: 'extension' | 'workspace';
  relativePathToSubInstruction: string;
  promptUriString?: string;
  errorText: string;
}

export interface ConfigVariablesResolveIssue {
  sharedVariableId: string;
  rawTemplate: string;
  errorText: string;
}

export interface LiquidJsResolveIssue {
  promptId: string;
  errorText: string;
}

export function showTechPromptResolveIssuesIfAny(args: {
  extensionContext: vscode.ExtensionContext;
  resolveIssues: TechPromptResolveIssues;
}): void {
  const issuesCount = countTechPromptResolveIssues(args.resolveIssues);
  if (issuesCount === 0) return;

  void showTechPromptResolveIssuesNotification({
    extensionContext: args.extensionContext,
    resolveIssues: args.resolveIssues,
    issuesCount,
  });
}

function countTechPromptResolveIssues(resolveIssues: TechPromptResolveIssues): number {
  return (
    resolveIssues.filePromptsIssues.length + resolveIssues.configVariablesIssues.length + resolveIssues.liquidJsIssues.length
  );
}

async function showTechPromptResolveIssuesNotification(args: {
  extensionContext: vscode.ExtensionContext;
  resolveIssues: TechPromptResolveIssues;
  issuesCount: number;
}): Promise<void> {
  const selection = await vscode.window.showWarningMessage(
    `Tech prompt resolve issues detected: ${args.issuesCount} error(s)`,
    'Show Report'
  );

  if (selection !== 'Show Report') return;

  const markdownText = buildTechPromptResolveIssuesMarkdownReport(args.resolveIssues, args.issuesCount);

  await ensureReadonlyVirtualMarkdownDocOpened({
    extensionContext: args.extensionContext,
    docId: 'resolve-report',
    markdownText,
  });
}

function buildTechPromptResolveIssuesMarkdownReport(resolveIssues: TechPromptResolveIssues, issuesCount: number): string {
  const sections: string[] = [];

  sections.push(`# Tech Prompt Resolve Report`);
  sections.push(`Total errors: ${issuesCount}`);
  sections.push('');

  sections.push(`## File Prompts Resolve Issues`);
  sections.push(buildFilePromptsIssuesMarkdown(resolveIssues.filePromptsIssues));
  sections.push('');

  sections.push(`## Config Varaibles Resolve Issues`);
  sections.push(buildConfigVariablesIssuesMarkdown(resolveIssues.configVariablesIssues));
  sections.push('');

  sections.push(`## LiquidJS Issues`);
  sections.push(buildLiquidJsIssuesMarkdown(resolveIssues.liquidJsIssues));
  sections.push('');

  return sections.join('\n');
}

function buildFilePromptsIssuesMarkdown(filePromptsIssues: FilePromptResolveIssue[]): string {
  if (filePromptsIssues.length === 0) return `No issues`;

  const lines: string[] = [];

  for (const issue of filePromptsIssues) {
    lines.push(`- Prompt id: "${issue.promptId}"`);
    lines.push(`  Source: "${issue.source}"`);
    lines.push(`  Path: "${issue.relativePathToSubInstruction}"`);
    if (issue.promptUriString) lines.push(`  Uri: "${issue.promptUriString}"`);
    lines.push(`  Error: ${issue.errorText}`);
  }

  return lines.join('\n');
}

function buildConfigVariablesIssuesMarkdown(configVariablesIssues: ConfigVariablesResolveIssue[]): string {
  if (configVariablesIssues.length === 0) return `No issues`;

  const lines: string[] = [];

  for (const issue of configVariablesIssues) {
    lines.push(`- Shared var id: "${issue.sharedVariableId}"`);
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
