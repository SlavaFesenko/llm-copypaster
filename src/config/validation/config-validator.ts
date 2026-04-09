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
import { SuppressWarningIssuesToastRule } from './validation-rules/suppress-warning-issues-toast-recommendation-rule';
import { SystemConfigSchemaValidationRule } from './validation-rules/system-config-schema-validation-rule';
import { UserConfigSchemaValidationRule } from './validation-rules/user-config-schema-validation-rule';
import { VarRefsExistRule } from './validation-rules/var-refs-exists-rule';

const systemUserMergedConfigName = 'System-User Merged Config';
const systemUserMergedConfigWithOverridesNamePrefix = 'System-User Merged Config + Overrides: ';

export const systemConfigValidationRules: ValidationRule[] = [
  new SystemConfigSchemaValidationRule(),
  new VarRefsExistRule(),
  new SuppressWarningIssuesToastRule(),
];

export const userConfigValidationRules: ValidationRule[] = [new UserConfigSchemaValidationRule()];

export class ConfigValidator {
  private _hasShownStartupRecommendationIssuesToast = false;
  private _hasShownStartupNoIssuesToast = false;

  public constructor(private readonly _extensionContext: vscode.ExtensionContext) {}

  public async validate(
    targetConfig: SystemConfig,
    systemConfig: SystemConfig,
    userConfig: UserConfig | null,
    overrideIds?: string[],
    fireAndForgetNotifications: boolean = false
  ): Promise<boolean> {
    const aggregatedValidationResult = this._buildAggregatedValidationResult(
      targetConfig,
      this._buildTargetConfigName(overrideIds),
      systemConfig,
      userConfig
    );

    if (aggregatedValidationResult.criticalIssues.length) {
      await this._showCriticalIssuesToast(aggregatedValidationResult, fireAndForgetNotifications);

      return false;
    }

    if (aggregatedValidationResult.warningIssues.length) {
      await this._showWarningIssuesToast(aggregatedValidationResult, targetConfig, fireAndForgetNotifications);

      return true;
    }

    // no need to spam user in case he doesn't have user-config and system config is not seriously wrong for some buggy reason
    if (userConfig === null) return true;

    if (aggregatedValidationResult.recommendationIssues.length) {
      await this._showStartupRecommendationIssuesToast(aggregatedValidationResult, targetConfig, fireAndForgetNotifications);

      return true;
    }

    if (!this._hasShownStartupNoIssuesToast) await this._showStartupNoIssuesToast(targetConfig, fireAndForgetNotifications);

    return true;
  }

  private _buildTargetConfigName(overrideIds?: string[]): string {
    if (!overrideIds?.length) return systemUserMergedConfigName;

    return `${systemUserMergedConfigWithOverridesNamePrefix}${overrideIds.join(', ')}`;
  }

  private _buildAggregatedValidationResult(
    targetConfig: SystemConfig,
    targetConfigName: string,
    systemConfig: SystemConfig,
    userConfig: UserConfig | null
  ): ValidationResult {
    const validationResults: ValidationResult[] = [
      this._validateWithRules(targetConfig, targetConfigName, systemConfig, userConfig, systemConfigValidationRules),
    ];

    if (userConfig !== null) {
      validationResults.push(
        this._validateWithRules(targetConfig, 'User Config', systemConfig, userConfig, userConfigValidationRules)
      );
    }

    return {
      validatedConfigNames: Array.from(
        new Set(validationResults.flatMap(validationResult => validationResult.validatedConfigNames))
      ),
      criticalIssues: validationResults.flatMap(validationResult => validationResult.criticalIssues),
      warningIssues: validationResults.flatMap(validationResult => validationResult.warningIssues),
      recommendationIssues: validationResults.flatMap(validationResult => validationResult.recommendationIssues),
    };
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
        fixTip: validationRule.fixTip,
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

  private async _showCriticalIssuesToast(
    validationResult: ValidationResult,
    fireAndForgetNotifications: boolean
  ): Promise<void> {
    await this._showToastWithOptionalReport(
      this._buildCriticalIssuesToastMessage(validationResult),
      'error',
      validationResult,
      fireAndForgetNotifications
    );
  }

  private async _showWarningIssuesToast(
    validationResult: ValidationResult,
    targetConfig: SystemConfig,
    fireAndForgetNotifications: boolean
  ): Promise<void> {
    if (targetConfig.presetIndependentSettings.notificationSettings.configValidation.suppressWarningIssuesToast) return;

    await this._showToastWithOptionalReport(
      this._buildWarningIssuesToastMessage(validationResult),
      'warning',
      validationResult,
      fireAndForgetNotifications
    );
  }

  private async _showStartupRecommendationIssuesToast(
    validationResult: ValidationResult,
    targetConfig: SystemConfig,
    fireAndForgetNotifications: boolean
  ): Promise<void> {
    if (this._hasShownStartupRecommendationIssuesToast) return;

    if (targetConfig.presetIndependentSettings.notificationSettings.configValidation.suppressRecommendationIssuesToast)
      return;

    this._hasShownStartupRecommendationIssuesToast = true;

    await this._showToastWithOptionalReport(
      this._buildRecommendationIssuesToastMessage(validationResult),
      'info',
      validationResult,
      fireAndForgetNotifications
    );
  }

  private async _showStartupNoIssuesToast(targetConfig: SystemConfig, fireAndForgetNotifications: boolean): Promise<void> {
    if (targetConfig.presetIndependentSettings.notificationSettings.configValidation.suppressNoIssuesToast) return;

    this._hasShownStartupNoIssuesToast = true;

    if (!fireAndForgetNotifications) {
      await vscode.window.showInformationMessage(`Config validation succeeded!`, "Let's go!");

      return;
    }

    void vscode.window.showInformationMessage(`Config validation succeeded!`, "Let's go!");
  }

  private async _showToastWithOptionalReport(
    toastMessage: string,
    toastSeverity: 'error' | 'warning' | 'info',
    validationResult: ValidationResult,
    fireAndForgetNotifications: boolean
  ): Promise<void> {
    const toastActionOpenDetails = 'Open Details In Editor';
    const toastPromise = this._showToastMessage(toastMessage, toastSeverity, toastActionOpenDetails);

    // Needed for startup validation triggered from extension.activate()
    // if we await this toast and user ignores it, VS Code keeps the promise unresolved
    // so activate() never completes and the app looks dead until the toast is closed or clicked by user.
    // if toast is closed by timeout - app remains dead :=)
    if (fireAndForgetNotifications) {
      void toastPromise.then(async clickedAction => {
        if (clickedAction !== toastActionOpenDetails) return;

        await new ConfigValidationReporter({
          extensionContext: this._extensionContext,
          validationResult,
        }).displayValidationReport();
      });

      return;
    }

    const clickedAction = await toastPromise;

    if (clickedAction !== toastActionOpenDetails) return;

    await new ConfigValidationReporter({
      extensionContext: this._extensionContext,
      validationResult,
    }).displayValidationReport();
  }

  private _showToastMessage(
    toastMessage: string,
    toastSeverity: 'error' | 'warning' | 'info',
    toastActionOpenDetails: string
  ): Thenable<string | undefined> {
    switch (toastSeverity) {
      case 'error':
        return vscode.window.showErrorMessage(toastMessage, toastActionOpenDetails);

      case 'warning':
        return vscode.window.showWarningMessage(toastMessage, toastActionOpenDetails);

      default:
        return vscode.window.showInformationMessage(toastMessage, toastActionOpenDetails);
    }
  }

  private _buildCriticalIssuesToastMessage(validationResult: ValidationResult): string {
    return `Config validation found ${validationResult.criticalIssues.length} critical issue(s). Using system config only`;
  }

  private _buildWarningIssuesToastMessage(validationResult: ValidationResult): string {
    return `Config validation found ${validationResult.warningIssues.length} warning issue(s)`;
  }

  private _buildRecommendationIssuesToastMessage(validationResult: ValidationResult): string {
    return `Config validation found ${validationResult.recommendationIssues.length} recommendation(s)`;
  }
}
