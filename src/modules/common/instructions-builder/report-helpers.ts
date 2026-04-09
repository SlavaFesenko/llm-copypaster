import * as vscode from 'vscode';

import { ensureReadonlyVirtualMarkdownDocOpened } from '../../../utils/editor-virtual-doc-helpers';

export interface InstructionsResolveIssuesBag {
  instructionFileIssues: InstructionFileIssue[];
  liquidJsIssues: LiquidJsResolveIssue[];
}

export interface InstructionFileIssue {
  instructionId: string;
  rawFilePathFromConfig: string;
  resolvedFileUri?: string;
  errorText: string;
}

export interface LiquidJsResolveIssue {
  instructionId: string;
  errorText: string;
}

export async function buildAndShowNotification(args: {
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

  sections.push(`## Instruction File Resolve Issues`);
  sections.push(buildFilePromptsIssuesMarkdown(resolveIssues.instructionFileIssues));
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
    lines.push(`  Path: "${issue.rawFilePathFromConfig}"`);
    if (issue.resolvedFileUri) lines.push(`  Uri: "${issue.resolvedFileUri}"`);
    lines.push(`  Error: ${issue.errorText}`);
  }

  return lines.join('\n');
}

function buildLiquidJsIssuesMarkdown(liquidJsIssues: LiquidJsResolveIssue[]): string {
  if (liquidJsIssues.length === 0) return `No issues`;

  const lines: string[] = [];

  for (const issue of liquidJsIssues) {
    lines.push(`- Prompt id: "${issue.instructionId}"`);
    lines.push(`  Error: ${issue.errorText}`);
  }

  return lines.join('\n');
}
