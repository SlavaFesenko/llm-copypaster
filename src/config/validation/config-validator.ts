import * as vscode from 'vscode';
import { LlmCopypasterConfig, llmCopypasterConfigSchema } from '../contracts/system-config-contracts';
import { LlmCopypasterUserConfig } from '../contracts/user-config-contracts';
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

  public async validateConfig(
    targetConfig: LlmCopypasterConfig,
    targetConfigName: string,
    systemConfig: LlmCopypasterConfig,
    userConfig: LlmCopypasterUserConfig | null
  ): Promise<boolean> {
    const validationResults: ValidationResult[] = [await this._validateSystemTypeConfig(systemConfig, 'System Config')];

    if (userConfig !== null) {
      validationResults.push(
        await this._validateUserTypeConfig(userConfig),
        await this._validateSystemTypeConfig(targetConfig, targetConfigName)
      );
    }

    const aggregatedValidationResult: ValidationResult = {
      validatedConfigNames: Array.from(
        new Set(validationResults.flatMap(validationResult => validationResult.validatedConfigNames))
      ),
      criticalIssues: validationResults.flatMap(validationResult => validationResult.criticalIssues),
      warningIssues: validationResults.flatMap(validationResult => validationResult.warningIssues),
      recommendationIssues: validationResults.flatMap(validationResult => validationResult.recommendationIssues),
    };

    if (aggregatedValidationResult.criticalIssues.length || aggregatedValidationResult.warningIssues.length)
      await this._showToastAndReportForValidationResult(aggregatedValidationResult);

    return !aggregatedValidationResult.criticalIssues.length;
  }

  private async _validateUserTypeConfig(userConfig: LlmCopypasterUserConfig | null): Promise<ValidationResult> {
    void userConfig;

    return this._buildValidationResult([], ['User Config']);
  }

  private async _validateSystemTypeConfig(
    targetConfig: LlmCopypasterConfig,
    targetConfigName: string
  ): Promise<ValidationResult> {
    const validationIssues: ValidationIssue[] = [];

    const zodValidationResult = llmCopypasterConfigSchema.safeParse(targetConfig);

    if (!zodValidationResult.success) {
      validationIssues.push(
        ...zodValidationResult.error.issues.map(zodIssue => {
          const normalizedPath = zodIssue.path.length ? zodIssue.path.join('.') : 'root';

          return {
            targetConfigName,
            violatedRuleName: 'Static Zod Config Schema Validation',
            ruleRationale: 'Config must match the static runtime schema before business-rule validation can safely run',
            violationDescription: `${normalizedPath}: ${zodIssue.message}`,
            severity: ValidationIssueSeverity.Critical,
          };
        })
      );
    }

    for (const validationRule of configValidationRules) {
      const validationRuleContext: ValidationRuleContext = {
        targetConfigName,
        targetConfig: targetConfig,
      };

      const violationDescription = validationRule.getViolationDescription(validationRuleContext);
      if (!violationDescription) continue;

      validationIssues.push({
        targetConfigName,
        violatedRuleName: validationRule.name,
        ruleRationale: validationRule.rationale,
        violationDescription,
        severity: validationRule.severity,
      });
    }

    return this._buildValidationResult(validationIssues, [targetConfigName]);
  }

  private _buildValidationResult(
    validationIssues: ValidationIssue[],
    validatedConfigNames: string[] = []
  ): ValidationResult {
    return {
      validatedConfigNames,
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
