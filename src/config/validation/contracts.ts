import { LlmCopypasterConfig } from '../contracts/system-config-contracts';
import { LlmCopypasterUserConfig, OverrideUserConfig } from '../contracts/user-config-contracts';

export type ValidationSourceConfigId = 'systemUserMerged' | string;

export enum ValidationIssueSeverity {
  Critical = 'Critical',
  Warning = 'Warning',
  Recommendation = 'Recommendation',
}

export class ValidationResult {
  public constructor(public readonly issues: ValidationIssue[]) {}

  public get isValid(): boolean {
    return !this.criticalIssues.length && !this.warningIssues.length;
  }

  public get criticalIssues(): ValidationIssue[] {
    return this.issues.filter(validationIssue => validationIssue.severity === ValidationIssueSeverity.Critical);
  }

  public get warningIssues(): ValidationIssue[] {
    return this.issues.filter(validationIssue => validationIssue.severity === ValidationIssueSeverity.Warning);
  }

  public get recommendations(): ValidationIssue[] {
    return this.issues.filter(validationIssue => validationIssue.severity === ValidationIssueSeverity.Recommendation);
  }
}

export interface ValidationIssue {
  sourceConfigId: ValidationSourceConfigId;
  violatedRuleId: string;
  violationDescription: string;
  severity: ValidationIssueSeverity;
}

export interface ValidationTargetConfig {
  sourceConfigId: ValidationSourceConfigId;
  mergedConfig: LlmCopypasterConfig;
  rawOverrideConfig: OverrideUserConfig | null;
}

export interface ValidationRuleContext {
  sourceConfigId: ValidationSourceConfigId;
  mergedConfig: LlmCopypasterConfig;
  systemUserMergedConfig: LlmCopypasterConfig;
  systemConfig: LlmCopypasterConfig;
  userConfig: LlmCopypasterUserConfig | null;
  rawOverrideConfig: OverrideUserConfig | null;
}

export interface ValidationRule {
  id: string;
  description: string;
  severity: ValidationIssueSeverity;
  validate(validationRuleContext: ValidationRuleContext): boolean;
}
