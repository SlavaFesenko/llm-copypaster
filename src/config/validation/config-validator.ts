import * as vscode from 'vscode';
import { SystemConfig } from '../contracts/system-config-contracts';
import { UserConfig } from '../contracts/user-config-contracts';
import { ConfigValidationReporter } from './config-validation-reporter';
import {
  ValidationIssue,
  ValidationIssueSeverity,
  ValidationResult,
  ValidationRule,
  ValidationRuleContext,
} from './contracts';
import { OverridesValidationPlaceholderRule } from './validation-rules/overrides-validation-placeholder-rule';
import { SystemConfigSchemaValidationRule } from './validation-rules/system-config-schema-validation-rule';
import { UserConfigSchemaValidationRule } from './validation-rules/user-config-schema-validation-rule';
import { VarRefsExistRule } from './validation-rules/var-refs-exists-rule';

export const systemConfigValidationRules: ValidationRule[] = [
  new SystemConfigSchemaValidationRule(),
  new VarRefsExistRule(),
];

export const userConfigValidationRules: ValidationRule[] = [
  new UserConfigSchemaValidationRule(),
  new OverridesValidationPlaceholderRule(),
];

export class ConfigValidator {
  public constructor(private readonly _extensionContext: vscode.ExtensionContext) {}

  public async validateConfig(
    targetConfig: SystemConfig,
    targetConfigName: string,
    systemConfig: SystemConfig,
    userConfig: UserConfig | null
  ): Promise<boolean> {
    const validationResults: ValidationResult[] = [
      this._validateWithRules(targetConfig, targetConfigName, systemConfig, userConfig, systemConfigValidationRules),
    ];

    if (userConfig !== null) {
      validationResults.push(
        this._validateWithRules(targetConfig, 'User Config', systemConfig, userConfig, userConfigValidationRules)
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

  private _validateWithRules(
    targetConfig: SystemConfig,
    targetConfigName: string,
    systemConfig: SystemConfig,
    userConfig: UserConfig | null,
    validationRules: ValidationRule[]
  ): ValidationResult {
    const validationRuleContext: ValidationRuleContext = {
      targetConfigName,
      targetConfig,
      systemConfig,
      userConfig,
    };

    const validationIssues: ValidationIssue[] = validationRules.flatMap(validationRule =>
      validationRule.getViolationDescriptions(validationRuleContext).map(violationDescription => ({
        targetConfigName,
        violatedRuleName: validationRule.name,
        ruleRationale: validationRule.rationale,
        violationDescription,
        severity: validationRule.severity,
      }))
    );

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
