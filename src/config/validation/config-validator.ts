import * as vscode from 'vscode';
import { OverrideOptionMetadata } from '../contracts/other-contracts';
import { LlmCopypasterConfig } from '../contracts/system-config-contracts';
import { LlmCopypasterUserConfig } from '../contracts/user-config-contracts';
import { mergeConfigs } from '../helpers/config-mergers';
import { ConfigValidationReporter } from './config-validation-reporter';
import {
  ValidationIssue,
  ValidationResult,
  ValidationRule,
  ValidationRuleContext,
  ValidationSourceConfigId,
  ValidationTargetConfig,
} from './contracts';
import { allVitalParsingAnchorsAreLongerThan2CharsRule } from './rules/all-vitalParsingAnchors-are-longer-than-2-chars';

export const configValidationRules: ValidationRule[] = [allVitalParsingAnchorsAreLongerThan2CharsRule];

export interface ConfigValidatorArgs {
  extensionContext: vscode.ExtensionContext;
  systemUserMergedConfig: LlmCopypasterConfig;
  systemConfig: LlmCopypasterConfig;
  userConfig: LlmCopypasterUserConfig | null;
  overrideOptions: OverrideOptionMetadata[] | null;
}

export class ConfigValidator {
  public constructor(private readonly _args: ConfigValidatorArgs) {}

  public async validate(): Promise<boolean> {
    const validationResult = this._buildValidationResult();

    if (validationResult.isValid) return true;

    const toastActionOpenDetails = 'Open Details In Editor';
    const toastMessage = this._buildValidationToastMessage(validationResult);

    // if any critical issues show Error Toast, otherwise Warning Toast (no-issues case handled above).
    // Recommendations do not trigger Toast do not spam
    const clickedAction = validationResult.criticalIssues.length
      ? await vscode.window.showErrorMessage(toastMessage, toastActionOpenDetails)
      : await vscode.window.showWarningMessage(toastMessage, toastActionOpenDetails);

    if (clickedAction === toastActionOpenDetails) {
      await new ConfigValidationReporter({
        extensionContext: this._args.extensionContext,
        validationResult,
      }).displayValidationReport();
    }

    return false;
  }

  private _buildValidationResult(): ValidationResult {
    const validationTargets = this._buildValidationTargets();
    const validationIssues = validationTargets.flatMap(validationTarget => this._validateSingleTarget(validationTarget));

    return new ValidationResult(validationIssues);
  }

  private _buildValidationTargets(): ValidationTargetConfig[] {
    const validationTargets: ValidationTargetConfig[] = [
      {
        sourceConfigId: 'systemUserMerged',
        mergedConfig: this._args.systemUserMergedConfig,
        rawOverrideConfig: null,
      },
    ];

    for (const overrideOption of this._args.overrideOptions ?? []) {
      const rawOverrideConfig = this._args.userConfig?.overridesById?.[overrideOption.id] ?? null;
      const overrideCoreSettings = rawOverrideConfig?.coreSettings;

      validationTargets.push({
        sourceConfigId: overrideOption.id,
        mergedConfig: overrideCoreSettings
          ? mergeConfigs(this._args.systemUserMergedConfig, {
              coreSettings: overrideCoreSettings,
            })
          : this._args.systemUserMergedConfig,
        rawOverrideConfig,
      });
    }

    return validationTargets;
  }

  private _validateSingleTarget(validationTarget: ValidationTargetConfig): ValidationIssue[] {
    return configValidationRules.flatMap(validationRule => {
      const validationRuleContext: ValidationRuleContext = {
        sourceConfigId: validationTarget.sourceConfigId,
        mergedConfig: validationTarget.mergedConfig,
        systemUserMergedConfig: this._args.systemUserMergedConfig,
        systemConfig: this._args.systemConfig,
        userConfig: this._args.userConfig,
        rawOverrideConfig: validationTarget.rawOverrideConfig,
      };

      const violationDescription = validationRule.getViolationDescription(validationRuleContext);
      if (!violationDescription) return [];

      return [this._buildValidationIssue(validationTarget.sourceConfigId, validationRule, violationDescription)];
    });
  }

  private _buildValidationIssue(
    sourceConfigId: ValidationSourceConfigId,
    validationRule: ValidationRule,
    violationDescription: string
  ): ValidationIssue {
    return {
      sourceConfigId,
      violatedRuleId: validationRule.id,
      ruleRationale: validationRule.rationale,
      violationDescription,
      severity: validationRule.severity,
    };
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
