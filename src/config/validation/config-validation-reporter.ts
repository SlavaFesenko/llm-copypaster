import * as vscode from 'vscode';
import { ensureReadonlyVirtualMarkdownDocOpened } from '../../utils/editor-virtual-doc-helpers';
import { ValidationIssue, ValidationIssueSource, ValidationResult } from './contracts';

export interface ConfigValidationReporterArgs {
  extensionContext: vscode.ExtensionContext;
  validationResult: ValidationResult;
}

export class ConfigValidationReporter {
  public constructor(private readonly _args: ConfigValidationReporterArgs) {}

  public async displayValidationReport(): Promise<void> {
    const reportText = buildConfigValidationReportText(this._args.validationResult);

    await ensureReadonlyVirtualMarkdownDocOpened({
      extensionContext: this._args.extensionContext,
      docId: 'config-validation',
      markdownText: reportText,
    });
  }
}

export function buildConfigValidationReportText(validationResult: ValidationResult): string {
  let reportText = '';

  reportText += '# Config Validation Report\n\n';
  reportText += `- Is valid: ${validationResult.isValid}\n`;
  reportText += `- Critical issues: ${validationResult.criticalIssues.length}\n`;
  reportText += `- Warning issues: ${validationResult.warningIssues.length}\n`;
  reportText += `- Recommendations: ${validationResult.recommendations.length}\n\n`;

  reportText += buildValidationIssuesSectionMarkdown('Critical Issues', validationResult.criticalIssues);
  reportText += '\n\n';
  reportText += buildValidationIssuesSectionMarkdown('Warning Issues', validationResult.warningIssues);
  reportText += '\n\n';
  reportText += buildValidationIssuesSectionMarkdown('Recommendations', validationResult.recommendations);

  return reportText.trimEnd();
}

function buildValidationIssuesSectionMarkdown(sectionTitle: string, validationIssues: ValidationIssue[]): string {
  let sectionMarkdown = `## ${sectionTitle}\n\n`;

  if (!validationIssues.length) {
    sectionMarkdown += '_No issues found_';

    return sectionMarkdown;
  }

  for (const validationIssue of validationIssues) {
    sectionMarkdown += `${buildValidationIssueHeader(validationIssue)}\n\n`;
    sectionMarkdown += `- Severity: ${validationIssue.severity}\n`;
    sectionMarkdown += `- Rationale: ${validationIssue.ruleRationale}\n`;
    sectionMarkdown += `- Violation Description: ${validationIssue.violationDescription}\n`;
    sectionMarkdown += `- Sources:\n${buildValidationIssueSourcesMarkdown(validationIssue.sources)}\n\n`;
  }

  return sectionMarkdown.trimEnd();
}

function buildValidationIssueHeader(validationIssue: ValidationIssue): string {
  return `### Violated Rule: ${validationIssue.violatedRuleId}`;
}

function buildValidationIssueSourcesMarkdown(validationIssueSources: ValidationIssueSource[]): string {
  return validationIssueSources
    .map(validationIssueSource => `  - ${buildValidationIssueSourceLabel(validationIssueSource)}`)
    .join('\n');
}

function buildValidationIssueSourceLabel(validationIssueSource: ValidationIssueSource): string {
  if (validationIssueSource.sourceConfigId === 'systemUserMerged') {
    return 'System + User Merged Config';
  }

  return `OVERRIDE: ${validationIssueSource.sourceConfigId}`;
}
