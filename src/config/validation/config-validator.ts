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
  ValidationSourceConfigId,
} from './contracts';

export const configValidationRules: ValidationRule[] = [new VarRefsExistRule()];

export interface ConfigValidatorAdditionalPayload {
  systemConfig: LlmCopypasterConfig;
  userConfig: LlmCopypasterUserConfig | null;
  extensionContext: vscode.ExtensionContext; // for toasters/reports
}

export class ConfigValidator {
  public async checkIsConfigValid(
    targetConfig: LlmCopypasterConfig,
    additionalPayload: ConfigValidatorAdditionalPayload
  ): Promise<boolean> {
    const zodValidationIssues = this._runStaticZodValidation(targetConfig);

    if (zodValidationIssues.length) {
      const zodValidationResult = this._buildValidationResult(zodValidationIssues);

      await this._showToastAndReportForValidationResult(zodValidationResult, additionalPayload.extensionContext);

      return false;
    }

    const businessValidationIssues = this._runBusinessValidation(targetConfig, additionalPayload);

    const deduplicatedValidationIssues = this._deduplicateValidationIssues(businessValidationIssues);

    const validationResult = this._buildValidationResult(deduplicatedValidationIssues);

    if (!validationResult.criticalIssues.length && !validationResult.warningIssues.length) return true;

    await this._showToastAndReportForValidationResult(validationResult, additionalPayload.extensionContext);

    return !validationResult.criticalIssues.length;
  }

  private _runStaticZodValidation(targetConfig: LlmCopypasterConfig): ValidationIssue[] {
    const zodValidationResult = llmCopypasterConfigSchema.safeParse(targetConfig);
    if (zodValidationResult.success) return [];

    return zodValidationResult.error.issues.map(zodIssue =>
      this._buildZodValidationIssue('systemUserMerged', zodIssue.path, zodIssue.message)
    );
  }

  private _runBusinessValidation(
    targetConfig: LlmCopypasterConfig,
    additionalPayload: ConfigValidatorAdditionalPayload
  ): ValidationIssue[] {
    return configValidationRules.flatMap(validationRule =>
      this._validateSingleRule(validationRule, targetConfig, additionalPayload)
    );
  }

  private _validateSingleRule(
    validationRule: ValidationRule,
    targetConfig: LlmCopypasterConfig,
    additionalPayload: ConfigValidatorAdditionalPayload
  ): ValidationIssue[] {
    const validationRuleContext: ValidationRuleContext = {
      sourceConfigId: 'systemUserMerged',
      mergedConfig: targetConfig,
      systemUserMergedConfig: targetConfig,
      systemConfig: additionalPayload.systemConfig,
      userConfig: additionalPayload.userConfig,
      rawOverrideConfig: null,
    };

    const violationDescription = validationRule.getViolationDescription(validationRuleContext);
    if (!violationDescription) return [];

    return [this._buildValidationIssue('systemUserMerged', validationRule, violationDescription)];
  }

  private _buildZodValidationIssue(
    sourceConfigId: ValidationSourceConfigId,
    zodIssuePath: (string | number)[],
    zodIssueMessage: string
  ): ValidationIssue {
    const normalizedPath = zodIssuePath.length ? zodIssuePath.join('.') : 'root';

    return {
      sourceConfigId,
      sources: [{ sourceConfigId }],
      violatedRuleName: 'Static Zod Config Schema Validation',
      ruleRationale: 'Config must match the static runtime schema before business-rule validation can safely run',
      violationDescription: `${normalizedPath}: ${zodIssueMessage}`,
      severity: ValidationIssueSeverity.Critical,
    };
  }

  private _buildValidationIssue(
    sourceConfigId: ValidationSourceConfigId,
    validationRule: ValidationRule,
    violationDescription: string
  ): ValidationIssue {
    return {
      sourceConfigId,
      sources: [{ sourceConfigId }],
      violatedRuleName: validationRule.name,
      ruleRationale: validationRule.rationale,
      violationDescription,
      severity: validationRule.severity,
    };
  }

  private _deduplicateValidationIssues(validationIssues: ValidationIssue[]): ValidationIssue[] {
    const validationIssuesByDeduplicationKey = new Map<string, ValidationIssue>();

    for (const validationIssue of validationIssues) {
      const deduplicationKey = this._buildValidationIssueDeduplicationKey(validationIssue);
      const existingValidationIssue = validationIssuesByDeduplicationKey.get(deduplicationKey);

      if (!existingValidationIssue) {
        validationIssuesByDeduplicationKey.set(deduplicationKey, validationIssue);

        continue;
      }

      existingValidationIssue.sources.push(...validationIssue.sources);
    }

    return Array.from(validationIssuesByDeduplicationKey.values());
  }

  private _buildValidationIssueDeduplicationKey(validationIssue: ValidationIssue): string {
    return `${validationIssue.violatedRuleName}::${validationIssue.violationDescription}`;
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

  private async _showToastAndReportForValidationResult(
    validationResult: ValidationResult,
    extensionContext: vscode.ExtensionContext
  ): Promise<void> {
    const toastActionOpenDetails = 'Open Details In Editor';
    const toastMessage = this._buildValidationToastMessage(validationResult);

    // if any critical issues show Error Toast, otherwise Warning Toast (no-issues case handled above).
    // Recommendations do not trigger Toast do not spam
    const clickedAction = validationResult.criticalIssues.length
      ? await vscode.window.showErrorMessage(toastMessage, toastActionOpenDetails)
      : await vscode.window.showWarningMessage(toastMessage, toastActionOpenDetails);

    if (clickedAction === toastActionOpenDetails) {
      await new ConfigValidationReporter({
        extensionContext,
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
