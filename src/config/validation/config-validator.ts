import * as vscode from 'vscode';
import { LlmCopypasterConfig, llmCopypasterConfigSchema } from '../contracts/system-config-contracts';
import { VarRefsExistRule } from './business-rules/var-refs-exists-rule';
import { ConfigValidationReporter } from './config-validation-reporter';
import {
  ValidationIssue,
  ValidationIssueSeverity,
  ValidationResult,
  ValidationRule,
  ValidationRuleContext,
} from './contracts';

export const configValidationRules: ValidationRule[] = [new VarRefsExistRule()];

export class ConfigValidator {
  public constructor(private readonly _extensionContext: vscode.ExtensionContext) {}

  public async checkIsConfigValid(targetConfig: LlmCopypasterConfig, targetConfigName: string): Promise<boolean> {
    const staticValidationResult = await this._runStaticValidationStep(targetConfig, targetConfigName);
    if (staticValidationResult.criticalIssues.length) return false;

    const businessValidationResult = await this._runBusinessValidationStep(targetConfig, targetConfigName);
    if (businessValidationResult.criticalIssues.length) return false;

    return true;
  }

  private async _runStaticValidationStep(
    targetConfig: LlmCopypasterConfig,
    targetConfigName: string
  ): Promise<ValidationResult> {
    const zodValidationResult = llmCopypasterConfigSchema.safeParse(targetConfig);

    const staticValidationIssues = zodValidationResult.success
      ? []
      : zodValidationResult.error.issues.map(zodIssue =>
          this._buildZodValidationIssue(targetConfigName, zodIssue.path, zodIssue.message)
        );

    const staticValidationResult = this._buildValidationResult(staticValidationIssues);

    if (staticValidationResult.criticalIssues.length || staticValidationResult.warningIssues.length)
      await this._showToastAndReportForValidationResult(staticValidationResult);

    return staticValidationResult;
  }

  private async _runBusinessValidationStep(
    targetConfig: LlmCopypasterConfig,
    targetConfigName: string
  ): Promise<ValidationResult> {
    const businessValidationIssues = configValidationRules.flatMap(validationRule => {
      const validationRuleContext: ValidationRuleContext = {
        targetConfigName,
        targetConfig: targetConfig,
      };

      const violationDescription = validationRule.getViolationDescription(validationRuleContext);
      if (!violationDescription) return [];

      return [this._buildValidationIssue(targetConfigName, validationRule, violationDescription)];
    });

    const businessValidationResult = this._buildValidationResult(businessValidationIssues);

    if (businessValidationResult.criticalIssues.length || businessValidationResult.warningIssues.length)
      await this._showToastAndReportForValidationResult(businessValidationResult);

    return businessValidationResult;
  }

  private _buildZodValidationIssue(
    targetConfigName: string,
    zodIssuePath: (string | number)[],
    zodIssueMessage: string
  ): ValidationIssue {
    const normalizedPath = zodIssuePath.length ? zodIssuePath.join('.') : 'root';

    return {
      targetConfigName,
      violatedRuleName: 'Static Zod Config Schema Validation',
      ruleRationale: 'Config must match the static runtime schema before business-rule validation can safely run',
      violationDescription: `${normalizedPath}: ${zodIssueMessage}`,
      severity: ValidationIssueSeverity.Critical,
    };
  }

  private _buildValidationIssue(
    targetConfigName: string,
    validationRule: ValidationRule,
    violationDescription: string
  ): ValidationIssue {
    return {
      targetConfigName,
      violatedRuleName: validationRule.name,
      ruleRationale: validationRule.rationale,
      violationDescription,
      severity: validationRule.severity,
    };
  }

  private _buildValidationResult(validationIssues: ValidationIssue[]): ValidationResult {
    return {
      criticalIssues: validationIssues.filter(
        validationIssue => validationIssue.severity === ValidationIssueSeverity.Critical
      ),
      warningIssues: validationIssues.filter(
        validationIssue => validationIssue.severity === ValidationIssueSeverity.Warning
      ),
      recommendationIssues: validationIssues.filter(
        validationIssue => validationIssue.severity === ValidationIssueSeverity.Recommendation
      ),
    };
  }

  private async _showToastAndReportForValidationResult(validationResult: ValidationResult): Promise<void> {
    const toastActionOpenDetails = 'Open Details In Editor';
    const toastMessage = this._buildValidationToastMessage(validationResult);

    // if any critical issues show Error Toast, otherwise Warning Toast (no-issues case handled above).
    // Recommendations do not trigger Toast do not spam
    const clickedAction = validationResult.criticalIssues.length
      ? await vscode.window.showErrorMessage(toastMessage, toastActionOpenDetails)
      : await vscode.window.showWarningMessage(toastMessage, toastActionOpenDetails);

    if (clickedAction === toastActionOpenDetails) {
      await new ConfigValidationReporter({
        extensionContext: this._extensionContext,
        validationResult,
      }).displayValidationReport();
    }
  }

  private _buildValidationToastMessage(validationResult: ValidationResult): string {
    const criticalIssuesCount = validationResult.criticalIssues.length;
    const warningIssuesCount = validationResult.warningIssues.length;

    const issuesSummaryParts: string[] = [];

    if (criticalIssuesCount) issuesSummaryParts.push(`${criticalIssuesCount} critical`);
    if (warningIssuesCount) issuesSummaryParts.push(`${warningIssuesCount} warning`);

    return `Config validation found ${issuesSummaryParts.join(' and ')} issue(s)`;
  }
}
