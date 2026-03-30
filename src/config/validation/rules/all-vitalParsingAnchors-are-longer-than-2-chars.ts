import { VitalParsingAnchorsConfig } from '../../contracts/system-config-contracts';
import { ValidationIssueSeverity, ValidationRule, ValidationRuleContext } from '../contracts';

export const allVitalParsingAnchorsAreLongerThan2CharsRule: ValidationRule = {
  id: 'all-vitalParsingAnchors-are-longer-than-2-chars',
  rationale: 'Short vitalParsingAnchors increase the chance of accidental matches and make parsing more fragile',
  severity: ValidationIssueSeverity.Critical,
  getViolationDescription(validationRuleContext: ValidationRuleContext): string | null {
    const invalidVitalParsingAnchors = getInvalidVitalParsingAnchors(
      validationRuleContext.mergedConfig.nonOverrideableSettings.vitalParsingAnchors
    );

    if (!invalidVitalParsingAnchors.length) return null;

    return `These vitalParsingAnchors must be longer than 2 chars:\n- ${invalidVitalParsingAnchors.join('\n- ')}`;
  },
};

function getInvalidVitalParsingAnchors(vitalParsingAnchors: VitalParsingAnchorsConfig): string[] {
  return Object.entries(vitalParsingAnchors)
    .filter(([, anchorValue]) => anchorValue !== null && anchorValue.length <= 2)
    .map(([anchorKey, anchorValue]) => `${anchorKey}: "${anchorValue}"`);
}
