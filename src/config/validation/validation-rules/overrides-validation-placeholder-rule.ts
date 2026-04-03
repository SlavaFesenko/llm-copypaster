import { ValidationIssueSeverity, ValidationRule, ValidationRuleContext } from '../contracts';

export class OverridesValidationPlaceholderRule implements ValidationRule {
  public readonly name = 'Overrides must remain consistent with target config';
  public readonly rationale =
    'Overrides validation will verify that override paths and values remain valid against the effective config';
  public readonly severity = ValidationIssueSeverity.Critical;

  public getViolationDescriptions(validationRuleContext: ValidationRuleContext): string[] {
    void validationRuleContext;

    // Placeholder for future overrides validation against targetConfig,
    // including checks that override paths resolve to existing values in live config records
    return [];
  }
}
