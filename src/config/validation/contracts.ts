import { LlmCopypasterConfig } from '../contracts/system-config-contracts';
import { LlmCopypasterUserConfig, OverrideUserConfig } from '../contracts/user-config-contracts';

export type ValidationSourceConfigId = 'systemUserMerged' | string;

export enum ValidationIssueSeverity {
  Critical = 'Critical',
  Warning = 'Warning',
  Recommendation = 'Recommendation',
}

export interface ValidationResult {
  criticalIssues: ValidationIssue[];
  warningIssues: ValidationIssue[];
  recommendationIssues: ValidationIssue[];
}

export interface ValidationIssueSource {
  sourceConfigId: ValidationSourceConfigId;
}

export interface ValidationIssue {
  sourceConfigId: ValidationSourceConfigId;
  sources: ValidationIssueSource[];
  violatedRuleName: string;
  ruleRationale: string;
  violationDescription: string;
  severity: ValidationIssueSeverity;
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
  name: string;
  rationale: string;
  severity: ValidationIssueSeverity;
  skipForOverrides?: boolean;
  getViolationDescription(validationRuleContext: ValidationRuleContext): string | null;
}
