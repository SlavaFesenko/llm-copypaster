import { VitalParsingAnchorsConfig } from '../../contracts/system-config-contracts';
import { ValidationIssueSeverity, ValidationRule, ValidationRuleContext } from '../contracts';

export class VitalAnchorsMinLengthRule implements ValidationRule {
  public readonly name = 'Vital parsing anchors must be longer than 2 chars';
  public readonly rationale =
    'Short vitalParsingAnchors increase the chance of accidental matches and make parsing more fragile';
  public readonly severity = ValidationIssueSeverity.Critical;
  public readonly skipForOverrides = true;

  public getViolationDescription(validationRuleContext: ValidationRuleContext): string | null {
    const invalidVitalParsingAnchors = this._getInvalidVitalParsingAnchors(
      validationRuleContext.mergedConfig.nonOverrideableSettings.vitalParsingAnchors
    );

    if (!invalidVitalParsingAnchors.length) return null;

    return `These vitalParsingAnchors must be longer than 2 chars:\n- ${invalidVitalParsingAnchors.join('\n- ')}`;
  }

  private _getInvalidVitalParsingAnchors(vitalParsingAnchors: VitalParsingAnchorsConfig): string[] {
    return Object.entries(vitalParsingAnchors)
      .filter(([, anchorValue]) => anchorValue !== null && anchorValue.length <= 2)
      .map(([anchorKey, anchorValue]) => `nonOverrideableSettings.vitalParsingAnchors.${anchorKey}: "${anchorValue}"`);
  }
}
