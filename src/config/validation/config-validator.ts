import * as vscode from 'vscode';
import { OverrideOptionMetadata } from '../contracts/other-contracts';
import { LlmCopypasterConfig, llmCopypasterConfigSchema } from '../contracts/system-config-contracts';
import { LlmCopypasterUserConfig } from '../contracts/user-config-contracts';
import { mergeConfigs } from '../helpers/config-mergers';
import { ConfigValidationReporter } from './config-validation-reporter';
import {
  ValidationIssue,
  ValidationIssueSeverity,
  ValidationResult,
  ValidationRule,
  ValidationRuleContext,
  ValidationSourceConfigId,
  ValidationTargetConfig,
} from './contracts';

export const configValidationRules: ValidationRule[] = []; // new VarRefsExistRule()

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
    const validationTargets = this._buildValidationTargets();

    const zodValidationIssues = this._runStaticZodValidation(validationTargets);

    const businessValidationIssues = this._runBusinessValidation(validationTargets);

    const deduplicatedValidationIssues = this._deduplicateValidationIssues([
      ...zodValidationIssues,
      ...businessValidationIssues,
    ]);

    const validationResult = new ValidationResult(deduplicatedValidationIssues);

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

    return !validationResult.criticalIssues.length;
  }

  private _runStaticZodValidation(validationTargets: ValidationTargetConfig[]): ValidationIssue[] {
    return validationTargets.flatMap(validationTarget => {
      const zodValidationResult = llmCopypasterConfigSchema.safeParse(validationTarget.mergedConfig);
      if (zodValidationResult.success) return [];

      return zodValidationResult.error.issues.map(zodIssue =>
        this._buildZodValidationIssue(validationTarget.sourceConfigId, zodIssue.path, zodIssue.message)
      );
    });
  }

  private _runBusinessValidation(validationTargets: ValidationTargetConfig[]): ValidationIssue[] {
    return validationTargets.flatMap(validationTarget => this._validateSingleTarget(validationTarget));
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
    const applicableValidationRules = configValidationRules.filter(validationRule => {
      if (!validationTarget.rawOverrideConfig) return true;

      return !validationRule.skipForOverrides;
    });

    return applicableValidationRules.flatMap(validationRule => {
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

  private _buildValidationToastMessage(validationResult: ValidationResult): string {
    const criticalIssuesCount = validationResult.criticalIssues.length;
    const warningIssuesCount = validationResult.warningIssues.length;

    const issuesSummaryParts: string[] = [];

    if (criticalIssuesCount) issuesSummaryParts.push(`${criticalIssuesCount} critical`);
    if (warningIssuesCount) issuesSummaryParts.push(`${warningIssuesCount} warning`);

    return `Config validation found ${issuesSummaryParts.join(' and ')} issue(s)`;
  }
}
