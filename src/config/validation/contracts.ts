import { SystemConfig } from '../contracts/system-config-contracts';
import { UserConfig } from '../contracts/user-config-contracts';

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
  fixTip?: string;
}

export interface ValidationRuleContext {
  targetConfigName: string;
  targetConfig: SystemConfig;
  systemConfig: SystemConfig;
  userConfig: UserConfig | null;
}

export interface ValidationRule {
  name: string;
  rationale: string;
  severity: ValidationIssueSeverity;
  fixTip?: string;
  getViolationDescriptions(validationRuleContext: ValidationRuleContext): string[];
}
