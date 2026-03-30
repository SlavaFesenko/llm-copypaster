import { LlmCopypasterConfig } from '../../contracts/system-config-contracts';
import { ValidationIssueSeverity, ValidationRule, ValidationRuleContext } from '../contracts';

export const allSharedVariablesConfigRefsMustPointToExistingConfigSectionsRule: ValidationRule = {
  id: 'all-sharedVariables-config-refs-must-point-to-existing-config-sections',
  rationale:
    'sharedVariablesById config refs must point to existing config sections, otherwise prompt variables resolve to broken paths',
  severity: ValidationIssueSeverity.Warning,
  getViolationDescription(validationRuleContext: ValidationRuleContext): string | null {
    const invalidSharedVariableConfigRefs = getInvalidSharedVariableConfigRefs(validationRuleContext);

    if (!invalidSharedVariableConfigRefs.length) return null;

    return `These sharedVariablesById config refs must point to existing config sections:\n- ${invalidSharedVariableConfigRefs.join('\n- ')}`;
  },
};

function getInvalidSharedVariableConfigRefs(validationRuleContext: ValidationRuleContext): string[] {
  const configRefVarAnchor =
    validationRuleContext.mergedConfig.nonOverrideableSettings.vitalParsingAnchors.CONFIG_REF_VAR_ANCHOR;
  const sharedVariablesById = validationRuleContext.mergedConfig.coreSettings.instructionsAndVariables.sharedVariablesById;

  return Object.entries(sharedVariablesById)
    .filter(([, sharedVariableValue]) => sharedVariableValue.startsWith(configRefVarAnchor))
    .filter(
      ([, sharedVariableValue]) =>
        !doesConfigRefPathExist(validationRuleContext.mergedConfig, sharedVariableValue, configRefVarAnchor)
    )
    .map(([sharedVariableId, sharedVariableValue]) => `${sharedVariableId}: "${sharedVariableValue}"`);
}

function doesConfigRefPathExist(
  mergedConfig: LlmCopypasterConfig,
  sharedVariableValue: string,
  configRefVarAnchor: string
): boolean {
  const configRefPath = sharedVariableValue.slice(configRefVarAnchor.length);
  const configRefPathSegments = configRefPath.split('.').filter(configRefPathSegment => configRefPathSegment.length);

  let currentConfigNode: unknown = mergedConfig;

  for (const configRefPathSegment of configRefPathSegments) {
    if (!isObjectLike(currentConfigNode)) return false;
    if (!(configRefPathSegment in currentConfigNode)) return false;

    currentConfigNode = currentConfigNode[configRefPathSegment];
  }

  return true;
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
