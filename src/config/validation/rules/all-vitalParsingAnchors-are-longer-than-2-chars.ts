import { VitalParsingAnchorsConfig } from '../../contracts/system-config-contracts';
import { ValidationIssueSeverity, ValidationRule, ValidationRuleContext } from '../contracts';

export const allVitalParsingAnchorsAreLongerThan2CharsRule: ValidationRule = {
  id: 'all-vitalParsingAnchors-are-longer-than-2-chars',
  description: 'vitalParsingAnchors should be longer than 2 chars to make regexes work smoothly',
  severity: ValidationIssueSeverity.Critical,
  validate(validationRuleContext: ValidationRuleContext): boolean {
    const vitalParsingAnchors = validationRuleContext.mergedConfig.nonOverrideableSettings.vitalParsingAnchors;

    return getNonNullableVitalParsingAnchorsValues(vitalParsingAnchors).every(anchorValue => anchorValue.length > 2);
  },
};

function getNonNullableVitalParsingAnchorsValues(vitalParsingAnchors: VitalParsingAnchorsConfig): string[] {
  return Object.values(vitalParsingAnchors).filter((anchorValue): anchorValue is string => anchorValue !== null);
}
