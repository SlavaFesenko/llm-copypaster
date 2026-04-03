import { LlmCopypasterConfig } from '../contracts/system-config-contracts';

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

export interface ValidationIssue {
  targetConfigName: string;
  violatedRuleName: string;
  ruleRationale: string;
  violationDescription: string;
  severity: ValidationIssueSeverity;
}

export interface ValidationRuleContext {
  targetConfigName: string;
  targetConfig: LlmCopypasterConfig;
}

export interface ValidationRule {
  name: string;
  rationale: string;
  severity: ValidationIssueSeverity;
  skipForOverrides?: boolean;
  getViolationDescription(validationRuleContext: ValidationRuleContext): string | null;
}
