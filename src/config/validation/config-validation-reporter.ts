import * as vscode from 'vscode';
import { ensureReadonlyVirtualMarkdownDocOpened } from '../../utils/editor-virtual-doc-helpers';
import { ValidationIssue, ValidationResult } from './contracts';

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
  reportText += `- Critical issues: ${validationResult.criticalIssues.length}\n`;
  reportText += `- Warning issues: ${validationResult.warningIssues.length}\n`;
  reportText += `- Recommendations: ${validationResult.recommendationIssues.length}\n\n`;

  reportText += buildValidatedConfigsSectionsMarkdown(validationResult);

  return reportText.trimEnd();
}

function buildValidatedConfigsSectionsMarkdown(validationResult: ValidationResult): string {
  let sectionsMarkdown = '';

  for (const validatedConfigName of validationResult.validatedConfigNames) {
    const criticalIssues = validationResult.criticalIssues.filter(
      validationIssue => validationIssue.targetConfigName === validatedConfigName
    );
    const warningIssues = validationResult.warningIssues.filter(
      validationIssue => validationIssue.targetConfigName === validatedConfigName
    );
    const recommendationIssues = validationResult.recommendationIssues.filter(
      validationIssue => validationIssue.targetConfigName === validatedConfigName
    );

    if (!criticalIssues.length && !warningIssues.length && !recommendationIssues.length) continue;

    sectionsMarkdown += `## ${validatedConfigName}\n\n`;

    const criticalIssuesSectionMarkdown = buildValidationIssuesSectionMarkdown('Critical Issues', criticalIssues);
    if (criticalIssuesSectionMarkdown) sectionsMarkdown += `${criticalIssuesSectionMarkdown}\n\n`;

    const warningIssuesSectionMarkdown = buildValidationIssuesSectionMarkdown('Warning Issues', warningIssues);
    if (warningIssuesSectionMarkdown) sectionsMarkdown += `${warningIssuesSectionMarkdown}\n\n`;

    const recommendationIssuesSectionMarkdown = buildValidationIssuesSectionMarkdown(
      'Recommendations',
      recommendationIssues
    );
    if (recommendationIssuesSectionMarkdown) sectionsMarkdown += `${recommendationIssuesSectionMarkdown}\n\n`;
  }

  return sectionsMarkdown.trimEnd();
}

function buildValidationIssuesSectionMarkdown(sectionTitle: string, validationIssues: ValidationIssue[]): string {
  if (!validationIssues.length) return '';

  let sectionMarkdown = `### ${sectionTitle}\n\n`;

  for (const validationIssue of validationIssues) {
    sectionMarkdown += `${buildValidationIssueHeader(validationIssue)}\n\n`;
    sectionMarkdown += `- Violation: ${validationIssue.violationDescription}\n`;
    sectionMarkdown += `- Rationale: ${validationIssue.ruleRationale}\n\n`;
  }

  return sectionMarkdown.trimEnd();
}

function buildValidationIssueHeader(validationIssue: ValidationIssue): string {
  return `#### Violated Rule: ${validationIssue.violatedRuleName}`;
}
