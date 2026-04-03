import { LlmCopypasterConfig } from '../contracts/system-config-contracts';
import { LlmCopypasterUserConfig } from '../contracts/user-config-contracts';

export enum ValidationIssueSeverity {
  Critical = 'Critical',
  Warning = 'Warning',
  Recommendation = 'Recommendation',
}

export interface ValidationResult {
  validatedConfigNames: string[];
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
  systemConfig: LlmCopypasterConfig;
  userConfig: LlmCopypasterUserConfig | null;
}

export interface ValidationRule {
  name: string;
  rationale: string;
  severity: ValidationIssueSeverity;
  skipForOverrides?: boolean;
  getViolationDescriptions(validationRuleContext: ValidationRuleContext): string[];
}
